/**
 * ============================================================================
 * Beulrock C++ Core Engine — main.cpp
 * ============================================================================
 *
 * A high-performance execution engine binary that communicates with the
 * Next.js backend via JSON-over-stdin/stdout (the --stdin protocol).
 *
 * Supported actions:
 *   execute   — Simulate a multi-phase script execution pipeline
 *   validate  — Validate a Lua script (size, blocked patterns, SHA-256)
 *   benchmark — Run crypto & multi-threaded performance benchmarks
 *   health    — Return health status, circuit breaker & thread-pool info
 *   stats     — Return cumulative engine statistics
 *
 * Protocol:
 *   1. Spawn with:  beulrock-engine --stdin
 *   2. Write a single JSON object to stdin (no trailing newline required)
 *   3. Engine writes a single JSON response to stdout and exits with code 0
 *   4. On fatal errors the engine writes an error JSON and exits non-zero
 *
 * Build dependencies:
 *   C++17, OpenSSL (libcrypto), pthread, nlohmann/json
 *
 * ============================================================================
 */

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <future>
#include <iomanip>
#include <iostream>
#include <memory>
#include <mutex>
#include <regex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

// OpenSSL EVP headers (modern, non-deprecated API)
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/err.h>

// nlohmann/json — included via CMake (vendored or fetched)
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// ============================================================================
// Constants
// ============================================================================

static const char* ENGINE_VERSION    = "1.0.0";
static const char* PROTOCOL_VERSION  = "2.0";
static const char* ENGINE_NAME       = "beulrock-cpp";

// Maximum script size (matches TypeScript tier.ts: 100 000 bytes)
static const size_t MAX_SCRIPT_SIZE = 100000;

// Circuit-breaker defaults (match executor-engine.ts)
static const int CB_FAILURE_THRESHOLD = 5;
static const int CB_RESET_TIMEOUT_SEC = 60;

// Benchmark iteration count
static const int BENCHMARK_ITERATIONS = 10000;

// ============================================================================
// Global Engine Statistics (atomic)
// ============================================================================

namespace stats {
    std::atomic<uint64_t> totalExecutions{0};
    std::atomic<uint64_t> failedExecutions{0};
    std::atomic<uint64_t> totalProcessingTimeMs{0};
    std::atomic<uint64_t> validationCount{0};
    std::atomic<uint64_t> benchmarkCount{0};
}

// ============================================================================
// Circuit Breaker
// ============================================================================

enum class CircuitState { Closed, Open, HalfOpen };

struct CircuitBreaker {
    std::mutex              mtx;
    CircuitState            state       = CircuitState::Closed;
    int                     failureCount = 0;
    int                     successCount = 0;
    std::chrono::steady_clock::time_point lastFailureTime;

    /// Record a success and potentially close the circuit.
    void onSuccess() {
        std::lock_guard<std::mutex> lock(mtx);
        successCount++;
        if (state == CircuitState::HalfOpen) {
            state = CircuitState::Closed;
            failureCount = 0;
        }
    }

    /// Record a failure and potentially open the circuit.
    void onFailure() {
        std::lock_guard<std::mutex> lock(mtx);
        failureCount++;
        lastFailureTime = std::chrono::steady_clock::now();
        if (failureCount >= CB_FAILURE_THRESHOLD) {
            state = CircuitState::Open;
        }
    }

    /// Check whether the circuit allows a request right now.
    bool allowRequest() {
        std::lock_guard<std::mutex> lock(mtx);
        if (state == CircuitState::Closed) return true;
        if (state == CircuitState::Open) {
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                std::chrono::steady_clock::now() - lastFailureTime).count();
            if (elapsed >= CB_RESET_TIMEOUT_SEC) {
                state = CircuitState::HalfOpen;
                return true;
            }
            return false;
        }
        // HalfOpen — allow one probe request
        return true;
    }

    /// Serialise to JSON for health endpoint.
    json toJson() const {
        const char* stateStr = "closed";
        {
            // Can't lock in const, but state is atomic-ish; we read under our own lock.
            CircuitState s;
            int fc, sc;
            { std::lock_guard<std::mutex> lk(const_cast<std::mutex&>(mtx));
              s = state; fc = failureCount; sc = successCount; }
            if (s == CircuitState::Open)    stateStr = "open";
            if (s == CircuitState::HalfOpen) stateStr = "half-open";
            return {
                {"state",             stateStr},
                {"failureCount",      fc},
                {"successCount",      sc},
                {"failureThreshold",  CB_FAILURE_THRESHOLD},
                {"resetTimeoutSec",   CB_RESET_TIMEOUT_SEC}
            };
        }
    }
};

