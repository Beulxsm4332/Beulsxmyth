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

const loginSchema = z.object({
  email: z.email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = loginSchema.safeParse(body);
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

    // Find user by email
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
        },
        { status: 401 }
      );
    }

    // Check if user has a password set
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_PASSWORD",
            message:
              "This account was created without a password. Please register again with a password.",
          },
        },
        { status: 400 }
      );
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
        },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.isVerified) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_VERIFIED",
            message:
              "Email not verified. Please check your email for the verification code.",
          },
        },
        { status: 403 }
      );
    }

    // Create session
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

    // Ensure whitelist tier exists
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
    console.error("[auth/login] Error:", error);
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
