/**
 * ============================================================================
 * Beulrock Serverside — C++ Engine Bridge (Node.js ↔ C++ Subprocess)
 * ============================================================================
 *
 * This module provides the integration layer between the Next.js backend
 * and the C++ CoreEngineExecutor binary. It handles:
 *
 *   - Spawning the C++ engine as a subprocess
 *   - JSON I/O communication via stdin/stdout
 *   - Binary path resolution (development + production)
 *   - Graceful fallback to TypeScript engine if C++ unavailable
 *   - Performance metrics collection
 *   - Error handling and timeout management
 *
 * Architecture:
 *
 *   Next.js API Route → cpp-bridge.ts → child_process → beulrock-engine (C++)
 *                                         ↕ JSON via stdin/stdout
 *   If C++ binary unavailable → falls back to executor-engine.ts (TypeScript)
 *
 * ============================================================================
 */

import { execFile, spawn } from "child_process";
import path from "path";
import fs from "fs";
import { executePipeline as tsExecutePipeline } from "./executor-engine";
import type { TierKey } from "./tier";

// ── Types ──

interface CppEngineInput {
  action: "execute" | "validate" | "benchmark" | "health" | "stats";
  jobId?: string;
  userId?: string;
  gameId?: string;
  script?: string;
  tier?: string;
  serverId?: string;
  linkerSecret?: string;
  linkerBaseUrl?: string;
  linkerMode?: string;
}

interface CppEngineOutput {
  success: boolean;
  action: string;
  data: string; // JSON-encoded result
  error?: string;
  processingTimeMs: number;
}

interface CppExecutionResult {
  jobId: string;
  phase: string;
  progress: number;
  logs: Array<{
    timestamp: string;
    phase: string;
    level: string;
    message: string;
  }>;
  logText: string;
  elapsedMs: number;
  success: boolean;
  error?: string;
  engine: "cpp";
  engineVersion: string;
  protocolVersion: string;
}

interface CppValidationResult {
  valid: boolean;
  reason?: string;
  scriptSize: number;
  sha256Hash: string;
}

interface CppBenchmarkResult {
  engine: string;
  version: string;
  iterations: number;
  benchmarks: {
    hmacSha256: { totalMs: number; perOpUs: number };
    sha256: { totalMs: number; perOpUs: number };
    scriptValidation: { totalMs: number; perOpUs: number };
    multiThreaded: { totalMs: number; threads: number; perOpUs: number };
  };
  system: {
    cpuThreads: number;
    opensslVersion: string;
  };
}

interface CppHealthResult {
  status: string;
  engine: string;
  version: string;
  protocol: string;
  circuitBreaker: {
    state: string;
    failureCount: number;
    successCount: number;
    failureThreshold: number;
    resetTimeoutSec: number;
  };
  threadPool: {
    activeWorkers: number;
    pendingTasks: number;
  };
  totalExecutions: number;
  failedExecutions: number;
  opensslVersion: string;
}

// ── Binary Path Resolution ──

const ENGINE_BINARY_NAME =
  process.platform === "win32" ? "beulrock-engine.exe" : "beulrock-engine";

