import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  redisStoreOtp,
  redisCheckRateLimit,
  redisSetResendCooldown,
  redisIsResendCooldown,
  redisGetResendCooldownRemaining,
  redis,
} from "@/lib/redis";
import {
  storeOtp,
  checkRateLimit,
  setResendCooldown,
  isResendCooldown,
  getResendCooldownRemaining,
} from "@/lib/otp-store";
import { sendOtpEmail } from "@/lib/email";

const sendOtpSchema = z.object({
  email: z.email("Please provide a valid email address"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = sendOtpSchema.safeParse(body);
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

    const { email } = result.data;

    // Check rate limit — prefer Redis, fallback to in-memory
    const emailRateLimit = redis
      ? await redisCheckRateLimit(email, "email")
      : checkRateLimit(email, "email");
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many OTP requests. Please try again later.",
          },
        },
        { status: 429 }
      );
    }

    // Check rate limit by IP
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
            message: "Too many OTP requests from this IP. Please try again later.",
          },
        },
        { status: 429 }
      );
    }

    // Check resend cooldown
    const inCooldown = redis
      ? await redisIsResendCooldown(email)
      : isResendCooldown(email);
    if (inCooldown) {
      const remaining = redis
        ? await redisGetResendCooldownRemaining(email)
        : getResendCooldownRemaining(email);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RESEND_COOLDOWN",
            message: `Please wait ${remaining} seconds before requesting a new OTP.`,
          },
        },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Hash OTP with bcryptjs (cost 10)
    const codeHash = await bcrypt.hash(otp, 10);

    // Store OTP — prefer Redis, fallback to in-memory
    if (redis) {
      await redisStoreOtp(email, codeHash);
    } else {
      storeOtp(email, codeHash, 300000);
    }

    // Set resend cooldown (60 seconds)
    if (redis) {
      await redisSetResendCooldown(email, 60000);
    } else {
      setResendCooldown(email, 60000);
    }

    // Send OTP via email using Resend
    const emailResult = await sendOtpEmail({ email, otp });

    if (!emailResult.success) {
      // If email fails in production, still log for dev
      console.warn(`[send-otp] Email delivery failed for ${email}: ${emailResult.error}`);
    }

    // Always log OTP for development/testing
    console.log(`[OTP] ${email}: ${otp}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "OTP sent successfully",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[send-otp] Error:", error);
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