static CircuitBreaker g_circuitBreaker;

// ============================================================================
// Simple Thread Pool
// ============================================================================

class ThreadPool {
public:
    explicit ThreadPool(size_t numThreads)
        : stop_(false), activeWorkers_(0), pendingTasks_(0)
    {
        for (size_t i = 0; i < numThreads; ++i) {
            workers_.emplace_back([this] { workerLoop(); });
        }
    }

    ~ThreadPool() {
        {
            std::unique_lock<std::mutex> lock(queueMtx_);
            stop_ = true;
        }
        condVar_.notify_all();
        for (auto& t : workers_) {
            if (t.joinable()) t.join();
        }
    }

    /// Enqueue a task and return a future for its result.
    template<typename F>
    auto enqueue(F&& f) -> std::future<decltype(f())> {
        using ReturnType = decltype(f());
        auto task = std::make_shared<std::packaged_task<ReturnType()>>(
            std::forward<F>(f)
        );

        std::future<ReturnType> result = task->get_future();
        {
            std::unique_lock<std::mutex> lock(queueMtx_);
            if (stop_) {
                throw std::runtime_error("ThreadPool is stopped");
            }
            tasks_.emplace([task]() { (*task)(); });
            pendingTasks_++;
        }
        condVar_.notify_one();
        return result;
    }

    /// Current snapshot for health reporting.
    json toJson() const {
        return {
            {"activeWorkers", activeWorkers_.load()},
            {"pendingTasks",  pendingTasks_.load()}
        };
    }

private:
    void workerLoop() {
        while (true) {
            std::function<void()> task;
            {
                std::unique_lock<std::mutex> lock(queueMtx_);
                condVar_.wait(lock, [this] { return stop_ || !tasks_.empty(); });
                if (stop_ && tasks_.empty()) return;
                task = std::move(tasks_.front());
                tasks_.pop();
                pendingTasks_--;
                activeWorkers_++;
            }
            task();
            activeWorkers_--;
        }
    }

    std::vector<std::thread>           workers_;
    std::queue<std::function<void()>>  tasks_;
    std::mutex                         queueMtx_;
    std::condition_variable             condVar_;
    bool                               stop_;
    std::atomic<int>                   activeWorkers_;
    std::atomic<int>                   pendingTasks_;
};

// Create a global thread pool sized to hardware concurrency
static std::unique_ptr<ThreadPool> g_threadPool;

static ThreadPool& getThreadPool() {
    if (!g_threadPool) {
        unsigned int hwThreads = std::thread::hardware_concurrency();
        if (hwThreads == 0) hwThreads = 4; // sensible fallback
        g_threadPool = std::make_unique<ThreadPool>(hwThreads);
    }
    return *g_threadPool;
}

// ============================================================================
// OpenSSL Helpers (EVP API — non-deprecated)
// ============================================================================

/**
 * Compute the SHA-256 digest of arbitrary data.
 * Returns the hex-encoded hash string, or empty string on error.
 */
static std::string sha256Hex(const std::string& data) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int  hashLen = 0;

    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) {
        ERR_print_errors_fp(stderr);
        return "";
    }

    if (EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr) != 1 ||
        EVP_DigestUpdate(ctx, data.data(), data.size()) != 1 ||
        EVP_DigestFinal_ex(ctx, hash, &hashLen) != 1) {
        ERR_print_errors_fp(stderr);
        EVP_MD_CTX_free(ctx);
        return "";
    }

    EVP_MD_CTX_free(ctx);

    // Convert to hex
    std::ostringstream oss;
    for (unsigned int i = 0; i < hashLen; ++i) {
        oss << std::hex << std::setw(2) << std::setfill('0')
            << static_cast<int>(hash[i]);
    }
    return oss.str();
}

/**
 * Compute HMAC-SHA256 of `data` using `key`.
 * Returns the hex-encoded HMAC string, or empty string on error.
 */
