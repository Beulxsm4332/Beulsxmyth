import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  setAuthCookies,
  clearAuthCookies,
  getRefreshToken,
} from "@/lib/jwt";

export async function POST() {
  try {
    // Get refresh token from cookie
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "No refresh token provided. Please sign in.",
          },
        },
        { status: 401 }
      );
    }

    // Verify JWT
    const payload = await verifyToken(refreshToken);

    if (!payload || !payload.sessionId || !payload.userId) {
      await clearAuthCookies();
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired refresh token. Please sign in again.",
          },
        },
        { status: 401 }
      );
    }

    // Find session in DB
    const session = await db.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session) {
      await clearAuthCookies();
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Session not found. Please sign in again.",
          },
        },
        { status: 401 }
      );
    }

    // Check if session is revoked
    if (session.isRevoked) {
      await clearAuthCookies();
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Session has been revoked. Please sign in again.",
          },
        },
        { status: 401 }
      );
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      await clearAuthCookies();
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Session has expired. Please sign in again.",
          },
        },
        { status: 401 }
      );
    }

    // Verify the refresh token hash matches the stored hash
    const tokenMatches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!tokenMatches) {
      // Possible token reuse — revoke the session
      await db.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      await clearAuthCookies();
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid refresh token. Please sign in again.",
          },
        },
        { status: 401 }
      );
    }

    // Generate new tokens (rotation)
    const newAccessToken = await generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      sessionId: payload.sessionId,
    });

    const newRefreshToken = await generateRefreshToken({
      userId: payload.userId,
      email: payload.email,
      sessionId: payload.sessionId,
    });

    // Hash new refresh token
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    // Update session in DB with new hashed refresh token
    await db.session.update({
      where: { id: payload.sessionId },
      data: {
        refreshTokenHash: newRefreshTokenHash,
      },
    });

    // Set new cookies
    await setAuthCookies(newAccessToken, newRefreshToken);

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "Tokens refreshed successfully",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[refresh] Error:", error);
    await clearAuthCookies();
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Token refresh failed. Please sign in again.",
        },
      },
      { status: 401 }
    );
  }
}
