import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";

export async function GET(request: Request) {
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

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
    const search = searchParams.get("search")?.trim() || "";

    // 3. Build filter
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { robloxUsername: { contains: search, mode: "insensitive" } },
        { robloxDisplay: { contains: search, mode: "insensitive" } },
        { robloxId: { contains: search } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // 4. Get total count for pagination
    const total = await db.whitelistEntry.count({ where });

    // 5. Fetch entries
    const entries = await db.whitelistEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            tier: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          entries: entries.map((e) => ({
            id: e.id,
            userId: e.userId,
            userEmail: e.user.email,
            robloxUsername: e.robloxUsername,
            robloxId: e.robloxId,
            robloxAvatar: e.robloxAvatar,
            robloxDisplay: e.robloxDisplay,
            tier: e.tier,
            source: e.source,
            isActive: e.isActive,
            redeemedKeyId: e.redeemedKeyId,
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/whitelist] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch whitelist entries" },
      { status: 500 }
    );
  }
}