static std::string hmacSha256Hex(const std::string& key, const std::string& data) {
    unsigned char hmacResult[EVP_MAX_MD_SIZE];
    unsigned int  hmacLen = 0;

    EVP_MAC* mac = EVP_MAC_fetch(nullptr, "HMAC", nullptr);
    if (!mac) {
        ERR_print_errors_fp(stderr);
        return "";
    }

    EVP_MAC_CTX* mctx = EVP_MAC_CTX_new(mac);
    if (!mctx) {
        EVP_MAC_free(mac);
        ERR_print_errors_fp(stderr);
        return "";
    }

    OSSL_PARAM params[] = {
        OSSL_PARAM_construct_utf8_string("digest", const_cast<char*>("SHA256"), 0),
        OSSL_PARAM_END
    };

    if (EVP_MAC_init(mctx,
                     reinterpret_cast<const unsigned char*>(key.data()), key.size(),
                     params) != 1 ||
        EVP_MAC_update(mctx,
                       reinterpret_cast<const unsigned char*>(data.data()), data.size()) != 1 ||
        EVP_MAC_final(mctx, hmacResult, &hmacLen, sizeof(hmacResult)) != 1) {
        ERR_print_errors_fp(stderr);
        EVP_MAC_CTX_free(mctx);
        EVP_MAC_free(mac);
        return "";
    }

    EVP_MAC_CTX_free(mctx);
    EVP_MAC_free(mac);

    std::ostringstream oss;
    for (unsigned int i = 0; i < hmacLen; ++i) {
        oss << std::hex << std::setw(2) << std::setfill('0')
            << static_cast<int>(hmacResult[i]);
    }
    return oss.str();
}

/**
 * Get a human-readable OpenSSL version string.
 */
static std::string getOpenSSLVersion() {
    return OpenSSL_version(OPENSSL_VERSION);
}

// ============================================================================
// ISO-8601 Timestamp
// ============================================================================

static std::string isoNow() {
    auto now = std::chrono::system_clock::now();
    auto timeT = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()) % 1000;
    std::tm tmBuf{};
    localtime_r(&timeT, &tmBuf);

    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &tmBuf);
    std::ostringstream oss;
    oss << buf << "." << std::setw(3) << std::setfill('0') << ms.count();
    // Attempt to get timezone offset (simplified: assume UTC for portability)
    oss << "Z";
    return oss.str();
}

// ============================================================================
// Script Validation
// ============================================================================

/**
 * Blocked patterns mirror the TypeScript regex list in tier.ts:
 *   - while true do
 *   - for i = 1, math.huge
 *   - spawn(
 */
static const std::vector<std::pair<std::string, std::regex>> BLOCKED_PATTERNS = {
    { R"(while\s+true\s+do)",                     std::regex(R"(while\s+true\s+do)", std::regex::icase) },
    { R"(for\s+i\s*=\s*1\s*,\s*math\.huge)",       std::regex(R"(for\s+i\s*=\s*1\s*,\s*math\.huge)", std::regex::icase) },
    { R"(spawn\s*\()",                             std::regex(R"(spawn\s*\()", std::regex::icase) },
};

/**
 * Validate a Lua script.  Returns a JSON object with:
 *   valid, reason, scriptSize, sha256Hash
 */
static json validateScript(const std::string& script) {
    json result;

    // Empty check
    std::string trimmed = script;
    // Simple trim
    auto start = trimmed.find_first_not_of(" \t\n\r");
    if (start == std::string::npos || trimmed.substr(start).empty()) {
        result = {
            {"valid", false},
            {"reason", "Script cannot be empty"},
            {"scriptSize", 0},
            {"sha256Hash", ""}
        };
        return result;
    }

    // Size check
    if (script.size() > MAX_SCRIPT_SIZE) {
        result = {
            {"valid", false},
            {"reason", "Script exceeds maximum size of 100KB"},
            {"scriptSize", static_cast<uint64_t>(script.size())},
            {"sha256Hash", sha256Hex(script)}
        };
        return result;
    }

    // Pattern check
    for (const auto& [patternSrc, pattern] : BLOCKED_PATTERNS) {
        if (std::regex_search(script, pattern)) {
            result = {
                {"valid", false},
                {"reason", std::string("Script contains blocked pattern: ") + patternSrc},
                {"scriptSize", static_cast<uint64_t>(script.size())},
                {"sha256Hash", sha256Hex(script)}
            };
            return result;
        }
    }

    // All checks passed
    result = {
        {"valid", true},
        {"reason", ""},
        {"scriptSize", static_cast<uint64_t>(script.size())},
        {"sha256Hash", sha256Hex(script)}
    };
    return result;
}

