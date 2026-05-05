import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";
import { WHITELIST_TIERS, type TierKey } from "@/lib/tier";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate + admin check
    const payload = await verifyAccessToken(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (payload.tier !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Admin only" },
        { status: 403 }
      );
    }

    // 2. Get entry ID from params
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Whitelist entry ID is required" },
        { status: 400 }
      );
    }

    // 3. Check if entry exists
    const entry = await db.whitelistEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Whitelist entry not found" },
        { status: 404 }
      );
    }

    // 4. Parse body
    const body = await request.json();
    const { isActive, tier } = body as {
      isActive?: boolean;
      tier?: string;
    };

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return NextResponse.json(
          { success: false, error: "isActive must be a boolean" },
          { status: 400 }
        );
      }
      updateData.isActive = isActive;
    }

    if (tier !== undefined) {
      const validTiers = Object.keys(WHITELIST_TIERS) as TierKey[];
      if (!validTiers.includes(tier as TierKey)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid tier. Must be one of: ${validTiers.join(", ")}`,
          },
          { status: 400 }
        );
      }
      updateData.tier = tier;

      // Also update the user's tier to match
      await db.user.update({
        where: { id: entry.userId },
        data: { tier },
      });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // 5. Update the entry
    const updated = await db.whitelistEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: updated.id,
          robloxUsername: updated.robloxUsername,
          tier: updated.tier,
          isActive: updated.isActive,
          source: updated.source,
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/whitelist/update] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update whitelist entry" },
      { status: 500 }
    );
  }
}
