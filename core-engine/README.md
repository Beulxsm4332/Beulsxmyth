# Beulrock C++ Core Engine

A high-performance execution engine binary written in C++17 that serves as the compute backend for the Beulrock platform. It communicates with the Next.js application via **JSON-over-stdin/stdout** using the `--stdin` protocol.

## Architecture

```
Next.js API Route  →  cpp-bridge.ts  →  child_process  →  beulrock-engine (C++)
                                                    ↕ JSON via stdin/stdout
```

If the C++ binary is unavailable, `cpp-bridge.ts` falls back to the TypeScript engine (`executor-engine.ts`).

## Supported Actions

| Action      | Description                                              |
|-------------|----------------------------------------------------------|
| `execute`   | Multi-phase script execution pipeline (validate → allocate → inject → run → complete) |
| `validate`  | Lua script validation (size, blocked patterns, SHA-256)  |
| `benchmark` | Crypto & multi-threaded performance benchmarks           |
| `health`    | Health check with circuit breaker & thread pool status   |
| `stats`     | Cumulative engine statistics                             |

## Protocol

**Input** (write to stdin):

```json
{
  "action": "health",
  "jobId": "optional",
  "script": "optional",
  ...
}
```

**Output** (read from stdout):

```json
{
  "success": true,
  "action": "health",
  "data": "{ ... JSON-encoded result ... }",
  "processingTimeMs": 2
}
```

## Dependencies

- **C++17** (GCC 8+, Clang 7+, MSVC 2019+)
- **OpenSSL 1.1.1+ / 3.x** — EVP APIs for SHA-256 and HMAC-SHA256
- **nlohmann/json** — Header-only JSON library (v3.11.3)
- **pthreads** — POSIX threading

## Building

### Prerequisites

```bash
# Ubuntu/Debian
sudo apt-get install -y cmake libssl-dev

# macOS
brew install cmake openssl
```

### Fetch nlohmann/json

Option A — vendored single-header (used by CI):

```bash
mkdir -p include/nlohmann
curl -L https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp \
     -o include/nlohmann/json.hpp
```

Option B — let CMake FetchContent download it automatically.

### Build

```bash
cd core-engine
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . -j$(nproc)
```

The binary will be at `build/beulrock-engine`.

### Quick test

```bash
echo '{"action":"health"}' | ./build/beulrock-engine --stdin
```

## Key Features

- **Circuit Breaker** — Tracks consecutive failures; opens after 5 failures, auto-resets after 60 s
- **Thread Pool** — Sized to hardware concurrency for parallel benchmark workloads
- **OpenSSL EVP API** — Uses the modern non-deprecated EVP interface (not `HMAC()` or `SHA256()`)
- **Atomic Statistics** — Lock-free counters for executions, failures, and processing time
- **Pattern Detection** — Mirrors the TypeScript validation rules (blocked Lua patterns)

## Version

- Engine: **v1.0.0**
- Protocol: **v2.0**