// ============================================================================
// Action: validate
// ============================================================================

static json handleValidate(const json& input) {
    if (!input.contains("script") || !input["script"].is_string()) {
        return {
            {"success", false},
            {"action", "validate"},
            {"error", "Missing or invalid 'script' field"}
        };
    }

    const std::string script = input["script"].get<std::string>();
    auto start = std::chrono::steady_clock::now();

    json result = validateScript(script);
    stats::validationCount++;

    auto end = std::chrono::steady_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

    return {
        {"success", true},
        {"action", "validate"},
        {"data", result.dump()},
        {"processingTimeMs", ms}
    };
}

// ============================================================================
// Action: execute  (simulated multi-phase pipeline)
// ============================================================================

/// Helper: add a log entry
static void addLog(json& logs, const std::string& phase,
                   const std::string& level, const std::string& message) {
    logs.push_back({
        {"timestamp", isoNow()},
        {"phase",     phase},
        {"level",     level},
        {"message",   message}
    });
}

/// Helper: convert logs array to plain-text logText
static std::string formatLogText(const json& logs) {
    std::ostringstream oss;
    for (const auto& entry : logs) {
        oss << "[" << entry["level"].get<std::string>() << "] "
            << entry["message"].get<std::string>() << "\n";
    }
    return oss.str();
}

/**
 * Generate contextual script output based on script content keywords.
 * Mirrors the TypeScript generateScriptOutput() in executor-engine.ts.
 */
static void generateScriptOutput(const std::string& script, json& logs) {
    std::string lower = script;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);

    if (lower.find("farm") != std::string::npos || lower.find("auto") != std::string::npos) {
        addLog(logs, "running", "CONSOLE",
               "[AutoFarm] Scanning for collectible instances... Found 47 resources in range.");
        addLog(logs, "running", "INFO",
               "Auto-farm cycle initiated. Collection rate: ~12 items/sec.");
    }
    if (lower.find("speed") != std::string::npos || lower.find("walk") != std::string::npos) {
        addLog(logs, "running", "CONSOLE",
               "[Speed] WalkSpeed modified: 16 -> 100. Velocity multiplier applied.");
    }
    if (lower.find("esp") != std::string::npos || lower.find("chams") != std::string::npos) {
        addLog(logs, "running", "CONSOLE",
               "[ESP] Rendering highlights for 23 players in render distance. Billboard GUI attached.");
    }
    if (lower.find("teleport") != std::string::npos || lower.find("tp ") != std::string::npos) {
        addLog(logs, "running", "CONSOLE",
               "[Teleport] Coordinate system locked. Ready for instant relocation.");
    }
    if (lower.find("aimbot") != std::string::npos || lower.find("aim") != std::string::npos) {
        addLog(logs, "running", "CONSOLE",
               "[Aimbot] Target acquisition system active. FOV: 120deg, Smoothing: 0.85.");
    }
    if (lower.find("god") != std::string::npos || lower.find("health") != std::string::npos) {
        addLog(logs, "running", "CONSOLE",
               "[GodMode] Health value locked at maximum. Damage hook installed.");
    }

    // If nothing matched, add generic output
    if (lower.find("farm") == std::string::npos &&
        lower.find("speed") == std::string::npos &&
        lower.find("esp") == std::string::npos &&
        lower.find("teleport") == std::string::npos &&
        lower.find("aimbot") == std::string::npos &&
        lower.find("god") == std::string::npos) {
        addLog(logs, "running", "CONSOLE", "Script runtime initialized. Environment ready.");
        addLog(logs, "running", "INFO",
               "Executing main function in sandboxed environment...");
    }

    // Always add performance stats
    int cpuUsage = 3 + (rand() % 12);
    int memUsage = 2 + (rand() % 8);
    addLog(logs, "running", "DEBUG",
           "Performance: " + std::to_string(cpuUsage) + "% CPU | " +
           std::to_string(memUsage) + "MB RAM | 0 GC pauses");
}

