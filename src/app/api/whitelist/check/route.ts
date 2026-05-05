import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { robloxUsername, robloxId, userId } = body as {
      robloxUsername?: string;
      robloxId?: string;
      userId?: string;
    };

    if (!robloxUsername && !robloxId && !userId) {
      return NextResponse.json(
        { success: false, error: "Either robloxUsername, robloxId, or userId is required" },
        { status: 400 }
      );
    }

    // Look up the whitelist entry
    let entry: Awaited<ReturnType<typeof db.whitelistEntry.findFirst>> = null;

    if (userId) {
      // Check by userId (used by Lua linker and executor)
      entry = await db.whitelistEntry.findUnique({
        where: { userId },
      });
    } else if (robloxUsername) {
      // Try exact match first
      entry = await db.whitelistEntry.findUnique({
        where: { robloxUsername: robloxUsername.trim() },
      });

      // If not found, try case-insensitive
      if (!entry) {
        entry = await db.whitelistEntry.findFirst({
          where: {
            robloxUsername: {
              equals: robloxUsername.trim(),
              mode: "insensitive",
            },
          },
        });
      }
    } else if (robloxId) {
      entry = await db.whitelistEntry.findFirst({
        where: { robloxId: String(robloxId) },
      });
    }

    if (!entry) {
      return NextResponse.json(
        {
          success: true,
          data: {
            whitelisted: false,
            tier: null,
            robloxUsername: robloxUsername || null,
            robloxId: robloxId || null,
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
          tier: entry.isActive ? entry.tier : null,
          robloxUsername: entry.robloxUsername,
          robloxId: entry.robloxId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[whitelist/check] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check whitelist status" },
      { status: 500 }
    );
  }
}