function resolveEnginePath(): string | null {
  // Priority order for finding the C++ engine binary:
  // 1. ENGINE_PATH environment variable
  // 2. Project root core-engine/bin/
  // 3. Project root core-engine/build/
  // 4. /usr/local/bin/ (system install)

  const envPath = process.env.ENGINE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const projectRoot =
    process.env.NODE_ENV === "production"
      ? path.join(process.cwd())
      : path.join(process.cwd());

  const candidates = [
    path.join(projectRoot, "core-engine", "bin", ENGINE_BINARY_NAME),
    path.join(projectRoot, "core-engine", "build", ENGINE_BINARY_NAME),
    path.join(projectRoot, "bin", ENGINE_BINARY_NAME),
    `/usr/local/bin/${ENGINE_BINARY_NAME}`,
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// Cache the resolved path
let cachedEnginePath: string | null | undefined = undefined;

function getEnginePath(): string | null {
  if (cachedEnginePath !== undefined) return cachedEnginePath;
  cachedEnginePath = resolveEnginePath();
  if (cachedEnginePath) {
    console.log(`[CppBridge] Engine binary found: ${cachedEnginePath}`);
  } else {
    console.warn(
      "[CppBridge] C++ engine binary not found. Falling back to TypeScript engine."
    );
  }
  return cachedEnginePath;
}

// ── Engine Availability Check ──

let engineAvailable: boolean | null = null;

export function isCppEngineAvailable(): boolean {
  if (engineAvailable !== null) return engineAvailable;
  const enginePath = getEnginePath();
  engineAvailable = enginePath !== null;
  return engineAvailable;
}

// ── Core Communication Function ──

const EXECUTION_TIMEOUT = 120000; // 120 seconds max for any C++ operation

function callCppEngine(input: CppEngineInput): Promise<CppEngineOutput> {
  return new Promise((resolve, reject) => {
    const enginePath = getEnginePath();
    if (!enginePath) {
      reject(new Error("C++ engine binary not available"));
      return;
    }

    const inputJson = JSON.stringify(input);
    let stdout = "";
    let stderr = "";

    const child = spawn(enginePath, ["--stdin"], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: EXECUTION_TIMEOUT,
    });

    // Handle stdout
    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    // Handle stderr
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle completion
    child.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(
          new Error(
            `C++ engine exited with code ${code}: ${stderr.trim() || "No output"}`
          )
        );
        return;
      }

      try {
        const output: CppEngineOutput = JSON.parse(stdout.trim());
        resolve(output);
      } catch (err) {
        reject(
          new Error(
            `Failed to parse C++ engine output: ${stdout.substring(0, 500)}`
          )
        );
      }
    });

    // Handle errors
    child.on("error", (err) => {
      reject(new Error(`C++ engine spawn error: ${err.message}`));
    });

    // Send input via stdin
    child.stdin.write(inputJson);
    child.stdin.end();
  });
}

// ── Public API ──

/**
 * Execute a script using the C++ engine (with TypeScript fallback)
 */
export async function executeWithCppEngine(params: {
  jobId: string;
  userId: string;
  gameId: string;
  script: string;
  tier: TierKey;
  serverId?: string;
}): Promise<{
  usedCppEngine: boolean;
  result?: CppExecutionResult;
  error?: string;
}> {
  // Try C++ engine first
  if (isCppEngineAvailable()) {
    try {
      const input: CppEngineInput = {
        action: "execute",
        jobId: params.jobId,
        userId: params.userId,
        gameId: params.gameId,
        script: params.script,
        tier: params.tier,
        serverId: params.serverId,
        linkerSecret:
          process.env.LINKER_SECRET ||
          "beulrock_linker_hmac_secret_key_2024",
        linkerBaseUrl:
          process.env.LINKER_BASE_URL ||
          "https://linker.beulrock.internal",
        linkerMode: process.env.LINKER_MODE || "demo",
      };

      const output = await callCppEngine(input);

      if (output.success) {
        const result: CppExecutionResult = JSON.parse(output.data);
        console.log(
          `[CppBridge] Execution ${params.jobId} completed via C++ engine in ${output.processingTimeMs}ms`
        );
        return { usedCppEngine: true, result };
      } else {
        console.warn(
          `[CppBridge] C++ engine returned error: ${output.error}. Falling back to TS engine.`
        );
      }
    } catch (err) {
      console.warn(
        `[CppBridge] C++ engine call failed: ${err instanceof Error ? err.message : err}. Falling back to TS engine.`
      );
    }
  }

  // Fallback: Use TypeScript engine
  console.log(
    `[CppBridge] Using TypeScript engine for execution ${params.jobId}`
  );

  // The TS engine handles its own DB/Redis updates via executePipeline
  await tsExecutePipeline({
    jobId: params.jobId,
    userId: params.userId,
    gameId: params.gameId,
    script: params.script,
    tier: params.tier,
    serverId: params.serverId,
  });

  return { usedCppEngine: false };
}