static json handleExecute(const json& input) {
    // Check required fields
    if (!input.contains("jobId") || !input["jobId"].is_string() ||
        !input.contains("script") || !input["script"].is_string()) {
        return {
            {"success", false},
            {"action", "execute"},
            {"error", "Missing required fields: jobId, script"}
        };
    }

    // Circuit-breaker gate
    if (!g_circuitBreaker.allowRequest()) {
        stats::failedExecutions++;
        return {
            {"success", false},
            {"action", "execute"},
            {"error", "Circuit breaker is open — too many recent failures"}
        };
    }

    const std::string jobId  = input["jobId"].get<std::string>();
    const std::string script = input["script"].get<std::string>();

    json logs = json::array();
    auto pipelineStart = std::chrono::steady_clock::now();

    // ── PHASE 1: Validating ─────────────────────────────────────────────
    addLog(logs, "validating", "INFO",
           "Execution pipeline initiated. Validating script payload...");

    // Simulate processing delay (~50ms — we use a short sleep to model async work)
    std::this_thread::sleep_for(std::chrono::milliseconds(30));

    json validation = validateScript(script);
    if (!validation["valid"].get<bool>()) {
        addLog(logs, "validating", "ERROR",
               "Script validation failed: " + validation["reason"].get<std::string>());
        g_circuitBreaker.onFailure();
        stats::failedExecutions++;

        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - pipelineStart).count();

        json data = {
            {"jobId", jobId},
            {"phase", "failed"},
            {"progress", 0},
            {"logs", logs},
            {"logText", formatLogText(logs)},
            {"elapsedMs", elapsed},
            {"success", false},
            {"engine", "cpp"},
            {"engineVersion", ENGINE_VERSION},
            {"protocolVersion", PROTOCOL_VERSION}
        };
        return {
            {"success", false},
            {"action", "execute"},
            {"data", data.dump()},
            {"error", validation["reason"].get<std::string>()},
            {"processingTimeMs", elapsed}
        };
    }

    // Size and hash debug info
    std::string hash = validation["sha256Hash"].get<std::string>();
    std::string shortHash = hash.size() > 16 ? hash.substr(0, 16) + "..." : hash;
    addLog(logs, "validating", "DEBUG",
           "Script size: " + std::to_string(script.size()) +
           " bytes | SHA256: " + shortHash);
    addLog(logs, "validating", "SUCCESS",
           "Script payload validated. No blocked patterns detected.");

    // ── PHASE 2: Allocating ────────────────────────────────────────────
    addLog(logs, "allocating", "INFO",
           "Scanning for available game servers...");
    std::this_thread::sleep_for(std::chrono::milliseconds(20));

    std::string serverId = input.value("serverId", "");
    if (serverId.empty()) {
        serverId = "srv_" + jobId.substr(0, 8);
    }
    addLog(logs, "allocating", "SUCCESS",
           "Server allocated: " + serverId + " [online]");

    // ── PHASE 3: Injecting ─────────────────────────────────────────────
    addLog(logs, "injecting", "INFO",
           "Establishing secure connection to server linker...");
    std::this_thread::sleep_for(std::chrono::milliseconds(25));

    // Build HMAC signature (mirrors buildLinkerRequest in executor-engine.ts)
    std::string linkerSecret = input.value("linkerSecret",
                                            "beulrock_linker_hmac_secret_key_2024");
    std::string gameId = input.value("gameId", "unknown");
    std::string timestamp = std::to_string(
        std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count());
    std::string nonce = jobId.substr(0, 12) + timestamp.substr(-6);
    std::string canonical = serverId + ":" + gameId + ":" + jobId + ":" + timestamp + ":" + nonce;
    std::string signature = hmacSha256Hex(linkerSecret, canonical);
    std::string shortSig = signature.size() > 16 ? signature.substr(0, 16) + "..." : signature;

    addLog(logs, "injecting", "DEBUG",
           "Signature: X-Beulrock-Signature=" + shortSig);
    addLog(logs, "injecting", "INFO",
           "Sending signed execution payload to server linker...");
    std::this_thread::sleep_for(std::chrono::milliseconds(30));

    addLog(logs, "injecting", "SUCCESS",
           "Injection successful. Script payload delivered to game server.");

    // ── PHASE 4: Running ───────────────────────────────────────────────
    addLog(logs, "running", "INFO",
           "Bypassing server-side protection layer...");
    std::this_thread::sleep_for(std::chrono::milliseconds(20));

    addLog(logs, "running", "SUCCESS",
           "Protection bypassed. Script environment ready.");
    addLog(logs, "running", "INFO",
           "Initializing script execution context...");

    // Generate contextual output
    generateScriptOutput(script, logs);

    addLog(logs, "running", "SUCCESS",
           "All script modules operational. Execution stable.");

    // ── PHASE 5: Completed ─────────────────────────────────────────────
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - pipelineStart).count();

    double elapsedSec = elapsed / 1000.0;
    std::ostringstream secOss;
    secOss << std::fixed << std::setprecision(2) << elapsedSec;

    addLog(logs, "completed", "SUCCESS",
           "Execution completed successfully. Total time: " + secOss.str() + "s");

    // Record success
    g_circuitBreaker.onSuccess();
    stats::totalExecutions++;
    stats::totalProcessingTimeMs += static_cast<uint64_t>(elapsed);

    json data = {
        {"jobId", jobId},
        {"phase", "completed"},
        {"progress", 100},
        {"logs", logs},
        {"logText", formatLogText(logs)},
        {"elapsedMs", elapsed},
        {"success", true},
        {"engine", "cpp"},
        {"engineVersion", ENGINE_VERSION},
        {"protocolVersion", PROTOCOL_VERSION}
    };

    return {
        {"success", true},
        {"action", "execute"},
        {"data", data.dump()},
        {"processingTimeMs", elapsed}
    };
}

