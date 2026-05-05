import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";

// ─── Roblox API helpers (shared with /api/roblox/profile) ────────────────

const ROBLOX_USER_SEARCH_URL = "https://users.roblox.com/v1/users/search";
const ROBLOX_USERNAMES_URL = "https://users.roblox.com/v1/usernames/users";
const ROBLOX_THUMBNAIL_URL =
  "https://thumbnails.roblox.com/v1/users/avatar-headshot";

interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
}

async function fetchRobloxUser(username: string): Promise<RobloxUser | null> {
  // Strategy 1: Search API
  try {
    const searchRes = await fetch(
      `${ROBLOX_USER_SEARCH_URL}?keyword=${encodeURIComponent(username)}&limit=10`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const users: RobloxUser[] = searchData.data ?? [];
      const exactMatch = users.find(
        (u: RobloxUser) => u.name.toLowerCase() === username.toLowerCase()
      );
      if (exactMatch) return exactMatch;
      if (users.length === 1) return users[0];
    }
  } catch (error) {
    console.error("[whitelist/redeem] Roblox search API failed:", error);
  }

  // Strategy 2: Exact usernames API
  try {
    const usernamesRes = await fetch(ROBLOX_USERNAMES_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (usernamesRes.ok) {
      const usernamesData = await usernamesRes.json();
      const users: RobloxUser[] = usernamesData.data ?? [];
      if (users.length > 0) return users[0];
    }
  } catch (error) {
    console.error("[whitelist/redeem] Roblox usernames API failed:", error);
  }

  return null;
}

async function fetchRobloxAvatar(userId: number): Promise<string | null> {
  try {
    const thumbRes = await fetch(
      `${ROBLOX_THUMBNAIL_URL}?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (thumbRes.ok) {
      const thumbData = await thumbRes.json();
      const images: { targetId: number; imageUrl: string }[] =
        thumbData.data ?? [];
      const image = images.find((img) => img.targetId === userId);
      if (image?.imageUrl) return image.imageUrl;
    }
  } catch (error) {
    console.error("[whitelist/redeem] Roblox thumbnail API failed:", error);
  }
  return null;
}

// ─── Route Handler ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const payload = await verifyAccessToken(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body = await request.json();
    const { key, robloxUsername } = body as {
      key?: string;
      robloxUsername?: string;
    };

    if (!key || typeof key !== "string" || key.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Redeem key is required" },
        { status: 400 }
      );
    }

    if (
      !robloxUsername ||
      typeof robloxUsername !== "string" ||
      robloxUsername.trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "Roblox username is required" },
        { status: 400 }
      );
    }

    const trimmedKey = key.trim();
    const trimmedUsername = robloxUsername.trim();

    // 3. Validate the key
    const redeemKey = await db.redeemKey.findUnique({
      where: { key: trimmedKey },
    });

    if (!redeemKey) {
      return NextResponse.json(
        { success: false, error: "Invalid key" },
        { status: 404 }
      );
    }

    if (redeemKey.isExpired) {
      return NextResponse.json(
        { success: false, error: "This key has expired" },
        { status: 400 }
      );
    }

    if (redeemKey.expiresAt && new Date() > redeemKey.expiresAt) {
      // Auto-expire the key
      await db.redeemKey.update({
        where: { id: redeemKey.id },
        data: { isExpired: true },
      });
      return NextResponse.json(
        { success: false, error: "This key has expired" },
        { status: 400 }
      );
    }

    if (redeemKey.currentUses >= redeemKey.maxUses) {
      return NextResponse.json(
        { success: false, error: "This key has no remaining uses" },
        { status: 400 }
      );
    }

    // 4. Check if the user already has a whitelist entry
    const existingEntry = await db.whitelistEntry.findUnique({
      where: { userId: payload.userId },
    });

    if (existingEntry) {
      return NextResponse.json(
        {
          success: false,
          error: "You already have a whitelist entry. Contact an admin to change your tier.",
        },
        { status: 409 }
      );
    }

    // 5. Check if the Roblox username is already whitelisted
    const existingRoblox = await db.whitelistEntry.findFirst({
      where: { robloxUsername: trimmedUsername },
    });

    if (existingRoblox) {
      return NextResponse.json(
        {
          success: false,
          error: "This Roblox username is already whitelisted",
        },
        { status: 409 }
      );
    }

    // 6. Fetch Roblox profile info
    const robloxUser = await fetchRobloxUser(trimmedUsername);
    let robloxId: string | null = null;
    let robloxDisplay: string | null = null;
    let robloxAvatar: string | null = null;

    if (robloxUser) {
      robloxId = String(robloxUser.id);
      robloxDisplay = robloxUser.displayName;
      robloxAvatar = await fetchRobloxAvatar(robloxUser.id);
    }

    // 7. Create whitelist entry and increment key usage in a transaction
    const entry = await db.$transaction(async (tx) => {
      // Increment key usage
      await tx.redeemKey.update({
        where: { id: redeemKey.id },
        data: { currentUses: { increment: 1 } },
      });

      // Create whitelist entry
      return tx.whitelistEntry.create({
        data: {
          userId: payload.userId,
          robloxUsername: robloxUser?.name ?? trimmedUsername,
          robloxId,
          robloxAvatar,
          robloxDisplay,
          tier: redeemKey.tier,
          source: "key",
          redeemedKeyId: redeemKey.id,
          isActive: true,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          tier: entry.tier,
          robloxUsername: entry.robloxUsername,
          robloxId: entry.robloxId,
          robloxDisplay: entry.robloxDisplay,
          robloxAvatar: entry.robloxAvatar,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[whitelist/redeem] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to redeem key" },
      { status: 500 }
    );
  }
}