/**
 * Validate a script using the C++ engine
 */
export async function validateWithCppEngine(
  script: string
): Promise<{
  usedCppEngine: boolean;
  valid: boolean;
  reason?: string;
  scriptSize?: number;
  sha256Hash?: string;
}> {
  if (isCppEngineAvailable()) {
    try {
      const input: CppEngineInput = {
        action: "validate",
        script,
      };

      const output = await callCppEngine(input);

      if (output.success) {
        const result: CppValidationResult = JSON.parse(output.data);
        return {
          usedCppEngine: true,
          valid: result.valid,
          reason: result.reason,
          scriptSize: result.scriptSize,
          sha256Hash: result.sha256Hash,
        };
      }
    } catch (err) {
      console.warn(
        `[CppBridge] C++ validation failed, using TS fallback: ${err}`
      );
    }
  }

  // Fallback to TS validation
  const { validateScript } = await import("./tier");
  const result = validateScript(script);
  return {
    usedCppEngine: false,
    valid: result.valid,
    reason: result.reason,
  };
}

/**
 * Run performance benchmark using the C++ engine
 */
export async function runCppBenchmark(): Promise<{
  usedCppEngine: boolean;
  result?: CppBenchmarkResult;
  error?: string;
}> {
  if (!isCppEngineAvailable()) {
    return {
      usedCppEngine: false,
      error: "C++ engine binary not available for benchmarking",
    };
  }

  try {
    const input: CppEngineInput = { action: "benchmark" };
    const output = await callCppEngine(input);

    if (output.success) {
      const result: CppBenchmarkResult = JSON.parse(output.data);
      return { usedCppEngine: true, result };
    }

    return { usedCppEngine: true, error: output.error };
  } catch (err) {
    return {
      usedCppEngine: true,
      error: err instanceof Error ? err.message : "Benchmark failed",
    };
  }
}

/**
 * Health check for the C++ engine
 */
export async function checkCppEngineHealth(): Promise<{
  available: boolean;
  result?: CppHealthResult;
  error?: string;
}> {
  if (!isCppEngineAvailable()) {
    return { available: false, error: "C++ engine binary not found" };
  }

  try {
    const input: CppEngineInput = { action: "health" };
    const output = await callCppEngine(input);

    if (output.success) {
      const result: CppHealthResult = JSON.parse(output.data);
      return { available: true, result };
    }

    return { available: false, error: output.error };
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : "Health check failed",
    };
  }
}

/**
 * Get C++ engine statistics
 */
export async function getCppEngineStats(): Promise<{
  available: boolean;
  stats?: Record<string, unknown>;
  error?: string;
}> {
  if (!isCppEngineAvailable()) {
    return { available: false, error: "C++ engine binary not found" };
  }

  try {
    const input: CppEngineInput = { action: "stats" };
    const output = await callCppEngine(input);

    if (output.success) {
      const stats = JSON.parse(output.data);
      return { available: true, stats };
    }

    return { available: true, error: output.error };
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : "Stats request failed",
    };
  }
}

/**
 * Reset the cached engine path (useful after building)
 */
export function resetEnginePathCache(): void {
  cachedEnginePath = undefined;
  engineAvailable = null;
}

/**
 * Get info about the C++ engine integration status
 */
export function getEngineIntegrationInfo(): {
  cppAvailable: boolean;
  enginePath: string | null;
  platform: string;
  arch: string;
} {
  return {
    cppAvailable: isCppEngineAvailable(),
    enginePath: getEnginePath(),
    platform: process.platform,
    arch: process.arch,
  };
}