// ============================================================================
// Action: benchmark
// ============================================================================

static json handleBenchmark(const json& /*input*/) {
    auto& pool = getThreadPool();
    unsigned int hwThreads = std::thread::hardware_concurrency();
    if (hwThreads == 0) hwThreads = 4;

    // ── HMAC-SHA256 benchmark ──────────────────────────────────────────
    std::string benchKey(32, 'K');  // 32-byte key
    std::string benchData(256, 'D'); // 256-byte payload
    auto hmacStart = std::chrono::steady_clock::now();
    volatile std::string hmacSink; // prevent optimisation
    for (int i = 0; i < BENCHMARK_ITERATIONS; ++i) {
        hmacSink = hmacSha256Hex(benchKey, benchData);
    }
    auto hmacEnd = std::chrono::steady_clock::now();
    long hmacTotalMs = std::chrono::duration_cast<std::chrono::microseconds>(
        hmacEnd - hmacStart).count() / 1000;
    double hmacPerOpUs = static_cast<double>(
        std::chrono::duration_cast<std::chrono::microseconds>(hmacEnd - hmacStart).count())
        / BENCHMARK_ITERATIONS;

    // ── SHA256 benchmark ───────────────────────────────────────────────
    auto shaStart = std::chrono::steady_clock::now();
    volatile std::string shaSink;
    for (int i = 0; i < BENCHMARK_ITERATIONS; ++i) {
        shaSink = sha256Hex(benchData);
    }
    auto shaEnd = std::chrono::steady_clock::now();
    long shaTotalMs = std::chrono::duration_cast<std::chrono::microseconds>(
        shaEnd - shaStart).count() / 1000;
    double shaPerOpUs = static_cast<double>(
        std::chrono::duration_cast<std::chrono::microseconds>(shaEnd - shaStart).count())
        / BENCHMARK_ITERATIONS;

    // ── Script validation benchmark ────────────────────────────────────
    std::string sampleScript(2048, 'x');
    sampleScript += "\nprint('hello')\n";
    auto valStart = std::chrono::steady_clock::now();
    for (int i = 0; i < BENCHMARK_ITERATIONS; ++i) {
        volatile auto r = validateScript(sampleScript);
        (void)r;
    }
    auto valEnd = std::chrono::steady_clock::now();
    long valTotalMs = std::chrono::duration_cast<std::chrono::microseconds>(
        valEnd - valStart).count() / 1000;
    double valPerOpUs = static_cast<double>(
        std::chrono::duration_cast<std::chrono::microseconds>(valEnd - valStart).count())
        / BENCHMARK_ITERATIONS;

    // ── Multi-threaded benchmark ───────────────────────────────────────
    auto mtStart = std::chrono::steady_clock::now();
    std::vector<std::future<std::string>> futures;
    int perThread = BENCHMARK_ITERATIONS / static_cast<int>(hwThreads);
    for (unsigned int t = 0; t < hwThreads; ++t) {
        futures.push_back(pool.enqueue([&benchData]() -> std::string {
            for (int i = 0; i < perThread; ++i) {
                volatile auto h = sha256Hex(benchData);
                (void)h;
            }
            return "done";
        }));
    }
    for (auto& f : futures) { f.wait(); }
    auto mtEnd = std::chrono::steady_clock::now();
    long mtTotalMs = std::chrono::duration_cast<std::chrono::microseconds>(
        mtEnd - mtStart).count() / 1000;
    double mtPerOpUs = static_cast<double>(
        std::chrono::duration_cast<std::chrono::microseconds>(mtEnd - mtStart).count())
        / BENCHMARK_ITERATIONS;

    stats::benchmarkCount++;

    json data = {
        {"engine", ENGINE_NAME},
        {"version", ENGINE_VERSION},
        {"iterations", BENCHMARK_ITERATIONS},
        {"benchmarks", {
            {"hmacSha256", {
                {"totalMs", hmacTotalMs},
                {"perOpUs", static_cast<double>(static_cast<int>(hmacPerOpUs * 100)) / 100.0}
            }},
            {"sha256", {
                {"totalMs", shaTotalMs},
                {"perOpUs", static_cast<double>(static_cast<int>(shaPerOpUs * 100)) / 100.0}
            }},
            {"scriptValidation", {
                {"totalMs", valTotalMs},
                {"perOpUs", static_cast<double>(static_cast<int>(valPerOpUs * 100)) / 100.0}
            }},
            {"multiThreaded", {
                {"totalMs", mtTotalMs},
                {"threads", hwThreads},
                {"perOpUs", static_cast<double>(static_cast<int>(mtPerOpUs * 100)) / 100.0}
            }}
        }},
        {"system", {
            {"cpuThreads", hwThreads},
            {"opensslVersion", getOpenSSLVersion()}
        }}
    };

    auto totalElapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        mtEnd - hmacStart).count();

    return {
        {"success", true},
        {"action", "benchmark"},
        {"data", data.dump()},
        {"processingTimeMs", totalElapsed}
    };
}

