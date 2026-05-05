import { NextRequest, NextResponse } from "next/server";
import { verifyLinkerSignature } from "@/lib/server-linker";
import { db } from "@/lib/db";
import { broadcastToUser } from "@/lib/websocket-server";
import { redisUpdateExecution } from "@/lib/redis";

/**
 * POST /api/linker/callback
 * 
 * Receives execution results from server linkers.
 * Verifies HMAC-SHA256 signature and anti-replay timestamp.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signature, timestamp, nonce, serverId, gameId, jobId, status, output, error } = body;

    if (!signature || !timestamp || !nonce || !serverId || !gameId || !jobId) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_PARAMS", message: "Missing required parameters" } },
        { status: 400 }
      );
    }

    // Verify the HMAC-SHA256 signature
    const verification = verifyLinkerSignature({
      signature,
      timestamp,
      nonce,
      serverId,
      gameId,
      jobId,
    });

    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_SIGNATURE", message: verification.reason } },
        { status: 401 }
      );
    }

    // Find the execution
    const execution = await db.execution.findUnique({
      where: { id: jobId },
    });

    if (!execution) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Execution not found" } },
        { status: 404 }
      );
    }

    // Update execution based on callback status
    if (status === "completed") {
      await db.execution.update({
        where: { id: jobId },
        data: {
          status: "completed",
          logs: output || execution.logs,
        },
      });

      await redisUpdateExecution(jobId, { status: "completed", completedAt: Date.now() });
    } else if (status === "failed") {
      await db.execution.update({
        where: { id: jobId },
        data: {
          status: "failed",
          logs: error || "Execution failed on server",
        },
      });

      await redisUpdateExecution(jobId, { status: "failed", failedAt: Date.now(), error });
    }

    // Notify user via WebSocket
    broadcastToUser(execution.userId, `execution:${execution.userId}`, {
      jobId,
      status: status === "completed" ? "completed" : "failed",
      logs: output || error || "",
    });

    return NextResponse.json({ success: true, data: { acknowledged: true } });
  } catch (error) {
    console.error("[linker/callback] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Callback processing failed" } },
      { status: 500 }
    );
  }
}
