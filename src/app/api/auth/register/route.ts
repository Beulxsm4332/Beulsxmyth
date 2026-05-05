import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";
import {
  redisStoreOtp,
  redisCheckRateLimit,
  redisSetResendCooldown,
  redis,
} from "@/lib/redis";
import {
  storeOtp,
  checkRateLimit,
  setResendCooldown,
} from "@/lib/otp-store";

const registerSchema = z.object({
  email: z.email("Please provide a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = registerSchema.safeParse(body);
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

    const { email, password } = result.data;

    // Check rate limit
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const ipRateLimit = redis
      ? await redisCheckRateLimit(ip, "ip")
      : checkRateLimit(ip, "ip");
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        },
        { status: 429 }
      );
    }

    // Check if user already exists AND is verified
    const existingUser = await db.user.findUnique({ where: { email } });

    if (existingUser && existingUser.isVerified) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_EXISTS",
            message:
              "An account with this email already exists. Please log in instead.",
          },
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create or update user (unverified)
    await db.user.upsert({
      where: { email },
      update: {
        passwordHash,
        isVerified: false,
      },
      create: {
        email,
        passwordHash,
        isVerified: false,
        tier: "free",
      },
    });

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(otp, 10);

    // Store OTP
    if (redis) {
      await redisStoreOtp(email, codeHash);
      await redisSetResendCooldown(email, 60000);
    } else {
      storeOtp(email, codeHash, 300000);
      setResendCooldown(email, 60000);
    }

    // Send OTP email
    const emailResult = await sendOtpEmail({ email, otp });

    if (!emailResult.success) {
      console.warn(
        `[register] Email delivery failed for ${email}: ${emailResult.error}`
      );
    }

    // Always log OTP for development/testing
    console.log(`[OTP-REGISTER] ${email}: ${otp}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          message:
            "Account created! Please check your email for the verification code.",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[auth/register] Error:", error);
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
