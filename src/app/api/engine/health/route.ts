import { NextResponse } from "next/server";
import {
  checkCppEngineHealth,
  getEngineIntegrationInfo,
} from "@/lib/cpp-bridge";

/**
 * GET /api/engine/health
 *
 * Health check for the C++ CoreEngineExecutor.
 * Returns engine availability, version info, circuit breaker state,
 * thread pool status, and OpenSSL version.
 */
export async function GET() {
  try {
    const integrationInfo = getEngineIntegrationInfo();
    const healthResult = await checkCppEngineHealth();

    return NextResponse.json({
      success: true,
      data: {
        cppEngine: {
          available: healthResult.available,
          healthy: healthResult.result?.status === "healthy",
          version: healthResult.result?.version || "N/A",
          protocol: healthResult.result?.protocol || "N/A",
          opensslVersion: healthResult.result?.opensslVersion || "N/A",
          circuitBreaker: healthResult.result?.circuitBreaker || null,
          threadPool: healthResult.result?.threadPool || null,
          totalExecutions: healthResult.result?.totalExecutions || 0,
          failedExecutions: healthResult.result?.failedExecutions || 0,
        },
        integration: integrationInfo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[engine/health] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ENGINE_ERROR",
          message: "Failed to check engine health",
        },
      },
      { status: 500 }
    );
  }
}
