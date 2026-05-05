import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyLinkerSignature } from "@/lib/server-linker";

/**
 * GET /api/executor/pending
 *
 * Returns queued executions for a specific game server.
 * The Roblox Lua linker polls this endpoint every 5 seconds
 * to pick up new execution requests from the web dashboard.
 *
 * Query params:
 *   serverId — The game server's unique identifier
 *   gameId   — The game ID to filter executions for
 *
 * The request must include HMAC-SHA256 signature headers
 * for authentication (same protocol as linker callbacks).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");
    const gameId = searchParams.get("gameId");

    if (!serverId) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_SERVER_ID", message: "serverId is required" } },
        { status: 400 }
      );
    }

    // ── Verify HMAC-SHA256 signature from linker ──
    // Roblox HttpService does NOT support custom headers, so the Lua linker
    // sends signature via query params: ?signature=...&timestamp=...&nonce=...
    // We also check headers for non-Roblox clients (C++ engine, etc.)
    const signature =
      searchParams.get("signature") ||
      request.headers.get("X-Beulrock-Signature");
    const timestamp =
      searchParams.get("timestamp") ||
      request.headers.get("X-Beulrock-Timestamp");
    const nonce =
      searchParams.get("nonce") ||
      request.headers.get("X-Beulrock-Nonce");

    // If signature params are present, verify them
    // (Support both authenticated and studio/dev mode without signature)
    if (signature && timestamp && nonce) {
      const verification = verifyLinkerSignature({
        signature,
        timestamp,
        nonce,
        serverId,
        gameId: gameId || "pending",
        jobId: "poll",
      });

      if (!verification.valid) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_SIGNATURE", message: verification.reason } },
          { status: 401 }
        );
      }
    }

    // ── Find pending executions ──
    // Look for executions in "queued" status that haven't been picked up yet
    const pendingExecutions = await db.execution.findMany({
      where: {
        status: "queued",
        ...(gameId ? { gameId } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 10, // Max 10 executions per poll
    });

    // ── Mark them as "running" so they don't get picked up again ──
    const executionIds = pendingExecutions.map((e) => e.id);

    if (executionIds.length > 0) {
      await db.execution.updateMany({
        where: { id: { in: executionIds } },
        data: { status: "running" },
      });
    }

    // ── Format executions for the Lua linker ──
    // The linker expects HMAC-signed payloads with script content
    const LINKER_SECRET = process.env.LINKER_SECRET || "beulrock_linker_hmac_secret_key_2024";
    const crypto = await import("crypto");

    // ── Filter: Only deliver executions from whitelisted users ──
    const whitelistedUserIds = new Set(
      (await db.whitelistEntry.findMany({
        where: { isActive: true },
        select: { userId: true },
      })).map(w => w.userId)
    );

    const filteredExecutions = pendingExecutions.filter(exec => whitelistedUserIds.has(exec.userId));

    const formattedExecutions = filteredExecutions.map((exec) => {
      const now = Date.now().toString();
      const nonceVal = crypto.randomUUID();

      const canonicalRequest = [serverId, exec.gameId, exec.id, now, nonceVal].join(":");
      const sig = crypto.createHmac("sha256", LINKER_SECRET).update(canonicalRequest).digest("hex");

      // Get the user's tier for access control
      return {
        executionId: exec.id,
        jobId: exec.id,
        userId: exec.userId,
        gameId: exec.gameId,
        script: exec.script,
        signature: sig,
        timestamp: now,
        nonce: nonceVal,
        createdAt: exec.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        serverId,
        count: formattedExecutions.length,
        executions: formattedExecutions,
      },
    });
  } catch (error) {
    console.error("[executor/pending] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch pending executions" } },
      { status: 500 }
    );
  }
}
