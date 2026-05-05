import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";
import { randomBytes } from "crypto";
import { WHITELIST_TIERS, type TierKey } from "@/lib/tier";

function generateKey(): string {
  const part1 = randomBytes(4).toString("hex").toUpperCase();
  const part2 = randomBytes(4).toString("hex").toUpperCase();
  return `BEUL-${part1}-${part2}`;
}

export async function POST(request: Request) {
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

    // 2. Parse body
    const body = await request.json();
    const { tier, count, maxUses, description, expiresAt } = body as {
      tier?: string;
      count?: number;
      maxUses?: number;
      description?: string;
      expiresAt?: string;
    };

    // Validate tier
    const validTiers = Object.keys(WHITELIST_TIERS) as TierKey[];
    if (!tier || !validTiers.includes(tier as TierKey)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid tier. Must be one of: ${validTiers.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate count (1-100)
    const keyCount = Math.min(Math.max(Number(count) || 1, 1), 100);
    const keyMaxUses = Math.min(Math.max(Number(maxUses) || 1, 1), 10000);

    // Validate expiration date
    let expiresAtDate: Date | null = null;
    if (expiresAt) {
      expiresAtDate = new Date(expiresAt);
      if (isNaN(expiresAtDate.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid expiration date" },
          { status: 400 }
        );
      }
      if (expiresAtDate <= new Date()) {
        return NextResponse.json(
          { success: false, error: "Expiration date must be in the future" },
          { status: 400 }
        );
      }
    }

    // 3. Generate keys and create in DB
    const keys: string[] = [];
    const createdKeys: {
      id: string;
      key: string;
      tier: string;
      maxUses: number;
      description: string;
      expiresAt: Date | null;
    }[] = [];

    for (let i = 0; i < keyCount; i++) {
      let generatedKey = generateKey();

      // Ensure uniqueness (extremely unlikely collision, but safe)
      let attempts = 0;
      while (attempts < 5) {
        const existing = await db.redeemKey.findUnique({
          where: { key: generatedKey },
        });
        if (!existing) break;
        generatedKey = generateKey();
        attempts++;
      }

      keys.push(generatedKey);
    }

    // Batch create in a transaction
    await db.$transaction(
      keys.map((key) =>
        db.redeemKey.create({
          data: {
            key,
            tier: tier as string,
            description: description || "",
            maxUses: keyMaxUses,
            currentUses: 0,
            createdBy: payload.userId,
            isExpired: false,
            expiresAt: expiresAtDate,
          },
        })
      )
    );

    // Fetch the created keys to return with IDs
    const created = await db.redeemKey.findMany({
      where: { key: { in: keys } },
      select: {
        id: true,
        key: true,
        tier: true,
        maxUses: true,
        description: true,
        expiresAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          keys: created.map((k) => ({
            id: k.id,
            key: k.key,
            tier: k.tier,
            maxUses: k.maxUses,
            description: k.description,
            expiresAt: k.expiresAt?.toISOString() ?? null,
          })),
          count: created.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[admin/keys/generate] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate keys" },
      { status: 500 }
    );
  }
}
