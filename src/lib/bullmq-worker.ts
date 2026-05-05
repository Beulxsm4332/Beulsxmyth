import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";
import {
  redisSetExecution,
  redisUpdateExecution,
  redisIncrementStats,
} from "./redis";
import { db } from "./db";
import { broadcastToChannel, broadcastToUser } from "./websocket-server";
import { executePipeline, type ExecutionPhase } from "./executor-engine";
import { validateScript, type TierKey } from "./tier";

// ── Queue Configuration ──
const QUEUE_NAME = "execution";
const MAX_CONCURRENT = 5;
const JOB_TIMEOUT = 60000; // 60 seconds (increased for production pipeline)
const MAX_RETRIES = 3;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT = 60; // seconds

let queue: Queue | null = null;
let worker: Worker | null = null;

export interface ExecutionJobData {
  jobId: string;
  userId: string;
  gameId: string;
  script: string;
  tier: TierKey;
  serverId?: string;
}

export function getQueue(): Queue {
  if (!queue) {
    if (!redis) throw new Error("Redis not available for BullMQ");
    queue = new Queue(QUEUE_NAME, {
      connection: redis.duplicate(),
      defaultJobOptions: {
        attempts: MAX_RETRIES,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
    console.log("[BullMQ] Queue created");
  }
  return queue;
}

export function startWorker(): Worker {
  if (worker) return worker;

  const connection = redis.duplicate();

  worker = new Worker<ExecutionJobData>(
    QUEUE_NAME,
    async (job: Job<ExecutionJobData>) => {
      return await processExecutionJob(job);
    },
    {
      connection,
      concurrency: MAX_CONCURRENT,
      lockDuration: JOB_TIMEOUT + 10000,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[BullMQ] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[BullMQ] Worker error:", err.message);
  });

  console.log("[BullMQ] Worker started (max concurrent:", MAX_CONCURRENT, ")");
  return worker;
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

/**
 * Process execution job using the production executor engine
 *
 * The BullMQ worker delegates to the executor engine for the full
 * pipeline: VALIDATING → ALLOCATING → INJECTING → RUNNING → COMPLETED
 */
async function processExecutionJob(
  job: Job<ExecutionJobData>
): Promise<{ status: string; durationMs: number }> {
  const { jobId, userId, gameId, script, tier, serverId } = job.data;

  console.log(`[BullMQ] Processing execution ${jobId} for user ${userId}`);

  // Quick pre-validation (the engine does full validation too)
  const validation = validateScript(script);
  if (!validation.valid) {
    await markExecutionFailed(
      jobId,
      userId,
      `Script validation failed: ${validation.reason}`
    );
    return { status: "failed", durationMs: 0 };
  }

  const startTime = Date.now();

  try {
    // Run the full execution pipeline
    await executePipeline({
      jobId,
      userId,
      gameId,
      script,
      tier,
      serverId,
    });

    const durationMs = Date.now() - startTime;

    // Verify final state
    const execution = await db.execution.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    return {
      status: execution?.status || "completed",
      durationMs,
    };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown execution error";
    const durationMs = Date.now() - startTime;

    await markExecutionFailed(jobId, userId, errorMsg);
    return { status: "failed", durationMs };
  }
}

async function markExecutionFailed(
  jobId: string,
  userId: string,
  reason: string
): Promise<void> {
  try {
    await db.execution.update({
      where: { id: jobId },
      data: {
        status: "failed",
        logs: `[ERROR] ${reason}`,
      },
    });

    await redisUpdateExecution(jobId, {
      status: "failed",
      failedAt: Date.now(),
      error: reason,
    });
    await redisIncrementStats("failedExecutions");

    broadcastToUser(userId, `execution:${userId}`, {
      jobId,
      status: "failed",
      phase: "failed",
      logs: `[ERROR] ${reason}`,
      progress: 0,
    });
  } catch (err) {
    console.error(
      `[BullMQ] Failed to mark execution ${jobId} as failed:`,
      err
    );
  }
}
