import { NextResponse } from "next/server";

const ROBLOX_USER_SEARCH_URL = "https://users.roblox.com/v1/users/search";
const ROBLOX_USERNAMES_URL = "https://users.roblox.com/v1/usernames/users";
const ROBLOX_THUMBNAIL_URL = "https://thumbnails.roblox.com/v1/users/avatar-headshot";

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

      // Look for exact username match (case-insensitive)
      const exactMatch = users.find(
        (u: RobloxUser) => u.name.toLowerCase() === username.toLowerCase()
      );
      if (exactMatch) return exactMatch;

      // If only one result and it's close, use it
      if (users.length === 1) return users[0];
    }
  } catch (error) {
    console.error("[roblox/profile] Search API failed:", error);
  }

  // Strategy 2: Exact usernames API
  try {
    const usernamesRes = await fetch(ROBLOX_USERNAMES_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
      signal: AbortSignal.timeout(8000),
    });

    if (usernamesRes.ok) {
      const usernamesData = await usernamesRes.json();
      const users: RobloxUser[] = usernamesData.data ?? [];
      if (users.length > 0) return users[0];
    }
  } catch (error) {
    console.error("[roblox/profile] Usernames API failed:", error);
  }

  return null;
}

async function fetchRobloxAvatar(
  userId: number
): Promise<string | null> {
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
    console.error("[roblox/profile] Thumbnail API failed:", error);
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();

    // Fetch Roblox user data
    const robloxUser = await fetchRobloxUser(trimmedUsername);

    if (!robloxUser) {
      return NextResponse.json(
        {
          success: false,
          error: `Roblox user "${trimmedUsername}" not found`,
        },
        { status: 404 }
      );
    }

    // Fetch avatar
    const avatarUrl = await fetchRobloxAvatar(robloxUser.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          robloxId: String(robloxUser.id),
          robloxUsername: robloxUser.name,
          robloxDisplay: robloxUser.displayName,
          robloxAvatar: avatarUrl || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[roblox/profile] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Roblox profile" },
      { status: 500 }
    );
  }
}
