import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccessToken, verifyToken } from "@/lib/jwt";

export async function GET() {
  try {
    // Get access token from cookie
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

    // Verify JWT
    const payload = await verifyToken(accessToken);

    if (!payload || !payload.userId) {
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

    // Get user from DB
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        isVerified: true,
        tier: true,
        createdAt: true,
      },
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
    console.error("[me] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication failed. Please sign in again.",
        },
      },
      { status: 401 }
    );
  }
}
