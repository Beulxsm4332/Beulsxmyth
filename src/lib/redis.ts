// ═══════════════════════════════════════════════════════════════
// Beulrock - Redis Client (Upstash Integration)
// ═══════════════════════════════════════════════════════════════
// Supports:
// 1. Direct Redis connection (REDIS_URL)
// 2. Upstash Redis REST API (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
// 3. In-memory fallback for local development
// ═══════════════════════════════════════════════════════════════

import Redis from "ioredis";

// ── In-memory fallback store ──
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

function memoryGet(key: string): string | null {
  const item = memoryStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
}

function memorySet(key: string, value: string, ttlSeconds?: number): void {
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Date.now() + 3600000;
  memoryStore.set(key, { value, expiresAt });
}

function memoryDel(...keys: string[]): void {
  for (const key of keys) memoryStore.delete(key);
}

function memoryExists(key: string): number {
  const val = memoryGet(key);
  return val !== null ? 1 : 0;
}

function memoryTtl(key: string): number {
  const item = memoryStore.get(key);
  if (!item) return -2;
  const remaining = Math.floor((item.expiresAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : -2;
}

// ── Redis client singleton ──
const globalForRedis = globalThis as unknown as {
  redis: Redis | null;
  isMemory: boolean;
};

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Prefer direct Redis URL
  if (url && url !== "") {
    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
      connectTimeout: 10000,
    });

    client.on("error", (err) => console.error("[Redis] Connection error:", err.message));
    client.on("connect", () => console.log("[Redis] Connected via direct URL"));

    globalForRedis.isMemory = false;
    return client;
  }

  // Upstash REST API fallback
  if (upstashUrl && upstashToken) {
    const client = new Redis(upstashUrl, {
      password: upstashToken,
      maxRetriesPerRequest: 3,
      tls: {},
      lazyConnect: true,
      connectTimeout: 10000,
    });

    client.on("error", (err) => console.error("[Upstash Redis] Connection error:", err.message));
    client.on("connect", () => console.log("[Upstash Redis] Connected via REST"));

    globalForRedis.isMemory = false;
    return client;
  }

  // No Redis configured - use in-memory fallback
  console.warn("[Redis] No REDIS_URL or UPSTASH config found, using in-memory fallback");
  globalForRedis.isMemory = true;
  return null;
}

export const redis: Redis | null = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Check if using in-memory fallback (no real Redis)
 */
export function isUsingMemoryFallback(): boolean {
  return globalForRedis.isMemory;
}

// ═══════════════════════════════════════════════════════════════
// OTP Operations
// ═══════════════════════════════════════════════════════════════

const OTP_PREFIX = "otp:";
const OTP_TTL = 300; // 5 minutes

export async function redisStoreOtp(email: string, codeHash: string): Promise<void> {
  const data = JSON.stringify({ codeHash, attempts: 0, createdAt: Date.now() });
  if (!redis) { memorySet(`${OTP_PREFIX}${email}`, data, OTP_TTL); return; }
  await redis.setex(`${OTP_PREFIX}${email}`, OTP_TTL, data);
}

export async function redisGetOtp(email: string): Promise<{ codeHash: string; attempts: number } | null> {
  const key = `${OTP_PREFIX}${email}`;
  if (!redis) { const d = memoryGet(key); return d ? JSON.parse(d) : null; }
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function redisIncrementOtpAttempts(email: string): Promise<number> {
  const key = `${OTP_PREFIX}${email}`;
  if (!redis) {
    const d = memoryGet(key);
    if (!d) return 0;
    const parsed = JSON.parse(d);
    parsed.attempts += 1;
    if (parsed.attempts >= 5) { memoryDel(key); return parsed.attempts; }
    memorySet(key, JSON.stringify(parsed));
    return parsed.attempts;
  }

  const data = await redis.get(key);
  if (!data) return 0;
  const parsed = JSON.parse(data);
  parsed.attempts += 1;
  if (parsed.attempts >= 5) { await redis.del(key); return parsed.attempts; }
  const ttl = await redis.ttl(key);
  if (ttl > 0) await redis.setex(key, ttl, JSON.stringify(parsed));
  return parsed.attempts;
}

export async function redisDeleteOtp(email: string): Promise<void> {
  const key = `${OTP_PREFIX}${email}`;
  if (!redis) { memoryDel(key); return; }
  await redis.del(key);
}

// ═══════════════════════════════════════════════════════════════
// Rate Limiting (Sliding Window)
// ═══════════════════════════════════════════════════════════════

const RATE_PREFIX = "rate_limit:";

export async function redisCheckRateLimit(
  identifier: string,
  type: "ip" | "email"
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `${RATE_PREFIX}${type}:${identifier}`;
  const maxRequests = type === "ip" ? 100 : 20;
  const windowSeconds = 600;

  if (!redis) {
    // Simple in-memory rate limit
    const countKey = `ratelimit_count:${key}`;
    const stored = memoryGet(countKey);
    const count = stored ? parseInt(stored) : 0;
    if (count >= maxRequests) return { allowed: false, remaining: 0 };
    memorySet(countKey, String(count + 1), windowSeconds);
    return { allowed: true, remaining: maxRequests - count - 1 };
  }

  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now, `${now}:${Math.random()}`);
  multi.zcard(key);
  multi.expire(key, windowSeconds);
  const results = await multi.exec();

  const count = results?.[2]?.[1] as number;
  if (count > maxRequests) {
    await redis.zrem(key, `${now}:${Math.random()}`);
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - count };
}

