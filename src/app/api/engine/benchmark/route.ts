import { NextResponse } from "next/server";
import { runCppBenchmark, getEngineIntegrationInfo } from "@/lib/cpp-bridge";

/**
 * GET /api/engine/benchmark
 *
 * Run performance benchmarks on the C++ CoreEngineExecutor.
 * Tests HMAC-SHA256 signing speed, SHA256 hashing, script validation,
 * and multi-threaded execution performance.
 *
 * Returns metrics in microseconds per operation for comparison
 * with other language implementations.
 */
export async function GET() {
  try {
    const integrationInfo = getEngineIntegrationInfo();

    if (!integrationInfo.cppAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ENGINE_UNAVAILABLE",
            message:
              "C++ engine binary not available. Build the engine first: cd core-engine && make",
          },
        },
        { status: 503 }
      );
    }

    const benchResult = await runCppBenchmark();

    if (!benchResult.usedCppEngine || !benchResult.result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BENCHMARK_FAILED",
            message: benchResult.error || "Benchmark execution failed",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        engine: benchResult.result.engine,
        version: benchResult.result.version,
        iterations: benchResult.result.iterations,
        benchmarks: benchResult.result.benchmarks,
        system: benchResult.result.system,
        comparison: {
          note: "C++ native performance vs Node.js interpreted performance",
          expectedImprovement: {
            hmacSha256: "~3-5x faster than Node.js crypto",
            sha256: "~2-4x faster than Node.js crypto",
            scriptValidation: "~5-10x faster than RegExp matching",
            multiThreaded: "~4-8x faster than Node.js single-threaded (true parallelism)",
          },
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[engine/benchmark] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Benchmark execution failed",
        },
      },
      { status: 500 }
    );
  }
}
