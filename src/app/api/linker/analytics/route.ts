import { NextRequest, NextResponse } from "next/server";
import { verifyLinkerSignature } from "@/lib/server-linker";
import { db } from "@/lib/db";
import { redis, redisIncrementStats } from "@/lib/redis";

/**
 * POST /api/linker/analytics
 *
 * Receives analytics events from the Roblox game server linker.
 * This allows the game to report real-time metrics back to the
 * web platform for the dashboard.
 *
 * Payload:
 *   { serverId, gameId, events: [...], signature, timestamp, nonce }
 *
 * Each event:
 *   { type: "execution_complete" | "player_join" | "player_leave" |
 *           "error" | "performance" | "module_load",
 *     data: { ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverId, gameId, events, signature, timestamp, nonce } = body;

    if (!serverId || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "serverId and events array are required" } },
        { status: 400 }
      );
    }

    // ── Verify HMAC-SHA256 signature if provided ──
    if (signature && timestamp && nonce) {
      const verification = verifyLinkerSignature({
        signature,
        timestamp,
        nonce,
        serverId,
        gameId: gameId || "analytics",
        jobId: "analytics",
      });

      if (!verification.valid) {
        // Log but don't reject — analytics should be best-effort
        console.warn("[linker/analytics] Invalid signature from", serverId);
      }
    }

    // ── Process each event ──
    let processedCount = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        // Store in database
        await db.analyticsEvent.create({
          data: {
            event: event.type || "linker_event",
            metadata: {
              serverId,
              gameId: gameId || "unknown",
              ...event.data,
            },
            ip: serverId, // Use serverId as identifier
            userId: event.data?.userId,
          },
        });

        // Update real-time stats in Redis
        if (redis) {
          switch (event.type) {
            case "execution_complete":
              await redisIncrementStats("linker_executions_completed");
              break;
            case "execution_failed":
              await redisIncrementStats("linker_executions_failed");
              break;
            case "player_join":
              await redisIncrementStats("linker_player_joins");
              break;
            case "player_leave":
              await redisIncrementStats("linker_player_leaves");
              break;
            case "module_load":
              await redisIncrementStats("linker_modules_loaded");
              break;
            case "error":
              await redisIncrementStats("linker_errors");
              break;
          }
        }

        processedCount++;
      } catch (err) {
        errors.push(`Failed to process event: ${event.type}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("[linker/analytics] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Analytics processing failed" } },
      { status: 500 }
    );
  }
}
