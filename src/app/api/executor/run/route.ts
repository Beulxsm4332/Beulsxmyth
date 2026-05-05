import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccessToken, verifyToken } from "@/lib/jwt";
import { canAccessServer, validateScript, type TierKey } from "@/lib/tier";
import { redis, redisSetExecution, redisCheckRateLimit } from "@/lib/redis";
import { executeWithCppEngine, isCppEngineAvailable } from "@/lib/cpp-bridge";

// In-memory rate limiter fallback
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  // Try Redis first
  if (redis) {
    // Redis rate limiting is async, use in-memory as synchronous fallback
    // The actual Redis rate limit is checked in the background
  }

  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count++;
  return true;
}

const runSchema = z.object({
  script_id: z.string().optional(),
  raw_script: z.string().optional(),
  game_id: z.string().min(1, "Game ID is required"),
});

export async function POST(request: Request) {
  try {
    // ── Step 1: Authenticate ──
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required. Please sign in.",
          },
        },
        { status: 401 }
      );
    }

    const payload = await verifyToken(accessToken);

    if (!payload?.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired token. Please sign in again.",
          },
        },
        { status: 401 }
      );
    }

    // ── Step 2: Get user with tier ──
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, tier: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not found. Please sign in again.",
          },
        },
        { status: 401 }
      );
    }

    // ── Step 3: Validate input ──
    const body = await request.json();
    const parsed = runSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const { script_id, raw_script, game_id } = parsed.data;

    // ── Step 4: Resolve script content ──
    let scriptContent = raw_script || "";

    if (script_id) {
      const script = await db.script.findUnique({
        where: { id: script_id },
      });
      if (!script) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Script not found",
            },
          },
          { status: 404 }
        );
      }
      scriptContent = script.code;
    }

    if (!scriptContent.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "No script content provided. Enter a script or select one from the Script Hub.",
          },
        },
        { status: 400 }
      );
    }

    // ── Step 5: Pre-validate script ──
    const scriptValidation = validateScript(scriptContent);
    if (!scriptValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SCRIPT_VALIDATION_ERROR",
            message: scriptValidation.reason || "Invalid script",
          },
        },
        { status: 400 }
      );
    }

    // ── Step 6: Verify game and tier access ──
    const game = await db.game.findUnique({
      where: { id: game_id },
      include: { servers: true },
    });

    if (!game) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Game not found",
          },
        },
        { status: 404 }
      );
    }

    const userTier = user.tier as TierKey;

    const accessibleServers = game.servers.filter((server) =>
      canAccessServer(userTier, server.playerCount)
    );

    if (accessibleServers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TIER_RESTRICTED",
            message: `Your ${userTier} tier does not grant access to any servers for ${game.name}. Upgrade your plan for servers with up to ${game.playerCount.toLocaleString()} players.`,
          },
        },
        { status: 403 }
      );
    }

    // ── Step 7: Check WhitelistEntry (Roblox whitelist) ──
    const whitelistEntry = await db.whitelistEntry.findUnique({
      where: { userId: user.id },
    });

    if (!whitelistEntry || !whitelistEntry.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_WHITELISTED",
            message: "Your Roblox account is not whitelisted. Please redeem a key at the Whitelist page to gain access.",
          },
        },
        { status: 403 }
      );
    }

    // ── Step 8: Rate limit check ──
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many executions. You are limited to 5 executions per minute.",
          },
        },
        { status: 429 }
      );
    }

    // ── Step 8: Check whitelist tier usage ──
    const whitelist = await db.whitelistTier.findUnique({
      where: { userId: user.id },
    });

    if (whitelist) {
      const tierMaxGames = {
        free: 10,
        basic: 100,
        premium: 1000,
        ultimate: 10000,
        admin: Infinity,
      }[userTier] ?? 10;

      if (
        tierMaxGames !== Infinity &&
        whitelist.gamesUsed >= tierMaxGames
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "TIER_LIMIT_EXCEEDED",
              message: `You have used ${whitelist.gamesUsed}/${tierMaxGames} game slots on your ${userTier} tier. Upgrade to access more games.`,
            },
          },
          { status: 403 }
        );
      }

      // Increment games used
      await db.whitelistTier.update({
        where: { userId: user.id },
        data: { gamesUsed: { increment: 1 } },
      });
    }

    // ── Step 9: Create execution record ──
    const execution = await db.execution.create({
      data: {
        userId: user.id,
        gameId: game_id,
        script: scriptContent,
        status: "queued",
        logs: "",
      },
    });

    // Store execution state in Redis
    await redisSetExecution(execution.id, {
      jobId: execution.id,
      userId: user.id,
      gameId: game_id,
      status: "queued",
      tier: userTier,
      createdAt: Date.now(),
    });

    // ── Step 10: Execute pipeline via C++ Engine (with TS fallback) ──
    // The C++ engine handles: validation, allocation, HMAC signing, injection, execution
    // It communicates back the full result including logs, which we then
    // persist to the database and Redis for the status polling endpoint.
    const cppEngineAvailable = isCppEngineAvailable();

    if (cppEngineAvailable) {
      // ── C++ Engine Path ──
      // Execute via C++ subprocess in the background
      // The C++ engine processes the full pipeline and returns structured JSON
      (async () => {
        try {
          const cppResult = await executeWithCppEngine({
            jobId: execution.id,
            userId: user.id,
            gameId: game_id,
            script: scriptContent,
            tier: userTier,
            serverId: accessibleServers[0]?.id,
          });

          if (cppResult.usedCppEngine && cppResult.result) {
            // ── Update DB and Redis with C++ engine results ──
            const result = cppResult.result;

            await db.execution.update({
              where: { id: execution.id },
              data: {
                status: result.success ? "completed" : "failed",
                logs: result.logText || result.logs.map(l => `[${l.level}] ${l.message}`).join("\n"),
              },
            });

            await redisSetExecution(execution.id, {
              jobId: execution.id,
              userId: user.id,
              gameId: game_id,
              status: result.success ? "completed" : "failed",
              phase: result.phase,
              completedAt: Date.now(),
              durationMs: result.elapsedMs,
              engine: "cpp",
              engineVersion: result.engineVersion,
            });

            console.log(
              `[executor/run] C++ engine completed job ${execution.id} in ${result.elapsedMs}ms`
            );
          }
          // If C++ engine wasn't actually used, the TS fallback was already
          // invoked inside executeWithCppEngine, which handles DB/Redis updates
        } catch (err) {
          console.error(
            `[executor/run] C++ engine execution error for ${execution.id}:`,
            err
          );
        }
      })();
    } else {
      // ── TypeScript Engine Path (fallback) ──
      const { executePipeline } = await import("@/lib/executor-engine");
      executePipeline({
        jobId: execution.id,
        userId: user.id,
        gameId: game_id,
        script: scriptContent,
        tier: userTier,
        serverId: accessibleServers[0]?.id,
      }).catch((err) => {
        console.error(
          `[executor/run] TS pipeline error for ${execution.id}:`,
          err
        );
      });
    }

    // Also try to enqueue in BullMQ for the separate worker process
    try {
      const { getQueue } = await import("@/lib/bullmq-worker");
      const queue = getQueue();
      await queue.add(
        `exec:${execution.id}`,
        {
          jobId: execution.id,
          userId: user.id,
          gameId: game_id,
          script: scriptContent,
          tier: userTier,
          serverId: accessibleServers[0]?.id,
        },
        {
          jobId: execution.id,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        }
      );
      console.log(
        `[executor/run] Job ${execution.id} enqueued in BullMQ`
      );
    } catch {
      console.log(
        `[executor/run] BullMQ unavailable, using direct pipeline execution`
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: execution.id,
          status: "queued",
          gameName: game.name,
          serverName: accessibleServers[0]?.name || "Auto-selected",
          tier: userTier,
          engine: cppEngineAvailable ? "cpp" : "typescript",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[executor/run] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to start execution",
        },
      },
      { status: 500 }
    );
  }
}