// ============================================================================
// Action: health
// ============================================================================

static json handleHealth(const json& /*input*/) {
    // Determine circuit breaker state for status determination
    std::string status = "healthy";
    {
        std::lock_guard<std::mutex> lk(const_cast<std::mutex&>(g_circuitBreaker.mtx));
        if (g_circuitBreaker.state == CircuitState::Open) {
            status = "degraded";
        } else if (g_circuitBreaker.state == CircuitState::HalfOpen) {
            status = "recovering";
        }
    }

    auto& pool = getThreadPool();

    json data = {
        {"status",           status},
        {"engine",           ENGINE_NAME},
        {"version",          ENGINE_VERSION},
        {"protocol",         PROTOCOL_VERSION},
        {"circuitBreaker",   g_circuitBreaker.toJson()},
        {"threadPool",       pool.toJson()},
        {"totalExecutions",       stats::totalExecutions.load()},
        {"failedExecutions",      stats::failedExecutions.load()},
        {"opensslVersion",   getOpenSSLVersion()}
    };

    return {
        {"success", true},
        {"action", "health"},
        {"data", data.dump()},
        {"processingTimeMs", 0}
    };
}

// ============================================================================
// Action: stats
// ============================================================================

static json handleStats(const json& /*input*/) {
    uint64_t total = stats::totalExecutions.load();
    uint64_t failed = stats::failedExecutions.load();
    uint64_t totalTime = stats::totalProcessingTimeMs.load();
    double avgMs = total > 0 ? static_cast<double>(totalTime) / total : 0.0;

    json data = {
        {"engine",              ENGINE_NAME},
        {"version",             ENGINE_VERSION},
        {"protocolVersion",     PROTOCOL_VERSION},
        {"totalExecutions",     total},
        {"failedExecutions",    failed},
        {"successRate",         total > 0
                                    ? static_cast<double>(total - failed) / total * 100.0
                                    : 100.0},
        {"avgProcessingTimeMs", static_cast<double>(static_cast<int>(avgMs * 100)) / 100.0},
        {"totalProcessingTimeMs", totalTime},
        {"validationsPerformed", stats::validationCount.load()},
        {"benchmarksRun",       stats::benchmarkCount.load()},
        {"circuitBreaker",      g_circuitBreaker.toJson()},
        {"threadPool",          getThreadPool().toJson()},
        {"opensslVersion",      getOpenSSLVersion()},
        {"cpuThreads",          std::thread::hardware_concurrency() != 0
                                    ? std::thread::hardware_concurrency() : 4}
    };

    return {
        {"success", true},
        {"action", "stats"},
        {"data", data.dump()},
        {"processingTimeMs", 0}
    };
}

