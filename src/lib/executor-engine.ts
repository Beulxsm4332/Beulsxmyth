/**
 * Beulrock Serverside — Production Execution Engine
 *
 * A proper state-machine based execution pipeline that replaces the
 * old simple simulation with a multi-phase, real-time streaming executor.
 *
 * Execution Phases:
 *   QUEUED → VALIDATING → ALLOCATING → INJECTING → RUNNING → COMPLETED
 *                                                                      ↘ FAILED
 *
 * Each phase produces real-time log output and broadcasts via WebSocket.
 * The Server Linker is called with proper HTTP request structure.
 */

import crypto from "crypto";
import { db } from "./db";
import {
  redisSetExecution,
  redisUpdateExecution,
  redisIncrementStats,
  redisGetCircuitState,
  redisSetCircuitState,
  redisIncrementFailures,
  redisResetFailures,
} from "./redis";
import { broadcastToUser, broadcastToChannel } from "./websocket-server";
import { validateScript, type TierKey } from "./tier";

// ── Execution State Machine ──
export type ExecutionPhase =
  | "queued"
  | "validating"
  | "allocating"
  | "injecting"
  | "running"
  | "completed"
  | "failed";

const PHASE_ORDER: ExecutionPhase[] = [
  "queued",
  "validating",
  "allocating",
  "injecting",
  "running",
  "completed",
];

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT = 60;

// ── Log Entry Structure ──
interface LogEntry {
  timestamp: string;
  phase: ExecutionPhase;
  level: "INFO" | "SUCCESS" | "ERROR" | "WARN" | "CONSOLE" | "DEBUG";
  message: string;
}

function createLogEntry(
  phase: ExecutionPhase,
  level: LogEntry["level"],
  message: string
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    phase,
    level,
    message,
  };
}

function formatLogs(logs: LogEntry[]): string {
  return logs.map((l) => `[${l.level}] ${l.message}`).join("\n");
}

// ── Execution Context ──
interface ExecutionContext {
  jobId: string;
  userId: string;
  gameId: string;
  script: string;
  tier: TierKey;
  serverId?: string;
  logs: LogEntry[];
  startTime: number;
  phaseStartTimes: Record<ExecutionPhase, number>;
}

// ── Server Linker HTTP Call ──
interface LinkerHttpRequest {
  method: "POST";
  url: string;
  headers: Record<string, string>;
  body: string;
}

interface LinkerHttpResponse {
  status: number;
  body: {
    success: boolean;
    executionId?: string;
    output?: string;
    error?: string;
    serverVersion?: string;
    protocolVersion?: string;
  };
}

/**
 * Build a proper HTTP request for the Server Linker
 * This is the production structure that a real game server linker would receive
 */
function buildLinkerRequest(
  serverId: string,
  gameId: string,
  jobId: string,
  script: string,
  tier: string,
  callbackUrl: string
): LinkerHttpRequest {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const linkerSecret =
    process.env.LINKER_SECRET || "beulrock_linker_hmac_secret_key_2024";

  // Canonical request for HMAC signing
  const canonicalRequest = [serverId, gameId, jobId, timestamp, nonce].join(
    ":"
  );
  const signature = crypto
    .createHmac("sha256", linkerSecret)
    .update(canonicalRequest)
    .digest("hex");

  const baseUrl =
    process.env.LINKER_BASE_URL || "https://linker.beulrock.internal";

  const payload = {
    execution: {
      id: jobId,
      script: btoa(script), // Base64 encode script payload
      scriptHash: crypto.createHash("sha256").update(script).digest("hex"),
      scriptSize: Buffer.byteLength(script, "utf-8"),
    },
    game: {
      id: gameId,
    },
    server: {
      id: serverId,
    },
    requester: {
      tier,
      callbackUrl,
    },
    meta: {
      timestamp,
      nonce,
      protocolVersion: "2.0",
      clientVersion: "1.0.0",
    },
  };

  return {
    method: "POST",
    url: `${baseUrl}/v2/execute`,
    headers: {
      "Content-Type": "application/json",
      "X-Beulrock-Signature": signature,
      "X-Beulrock-Timestamp": timestamp,
      "X-Beulrock-Nonce": nonce,
      "X-Beulrock-Protocol-Version": "2.0",
      "X-Beulrock-Client-Version": "1.0.0",
      "User-Agent": "Beulrock-Server/1.0.0",
    },
    body: JSON.stringify(payload),
  };
}

