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
    const status = searchParams.get("status") || "all"; // active | expired | all

    // 3. Build filter with proper Prisma AND/OR nesting
    const now = new Date();
    const where: Record<string, unknown> = {};

    if (status === "active") {
      where.AND = [
        { isExpired: false },
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      ];
    } else if (status === "expired") {
      where.OR = [
        { isExpired: true },
        { expiresAt: { lte: now } },
      ];
    }

    // 4. Fetch keys with whitelist count
    const keys = await db.redeemKey.findMany({
      where,
      include: {
        _count: {
          select: { whitelist: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 5. Also auto-expire any keys that have passed their expiration
    const expiredIds = keys
      .filter((k) => !k.isExpired && k.expiresAt && k.expiresAt < now)
      .map((k) => k.id);

    if (expiredIds.length > 0) {
      await db.redeemKey.updateMany({
        where: { id: { in: expiredIds } },
        data: { isExpired: true },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          keys: keys.map((k) => ({
            id: k.id,
            key: k.key,
            tier: k.tier,
            description: k.description,
            maxUses: k.maxUses,
            currentUses: k.currentUses,
            remainingUses: Math.max(0, k.maxUses - k.currentUses),
            createdBy: k.createdBy,
            isExpired: k.isExpired || (k.expiresAt ? k.expiresAt < now : false),
            expiresAt: k.expiresAt?.toISOString() ?? null,
            redemptionCount: k._count.whitelist,
            createdAt: k.createdAt.toISOString(),
          })),
          total: keys.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/keys] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch keys" },
      { status: 500 }
    );
  }
}
