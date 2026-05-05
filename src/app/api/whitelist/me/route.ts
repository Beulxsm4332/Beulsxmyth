import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    // 1. Authenticate
    const payload = await verifyAccessToken(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get the user's whitelist entry
    const entry = await db.whitelistEntry.findUnique({
      where: { userId: payload.userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            tier: true,
          },
        },
      },
    });

    if (!entry) {
      return NextResponse.json(
        {
          success: true,
          data: {
            whitelisted: false,
            entry: null,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          whitelisted: entry.isActive,
          entry: {
            id: entry.id,
            robloxUsername: entry.robloxUsername,
            robloxId: entry.robloxId,
            robloxAvatar: entry.robloxAvatar,
            robloxDisplay: entry.robloxDisplay,
            tier: entry.tier,
            source: entry.source,
            isActive: entry.isActive,
            redeemedKeyId: entry.redeemedKeyId,
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[whitelist/me] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch whitelist info" },
      { status: 500 }
    );
  }
}