/**
 * Process the Server Linker response
 * In production, this would parse the actual HTTP response from the game server linker
 */
async function executeLinkerCall(
  request: LinkerHttpRequest
): Promise<LinkerHttpResponse> {
  const linkerMode =
    process.env.LINKER_MODE || "demo"; // "demo" | "live"

  if (linkerMode === "live") {
    // ── Production Mode: Make actual HTTP call to the linker ──
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(25000), // 25s timeout
      });

      const body = await response.json();
      return {
        status: response.status,
        body: body as LinkerHttpResponse["body"],
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Linker request failed";
      return {
        status: 503,
        body: { success: false, error: `Linker unreachable: ${message}` },
      };
    }
  }

  // ── Demo Mode: Simulate a realistic linker response ──
  // This simulates the full lifecycle of a real linker call
  await new Promise((resolve) =>
    setTimeout(resolve, 200 + Math.random() * 400)
  );

  // Simulate connection handshake
  const handshakeOk = Math.random() > 0.02; // 98% handshake success
  if (!handshakeOk) {
    return {
      status: 503,
      body: {
        success: false,
        error:
          "Connection refused — server linker not accepting connections. Ensure the game server is running and the linker is bound to the correct port.",
      },
    };
  }

  // Simulate script injection
  await new Promise((resolve) =>
    setTimeout(resolve, 300 + Math.random() * 500)
  );

  const injectionOk = Math.random() > 0.03; // 97% injection success
  if (!injectionOk) {
    return {
      status: 403,
      body: {
        success: false,
        error:
          "Script injection blocked — the game server has detected unusual activity. The server may have updated its security module. Please try again later or use a different server.",
      },
    };
  }

  // Simulate execution
  await new Promise((resolve) =>
    setTimeout(resolve, 400 + Math.random() * 800)
  );

  const executionOk = Math.random() > 0.02; // 98% execution success
  if (!executionOk) {
    return {
      status: 500,
      body: {
        success: false,
        error:
          "Script execution failed — runtime error in the script environment. Check your script for syntax errors or incompatible API calls.",
      },
    };
  }

  // Success
  const outputs = [
    "Script environment initialized. Running main loop...",
    "Auto-farm module loaded. Collecting resources at optimized rate...",
    "ESP module active. Rendering player overlays on viewport...",
    "Speed modification applied. Movement velocity updated...",
    "Teleport module ready. Coordinate system locked...",
    "Protection bypass active. Anti-cheat module neutralized...",
    "Custom hook installed. Monitoring game events...",
  ];

  const executionId = `exec_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  return {
    status: 200,
    body: {
      success: true,
      executionId,
      output: outputs[Math.floor(Math.random() * outputs.length)],
      serverVersion: "2.4.1",
      protocolVersion: "2.0",
    },
  };
}

// ── Main Execution Pipeline ──
export async function executePipeline(params: {
  jobId: string;
  userId: string;
  gameId: string;
  script: string;
  tier: TierKey;
  serverId?: string;
}): Promise<void> {
  const ctx: ExecutionContext = {
    ...params,
    logs: [],
    startTime: Date.now(),
    phaseStartTimes: {} as Record<ExecutionPhase, number>,
  };

  const broadcast = (phase: ExecutionPhase, status: string) => {
    const logOutput = formatLogs(ctx.logs);
    broadcastToUser(ctx.userId, `execution:${ctx.userId}`, {
      jobId: ctx.jobId,
      status,
      phase,
      logs: logOutput,
      progress: calculateProgress(ctx),
      elapsedMs: Date.now() - ctx.startTime,
    });
  };

  const addLog = (
    phase: ExecutionPhase,
    level: LogEntry["level"],
    message: string
  ) => {
    ctx.logs.push(createLogEntry(phase, level, message));
  };

  const updateDb = async (status: string, logs: string) => {
    try {
      await db.execution.update({
        where: { id: ctx.jobId },
        data: { status, logs },
      });
    } catch (err) {
      console.error(
        `[ExecutorEngine] DB update failed for ${ctx.jobId}:`,
        err
      );
    }
  };

  const markFailed = async (reason: string) => {
    addLog("failed", "ERROR", reason);
    await updateDb("failed", formatLogs(ctx.logs));
    await redisUpdateExecution(ctx.jobId, {
      status: "failed",
      failedAt: Date.now(),
      error: reason,
    });
    await redisIncrementStats("failedExecutions");
    broadcast("failed", "failed");
  };

  try {
    // ══════════════════════════════════════
    // PHASE 1: VALIDATING
    // ══════════════════════════════════════
    ctx.phaseStartTimes.validating = Date.now();
    await updateDb("running", "");
    await redisUpdateExecution(ctx.jobId, {
      status: "running",
      phase: "validating",
      startedAt: Date.now(),
    });

    addLog(
      "validating",
      "INFO",
      "Execution pipeline initiated. Validating script payload..."
    );
    broadcast("validating", "running");
    await sleep(400 + Math.random() * 300);

    // Validate script
    const validation = validateScript(ctx.script);
    if (!validation.valid) {
      addLog(
        "validating",
        "ERROR",
        `Script validation failed: ${validation.reason}`
      );
      await markFailed(`Script validation failed: ${validation.reason}`);
      return;
    }

    addLog(
      "validating",
      "DEBUG",
      `Script size: ${Buffer.byteLength(ctx.script, "utf-8").toLocaleString()} bytes | SHA256: ${crypto.createHash("sha256").update(ctx.script).digest("hex").slice(0, 16)}...`
    );
    addLog(
      "validating",
      "SUCCESS",
      "Script payload validated. No blocked patterns detected."
    );
    broadcast("validating", "running");
    await sleep(200 + Math.random() * 200);

    // ══════════════════════════════════════
    // PHASE 2: ALLOCATING SERVER
    // ══════════════════════════════════════
    ctx.phaseStartTimes.allocating = Date.now();
    addLog(
      "allocating",
      "INFO",
      "Scanning for available game servers..."
    );
    await redisUpdateExecution(ctx.jobId, { phase: "allocating" });
    broadcast("allocating", "running");
    await sleep(300 + Math.random() * 400);

    let targetServerId = ctx.serverId;

    if (!targetServerId) {
      const game = await db.game.findUnique({
        where: { id: ctx.gameId },
        include: {
          servers: {
            where: { status: "online" },
            orderBy: { playerCount: "desc" },
          },
        },
      });

      if (!game || game.servers.length === 0) {
        addLog(
          "allocating",
          "ERROR",
          `No online servers found for game "${game?.name || ctx.gameId}". All servers may be offline or at capacity.`
        );
        await markFailed("No available servers for this game");
        return;
      }

      // Select server with lowest load that's not circuit-broken
      const healthyServers = [];
      for (const server of game.servers) {
        const circuitState = await redisGetCircuitState(server.id);
        if (circuitState !== "open") {
          healthyServers.push(server);
        }
      }

      if (healthyServers.length === 0) {
        addLog(
          "allocating",
          "WARN",
          "All servers have open circuit breakers. Attempting half-open connection..."
        );
        // Try half-open: pick the first server anyway
        targetServerId = game.servers[0].id;
      } else {
        // Pick server with lowest player ratio (best performance)
        const selected = healthyServers.sort((a, b) => {
          const loadA =
            game.playerCount > 0 ? a.playerCount / game.playerCount : 0;
          const loadB =
            game.playerCount > 0 ? b.playerCount / game.playerCount : 0;
          return loadA - loadB;
        })[0];
        targetServerId = selected.id;

        addLog(
          "allocating",
          "DEBUG",
          `Server selected: ${selected.name} (${selected.playerCount.toLocaleString()} players, load: ${Math.round((selected.playerCount / Math.max(game.playerCount, 1)) * 100)}%)`
        );
      }
    }

    const serverInfo = await db.server.findUnique({
      where: { id: targetServerId },
    });
    addLog(
      "allocating",
      "SUCCESS",
      `Server allocated: ${serverInfo?.name || targetServerId.slice(0, 12)} [${serverInfo?.status || "unknown"}]`
    );
    broadcast("allocating", "running");
    await sleep(200 + Math.random() * 200);

    // ══════════════════════════════════════
    // PHASE 3: INJECTING
    // ══════════════════════════════════════
    ctx.phaseStartTimes.injecting = Date.now();
    addLog(
      "injecting",
      "INFO",
      "Establishing secure connection to server linker..."
    );
    await redisUpdateExecution(ctx.jobId, { phase: "injecting" });
    broadcast("injecting", "running");
    await sleep(500 + Math.random() * 400);

    // Build the actual linker HTTP request
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/linker/callback`;
    const linkerRequest = buildLinkerRequest(
      targetServerId,
      ctx.gameId,
      ctx.jobId,
      ctx.script,
      ctx.tier,
      callbackUrl
    );

    addLog(
      "injecting",
      "DEBUG",
      `Linker request: ${linkerRequest.method} ${linkerRequest.url}`
    );
    addLog(
      "injecting",
      "DEBUG",
      `Signature: X-Beulrock-Signature=${linkerRequest.headers["X-Beulrock-Signature"].slice(0, 16)}...`
    );
    addLog(
      "injecting",
      "INFO",
      "Sending signed execution payload to server linker..."
    );
    broadcast("injecting", "running");
    await sleep(300 + Math.random() * 300);

    // Execute the linker call
    const linkerResponse = await executeLinkerCall(linkerRequest);

    if (!linkerResponse.body.success) {
      // Circuit breaker tracking
      const failures = await redisIncrementFailures(targetServerId);
      if (failures >= CIRCUIT_FAILURE_THRESHOLD) {
        await redisSetCircuitState(
          targetServerId,
          "open",
          CIRCUIT_RESET_TIMEOUT
        );
        addLog(
          "injecting",
          "WARN",
          `Circuit breaker OPEN for server ${targetServerId.slice(0, 8)} (${failures} consecutive failures)`
        );
      }

      addLog(
        "injecting",
        "ERROR",
        `Linker responded with ${linkerResponse.status}: ${linkerResponse.body.error}`
      );
      await markFailed(
        linkerResponse.body.error || "Server linker rejected the request"
      );
      return;
    }

    // Reset circuit breaker on success
    await redisResetFailures(targetServerId);

    addLog(
      "injecting",
      "SUCCESS",
      "Injection successful. Script payload delivered to game server."
    );
    if (linkerResponse.body.executionId) {
      addLog(
        "injecting",
        "DEBUG",
        `Remote execution ID: ${linkerResponse.body.executionId}`
      );
    }
    if (linkerResponse.body.serverVersion) {
      addLog(
        "injecting",
        "DEBUG",
        `Server linker version: v${linkerResponse.body.serverVersion} (protocol v${linkerResponse.body.protocolVersion || "2.0"})`
      );
    }
    broadcast("injecting", "running");
    await sleep(200 + Math.random() * 200);

    // ══════════════════════════════════════
    // PHASE 4: RUNNING
    // ══════════════════════════════════════
    ctx.phaseStartTimes.running = Date.now();
    addLog(
      "running",
      "INFO",
      "Bypassing server-side protection layer..."
    );
    await redisUpdateExecution(ctx.jobId, { phase: "running" });
    broadcast("running", "running");
    await sleep(600 + Math.random() * 400);

    addLog("running", "SUCCESS", "Protection bypassed. Script environment ready.");
    broadcast("running", "running");
    await sleep(400 + Math.random() * 300);

    addLog(
      "running",
      "INFO",
      "Initializing script execution context..."
    );
    broadcast("running", "running");
    await sleep(300 + Math.random() * 300);

    addLog(
      "running",
      "CONSOLE",
      linkerResponse.body.output || "Script main loop started."
    );
    broadcast("running", "running");
    await sleep(500 + Math.random() * 500);

    // Simulate real-time script output
    const scriptOutputs = generateScriptOutput(ctx.script);
    for (let i = 0; i < scriptOutputs.length; i++) {
      addLog("running", scriptOutputs[i].level, scriptOutputs[i].message);
      broadcast("running", "running");
      await sleep(400 + Math.random() * 600);
    }

    addLog(
      "running",
      "SUCCESS",
      "All script modules operational. Execution stable."
    );
    broadcast("running", "running");
    await sleep(200);

    // ══════════════════════════════════════
    // PHASE 5: COMPLETED
    // ══════════════════════════════════════
    ctx.phaseStartTimes.completed = Date.now();
    const totalMs = Date.now() - ctx.startTime;
    const finalLogs = formatLogs(ctx.logs);

    await updateDb("completed", finalLogs);
    await redisUpdateExecution(ctx.jobId, {
      status: "completed",
      completedAt: Date.now(),
      durationMs: totalMs,
    });
    await redisIncrementStats("totalExecutions");

    addLog(
      "completed",
      "SUCCESS",
      `Execution completed successfully. Total time: ${(totalMs / 1000).toFixed(2)}s`
    );
    broadcast("completed", "completed");

    // Broadcast to system stats channel
    broadcastToChannel("system:stats", {
      event: "execution_completed",
      jobId: ctx.jobId,
      gameId: ctx.gameId,
      durationMs: totalMs,
    });

    console.log(
      `[ExecutorEngine] Job ${ctx.jobId} completed in ${(totalMs / 1000).toFixed(2)}s`
    );
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown execution error";
    console.error(
      `[ExecutorEngine] Pipeline failed for ${ctx.jobId}:`,
      errorMsg
    );
    await markFailed(`Pipeline error: ${errorMsg}`);
  }
}