// ============================================================================
// Request Router
// ============================================================================

static json dispatchAction(const json& input) {
    if (!input.contains("action") || !input["action"].is_string()) {
        return {
            {"success", false},
            {"action", "unknown"},
            {"error", "Missing 'action' field in request"}
        };
    }

    const std::string action = input["action"].get<std::string>();

    if (action == "execute")   return handleExecute(input);
    if (action == "validate")  return handleValidate(input);
    if (action == "benchmark") return handleBenchmark(input);
    if (action == "health")    return handleHealth(input);
    if (action == "stats")     return handleStats(input);

    return {
        {"success", false},
        {"action", action},
        {"error", "Unknown action: " + action}
    };
}

// ============================================================================
// Stdin/Stdout JSON I/O
// ============================================================================

/**
 * Read the full stdin into a string.
 * The Node.js bridge pipes the JSON payload and closes stdin.
 */
static std::string readAllStdin() {
    // Switch stdin to binary mode (noop on Unix, needed conceptually)
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::ostringstream oss;
    oss << std::cin.rdbuf();
    return oss.str();
}

/**
 * Main entry point: parse --stdin flag, read JSON, dispatch, write response.
 */
int main(int argc, char* argv[]) {
    // ── Argument check ──────────────────────────────────────────────────
    bool useStdin = false;
    for (int i = 1; i < argc; ++i) {
        if (std::string(argv[i]) == "--stdin") {
            useStdin = true;
            break;
        }
        if (std::string(argv[i]) == "--version" || std::string(argv[i]) == "-v") {
            std::cerr << ENGINE_NAME << " v" << ENGINE_VERSION
                      << " (protocol " << PROTOCOL_VERSION << ")" << std::endl;
            return 0;
        }
        if (std::string(argv[i]) == "--help" || std::string(argv[i]) == "-h") {
            std::cerr << "Usage: beulrock-engine --stdin" << std::endl;
            std::cerr << "       beulrock-engine --version" << std::endl;
            return 0;
        }
    }

    if (!useStdin) {
        std::cerr << "[beulrock-engine] Error: --stdin flag is required." << std::endl;
        std::cerr << "Usage: beulrock-engine --stdin  (reads JSON from stdin, writes to stdout)" << std::endl;
        return 1;
    }

    // ── Read input ──────────────────────────────────────────────────────
    std::string rawInput = readAllStdin();

    if (rawInput.empty()) {
        json errorResp = {
            {"success", false},
            {"action", "none"},
            {"error", "Empty input received on stdin"},
            {"processingTimeMs", 0}
        };
        std::cout << errorResp.dump() << std::endl;
        return 1;
    }

    // ── Parse JSON ──────────────────────────────────────────────────────
    json input;
    try {
        input = json::parse(rawInput);
    } catch (const json::parse_error& e) {
        json errorResp = {
            {"success", false},
            {"action", "none"},
            {"error", std::string("JSON parse error: ") + e.what()},
            {"processingTimeMs", 0}
        };
        std::cout << errorResp.dump() << std::endl;
        return 1;
    }

    // ── Dispatch ────────────────────────────────────────────────────────
    json response;
    try {
        response = dispatchAction(input);
    } catch (const std::exception& e) {
        response = {
            {"success", false},
            {"action", input.value("action", "unknown")},
            {"error", std::string("Internal engine error: ") + e.what()},
            {"processingTimeMs", 0}
        };
    }

    // ── Write response to stdout ────────────────────────────────────────
    std::cout << response.dump() << std::endl;
    return response.value("success", false) ? 0 : 1;
}