// ═══════════════════════════════════════════════════════════════
// Resend Cooldown
// ═══════════════════════════════════════════════════════════════

const COOLDOWN_PREFIX = "cooldown:";

export async function redisSetResendCooldown(email: string, cooldownMs: number = 60000): Promise<void> {
  const key = `${COOLDOWN_PREFIX}${email}`;
  const ttl = Math.ceil(cooldownMs / 1000);
  if (!redis) { memorySet(key, "1", ttl); return; }
  await redis.setex(key, ttl, "1");
}

export async function redisIsResendCooldown(email: string): Promise<boolean> {
  const key = `${COOLDOWN_PREFIX}${email}`;
  if (!redis) return memoryExists(key) === 1;
  return (await redis.exists(key)) === 1;
}

export async function redisGetResendCooldownRemaining(email: string): Promise<number> {
  const key = `${COOLDOWN_PREFIX}${email}`;
  if (!redis) return Math.max(0, memoryTtl(key));
  return Math.max(0, await redis.ttl(key));
}

// ═══════════════════════════════════════════════════════════════
// Execution State
// ═══════════════════════════════════════════════════════════════

const EXEC_PREFIX = "exec:";

export async function redisSetExecution(jobId: string, data: Record<string, unknown>, ttl: number = 3600): Promise<void> {
  const key = `${EXEC_PREFIX}${jobId}`;
  if (!redis) { memorySet(key, JSON.stringify(data), ttl); return; }
  await redis.setex(key, ttl, JSON.stringify(data));
}

export async function redisGetExecution(jobId: string): Promise<Record<string, unknown> | null> {
  const key = `${EXEC_PREFIX}${jobId}`;
  if (!redis) { const d = memoryGet(key); return d ? JSON.parse(d) : null; }
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function redisUpdateExecution(jobId: string, updates: Record<string, unknown>): Promise<void> {
  const key = `${EXEC_PREFIX}${jobId}`;
  const existing = await redisGetExecution(jobId);
  if (existing) {
    const updated = { ...existing, ...updates };
    if (!redis) {
      const ttl = memoryTtl(key);
      memorySet(key, JSON.stringify(updated), Math.max(ttl, 300));
      return;
    }
    const ttl = await redis.ttl(key);
    await redis.setex(key, Math.max(ttl, 300), JSON.stringify(updated));
  }
}

// ═══════════════════════════════════════════════════════════════
// Live Stats
// ═══════════════════════════════════════════════════════════════

const STATS_KEY = "system:stats";

export async function redisGetStats(): Promise<Record<string, string>> {
  if (!redis) {
    const result: Record<string, string> = {};
    const stored = memoryGet(STATS_KEY);
    if (stored) Object.assign(result, JSON.parse(stored));
    return result;
  }
  return await redis.hgetall(STATS_KEY);
}

export async function redisSetStatsField(field: string, value: string): Promise<void> {
  if (!redis) {
    const stored = memoryGet(STATS_KEY);
    const stats = stored ? JSON.parse(stored) : {};
    stats[field] = value;
    memorySet(STATS_KEY, JSON.stringify(stats), 3600);
    return;
  }
  await redis.hset(STATS_KEY, field, value);
}

export async function redisIncrementStats(field: string, amount: number = 1): Promise<void> {
  if (!redis) {
    const stored = memoryGet(STATS_KEY);
    const stats = stored ? JSON.parse(stored) : {};
    stats[field] = String((parseInt(stats[field] || "0") + amount));
    memorySet(STATS_KEY, JSON.stringify(stats), 3600);
    return;
  }
  await redis.hincrby(STATS_KEY, field, amount);
}

// ═══════════════════════════════════════════════════════════════
// Circuit Breaker State
// ═══════════════════════════════════════════════════════════════

const CIRCUIT_PREFIX = "circuit:";

export async function redisGetCircuitState(serverId: string): Promise<"closed" | "open" | "half-open"> {
  const key = `${CIRCUIT_PREFIX}${serverId}`;
  if (!redis) {
    const d = memoryGet(key);
    return (d as "closed" | "open" | "half-open") || "closed";
  }
  const state = await redis.get(key);
  return (state as "closed" | "open" | "half-open") || "closed";
}

export async function redisSetCircuitState(serverId: string, state: "closed" | "open" | "half-open", ttl: number = 60): Promise<void> {
  const key = `${CIRCUIT_PREFIX}${serverId}`;
  if (!redis) { memorySet(key, state, ttl); return; }
  await redis.setex(key, ttl, state);
}

export async function redisIncrementFailures(serverId: string): Promise<number> {
  const key = `${CIRCUIT_PREFIX}failures:${serverId}`;
  if (!redis) {
    const stored = memoryGet(key);
    const count = stored ? parseInt(stored) + 1 : 1;
    memorySet(key, String(count), 300);
    return count;
  }
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 300);
  return count;
}

export async function redisResetFailures(serverId: string): Promise<void> {
  const key = `${CIRCUIT_PREFIX}failures:${serverId}`;
  if (!redis) { memoryDel(key); return; }
  await redis.del(key);
}
