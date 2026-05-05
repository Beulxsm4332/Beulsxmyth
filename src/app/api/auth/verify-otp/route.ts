import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import {
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
} from "@/lib/jwt";
import { getOtp, incrementOtpAttempts, deleteOtp } from "@/lib/otp-store";
import {
  redisGetOtp,
  redisIncrementOtpAttempts,
  redisDeleteOtp,
  redis,
} from "@/lib/redis";

const verifyOtpSchema = z.object({
  email: z.email("Please provide a valid email address"),
  code: z.string().length(6, "OTP must be exactly 6 digits"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = verifyOtpSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: result.error.issues[0]?.message || "Invalid input",
          },
        },
        { status: 400 }
      );
    }

    const { email, code } = result.data;

    // Get OTP from store — prefer Redis, fallback to in-memory
    let otpEntry: { codeHash: string; attempts: number } | null = null;

    if (redis) {
      const redisEntry = await redisGetOtp(email);
      if (redisEntry) {
        otpEntry = redisEntry;
      }
    }

    if (!otpEntry) {
      otpEntry = getOtp(email);
    }

    if (!otpEntry) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_EXPIRED",
            message: "OTP has expired or was not sent. Please request a new one.",
          },
        },
        { status: 400 }
      );
    }

    // Check max attempts
    if (otpEntry.attempts >= 5) {
      if (redis) await redisDeleteOtp(email);
      deleteOtp(email);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_MAX_ATTEMPTS",
            message: "Maximum verification attempts exceeded. Please request a new OTP.",
          },
        },
        { status: 400 }
      );
    }

    // Compare OTP hash
    const isValid = await bcrypt.compare(code, otpEntry.codeHash);
    if (!isValid) {
      const attempts = redis
        ? await redisIncrementOtpAttempts(email)
        : incrementOtpAttempts(email);
      const remaining = 5 - attempts;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_INVALID",
            message: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
          },
        },
        { status: 400 }
      );
    }

    // OTP is valid — delete from both stores
    if (redis) await redisDeleteOtp(email);
    deleteOtp(email);

    // Find user (must exist — created during register)
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "No account found. Please register first.",
          },
        },
        { status: 404 }
      );
    }

    // Mark as verified
    await db.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    // Create session (auto-login after verification)
    const sessionId = uuidv4();
    const refreshToken = await generateRefreshToken({
      userId: user.id,
      email: user.email,
      sessionId,
    });

    // Hash refresh token for storage
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          null,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    // Generate access token
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      sessionId,
    });

    // Set auth cookies
    await setAuthCookies(accessToken, refreshToken);

    // Also create/update whitelist tier for user
    await db.whitelistTier.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        tier: user.tier || "free",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            tier: user.tier,
            createdAt: user.createdAt.toISOString(),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[verify-otp] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