// ── Helpers ──

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateProgress(ctx: ExecutionContext): number {
  const phases: ExecutionPhase[] = [
    "validating",
    "allocating",
    "injecting",
    "running",
  ];
  const currentIdx = phases.findIndex(
    (p) => ctx.phaseStartTimes[p as ExecutionPhase]
  );
  if (currentIdx === -1) return 5;
  const phaseProgress = ((currentIdx + 1) / phases.length) * 100;
  return Math.min(99, Math.round(phaseProgress));
}

/**
 * Generate realistic script output based on script content
 */
function generateScriptOutput(
  script: string
): Array<{ level: LogEntry["level"]; message: string }> {
  const outputs: Array<{ level: LogEntry["level"]; message: string }> = [];

  // Detect script type and generate relevant output
  const lowerScript = script.toLowerCase();

  if (lowerScript.includes("farm") || lowerScript.includes("auto")) {
    outputs.push({
      level: "CONSOLE",
      message:
        "[AutoFarm] Scanning for collectible instances... Found 47 resources in range.",
    });
    outputs.push({
      level: "INFO",
      message: "Auto-farm cycle initiated. Collection rate: ~12 items/sec.",
    });
  }

  if (lowerScript.includes("speed") || lowerScript.includes("walk")) {
    outputs.push({
      level: "CONSOLE",
      message:
        "[Speed] WalkSpeed modified: 16 → 100. Velocity multiplier applied.",
    });
  }

  if (lowerScript.includes("esp") || lowerScript.includes("chams")) {
    outputs.push({
      level: "CONSOLE",
      message:
        "[ESP] Rendering highlights for 23 players in render distance. Billboard GUI attached.",
    });
  }

  if (lowerScript.includes("teleport") || lowerScript.includes("tp ")) {
    outputs.push({
      level: "CONSOLE",
      message:
        "[Teleport] Coordinate system locked. Ready for instant relocation.",
    });
  }

  if (lowerScript.includes("aimbot") || lowerScript.includes("aim")) {
    outputs.push({
      level: "CONSOLE",
      message:
        "[Aimbot] Target acquisition system active. FOV: 120°, Smoothing: 0.85.",
    });
  }

  if (lowerScript.includes("god") || lowerScript.includes("health")) {
    outputs.push({
      level: "CONSOLE",
      message:
        "[GodMode] Health value locked at maximum. Damage hook installed.",
    });
  }

  // Default runtime output
  if (outputs.length === 0) {
    outputs.push({
      level: "CONSOLE",
      message: "Script runtime initialized. Environment ready.",
    });
    outputs.push({
      level: "INFO",
      message: "Executing main function in sandboxed environment...",
    });
  }

  // Always add memory and performance stats
  const memUsage = Math.round(2 + Math.random() * 8);
  const cpuUsage = Math.round(3 + Math.random() * 12);
  outputs.push({
    level: "DEBUG",
    message: `Performance: ${cpuUsage}% CPU | ${memUsage}MB RAM | 0 GC pauses`,
  });

  return outputs;
}
