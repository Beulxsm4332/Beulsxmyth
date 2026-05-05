import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Roblox API: Get universe ID from place ID
async function getUniverseId(placeId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
      { next: { revalidate: 86400 } } // Cache for 24h
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.universeId ?? null;
  } catch {
    return null;
  }
}

// Roblox API: Get game icon/thumbnail from universe ID
async function getGameThumbnail(universeId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.imageUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/roblox/thumbnails
 * Syncs game thumbnails from Roblox API for all games that don't have a proper thumbnail URL.
 * Can also be called with a specific placeId to sync a single game.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { placeId } = body as { placeId?: string };

    // If a specific placeId is provided, sync just that game
    if (placeId) {
      const game = await db.game.findUnique({ where: { placeId } });
      if (!game) {
        return NextResponse.json(
          { success: false, error: "Game not found" },
          { status: 404 }
        );
      }

      // Skip if already has a proper URL thumbnail
      if (game.thumbnail.startsWith("http")) {
        return NextResponse.json({
          success: true,
          data: { game: game.name, thumbnail: game.thumbnail, skipped: true },
        });
      }

      const universeId = await getUniverseId(placeId);
      if (!universeId) {
        return NextResponse.json(
          { success: false, error: "Could not fetch universe ID from Roblox" },
          { status: 502 }
        );
      }

      const thumbnailUrl = await getGameThumbnail(universeId);
      if (!thumbnailUrl) {
        return NextResponse.json(
          { success: false, error: "Could not fetch thumbnail from Roblox" },
          { status: 502 }
        );
      }

      await db.game.update({
        where: { placeId },
        data: { thumbnail: thumbnailUrl },
      });

      return NextResponse.json({
        success: true,
        data: {
          game: game.name,
          placeId,
          universeId,
          thumbnail: thumbnailUrl,
        },
      });
    }

    // Sync all games that don't have a URL thumbnail
    const games = await db.game.findMany({
      where: {
        OR: [
          { thumbnail: "" },
          { thumbnail: { not: { startsWith: "http" } } },
        ],
      },
    });

    if (games.length === 0) {
      return NextResponse.json({
        success: true,
        data: { synced: 0, message: "All games already have thumbnails" },
      });
    }

    const results: Array<{
      game: string;
      placeId: string;
      thumbnail: string | null;
      error?: string;
    }> = [];

    // Process games sequentially to avoid rate limiting
    for (const game of games) {
      const universeId = await getUniverseId(game.placeId);
      if (!universeId) {
        results.push({
          game: game.name,
          placeId: game.placeId,
          thumbnail: null,
          error: "Failed to get universe ID",
        });
        continue;
      }

      const thumbnailUrl = await getGameThumbnail(universeId);
      if (!thumbnailUrl) {
        results.push({
          game: game.name,
          placeId: game.placeId,
          thumbnail: null,
          error: "Failed to get thumbnail",
        });
        continue;
      }

      await db.game.update({
        where: { placeId: game.placeId },
        data: { thumbnail: thumbnailUrl },
      });

      results.push({
        game: game.name,
        placeId: game.placeId,
        thumbnail: thumbnailUrl,
      });
    }

    const synced = results.filter((r) => r.thumbnail).length;

    return NextResponse.json({
      success: true,
      data: {
        synced,
        total: games.length,
        results,
      },
    });
  } catch (error) {
    console.error("[roblox/thumbnails] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to sync thumbnails" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/roblox/thumbnails?placeId=xxx
 * Returns a single game's thumbnail from Roblox API without updating the DB.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId");

    if (!placeId) {
      return NextResponse.json(
        { success: false, error: "placeId query parameter is required" },
        { status: 400 }
      );
    }

    // Check DB first
    const game = await db.game.findUnique({ where: { placeId } });
    if (game?.thumbnail?.startsWith("http")) {
      return NextResponse.json({
        success: true,
        data: { placeId, thumbnail: game.thumbnail, source: "cache" },
      });
    }

    // Fetch from Roblox API
    const universeId = await getUniverseId(placeId);
    if (!universeId) {
      return NextResponse.json(
        { success: false, error: "Could not fetch universe ID" },
        { status: 502 }
      );
    }

    const thumbnailUrl = await getGameThumbnail(universeId);
    if (!thumbnailUrl) {
      return NextResponse.json(
        { success: false, error: "Could not fetch thumbnail" },
        { status: 502 }
      );
    }

    // Update DB for future cache
    if (game) {
      await db.game.update({
        where: { placeId },
        data: { thumbnail: thumbnailUrl },
      });
    }

    return NextResponse.json({
      success: true,
      data: { placeId, universeId, thumbnail: thumbnailUrl, source: "api" },
    });
  } catch (error) {
    console.error("[roblox/thumbnails GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch thumbnail" },
      { status: 500 }
    );
  }
}
