// In-memory OTP store (production would use Redis)
interface OtpEntry {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

const otpStore = new Map<string, OtpEntry>();
const rateLimitStore = new Map<string, RateLimitEntry>();
const resendCooldownStore = new Map<string, number>();

// Cleanup expired entries every 60 seconds
if (typeof globalThis !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of otpStore.entries()) {
      if (now > entry.expiresAt) otpStore.delete(key);
    }
    for (const [key, entry] of rateLimitStore.entries()) {
      entry.timestamps = entry.timestamps.filter(t => now - t < 600000);
      if (entry.timestamps.length === 0) rateLimitStore.delete(key);
    }
    for (const [key, expiresAt] of resendCooldownStore.entries()) {
      if (now > expiresAt) resendCooldownStore.delete(key);
    }
  }, 60000);
}

export function storeOtp(email: string, codeHash: string, ttlMs: number = 300000): void {
  otpStore.set(email, {
    codeHash,
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
    createdAt: Date.now(),
  });
}

export function getOtp(email: string): OtpEntry | null {
  const entry = otpStore.get(email);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return null;
  }
  return entry;
}

export function incrementOtpAttempts(email: string): number {
  const entry = otpStore.get(email);
  if (!entry) return 0;
  entry.attempts += 1;
  if (entry.attempts >= 5) {
    otpStore.delete(email);
  }
  return entry.attempts;
}

export function deleteOtp(email: string): void {
  otpStore.delete(email);
}

export function checkRateLimit(identifier: string, type: "ip" | "email"): { allowed: boolean; remaining: number } {
  const key = `rate_limit:${type}:${identifier}`;
  const now = Date.now();
  const windowMs = 600000; // 10 minutes
  const maxRequests = type === "ip" ? 5 : 3;

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Clean expired timestamps
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: maxRequests - entry.timestamps.length };
}

export function setResendCooldown(email: string, cooldownMs: number = 60000): void {
  resendCooldownStore.set(email, Date.now() + cooldownMs);
}

export function isResendCooldown(email: string): boolean {
  const expiresAt = resendCooldownStore.get(email);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    resendCooldownStore.delete(email);
    return false;
  }
  return true;
}

export function getResendCooldownRemaining(email: string): number {
  const expiresAt = resendCooldownStore.get(email);
  if (!expiresAt) return 0;
  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  return remaining;
}
