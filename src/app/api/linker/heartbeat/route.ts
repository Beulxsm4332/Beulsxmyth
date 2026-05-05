import { NextRequest, NextResponse } from "next/server";
import { verifyLinkerSignature } from "@/lib/server-linker";
import { redis, redisSetStatsField, redisIncrementStats } from "@/lib/redis";
import { db } from "@/lib/db";

/**
 * POST /api/linker/heartbeat
 *
 * Receives heartbeat signals from Roblox game server linkers.
 * This endpoint matches the Lua linker's heartbeat schema:
 *   { serverId, gameId, playerCount, maxPlayers, status, activeExecutions,
 *     totalExecutions, failedExecutions, circuitBreaker, uptime,
 *     protocolVersion, signature, timestamp, nonce }
 *
 * The heartbeat is HMAC-SHA256 signed for authentication.
 * Server status is updated in Redis for real-time dashboard display.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      serverId,
      gameId,
      playerCount,
      maxPlayers,
      status,
      activeExecutions,
      totalExecutions,
      failedExecutions,
      circuitBreaker,
      uptime,
      protocolVersion,
      signature,
      timestamp,
      nonce,
    } = body;

    if (!serverId || !gameId || !signature || !timestamp || !nonce) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_PARAMS", message: "serverId, gameId, signature, timestamp, nonce are required" } },
        { status: 400 }
      );
    }

    // ── Verify HMAC-SHA256 signature ──
    const verification = verifyLinkerSignature({
      signature,
      timestamp,
      nonce,
      serverId,
      gameId,
      jobId: "heartbeat",
    });

    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_SIGNATURE", message: verification.reason } },
        { status: 401 }
      );
    }

    // ── Update server status in Redis ──
    const serverStatusKey = `server:status:${serverId}`;
    if (redis) {
      await redis.setex(serverStatusKey, 60, JSON.stringify({
        serverId,
        gameId,
        playerCount: playerCount || 0,
        maxPlayers: maxPlayers || 50,
        status: status || "online",
        activeExecutions: activeExecutions || 0,
        totalExecutions: totalExecutions || 0,
        failedExecutions: failedExecutions || 0,
        circuitBreaker: circuitBreaker || { state: "closed" },
        uptime: uptime || 0,
        protocolVersion: protocolVersion || "2.0",
        lastHeartbeat: Date.now(),
      }));

      // Update global stats
      await redisSetStatsField("linker_servers_online", String(await redis.keys("server:status:*")).length);
      await redisIncrementStats("linker_heartbeats_total");
    }

    // ── Update game server in database ──
    try {
      const gameRecord = await db.game.findFirst({
        where: { placeId: gameId },
      });

      if (gameRecord) {
        const existingServer = await db.server.findFirst({
          where: { gameId: gameRecord.id, name: serverId },
        });

        if (existingServer) {
          await db.server.update({
            where: { id: existingServer.id },
            data: {
              playerCount: playerCount || 0,
              status: status === "online" ? "online" : "offline",
            },
          });
        } else {
          await db.server.create({
            data: {
              gameId: gameRecord.id,
              name: serverId,
              status: status === "online" ? "online" : "offline",
              playerCount: playerCount || 0,
            },
          });
        }
      }
    } catch (dbError) {
      // Non-critical — heartbeat should not fail if DB update fails
      console.warn("[linker/heartbeat] DB update failed:", dbError);
    }

    // ── Check for pending executions to deliver ──
    let pendingCount = 0;
    try {
      const pending = await db.execution.count({
        where: { gameId, status: "queued" },
      });
      pendingCount = pending;
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      data: {
        acknowledged: true,
        serverId,
        pendingExecutions: pendingCount,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("[linker/heartbeat] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Heartbeat processing failed" } },
      { status: 500 }
    );
  }
}
