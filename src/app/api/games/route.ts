import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccessToken, verifyToken } from "@/lib/jwt";
import { canAccessServer, type TierKey } from "@/lib/tier";

export async function GET() {
  try {
    // Get user tier from JWT token (default to "free" if no auth)
    let userTier: TierKey = "free";

    const accessToken = await getAccessToken();
    if (accessToken) {
      const payload = await verifyToken(accessToken);
      if (payload?.userId) {
        const user = await db.user.findUnique({
          where: { id: payload.userId },
          select: { tier: true },
        });
        if (user?.tier) {
          userTier = user.tier as TierKey;
        }
      }
    }

    // Fetch all games with their servers
    const games = await db.game.findMany({
      include: {
        servers: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter games and servers based on user tier
    const filteredGames = games.map((game) => ({
      id: game.id,
      name: game.name,
      placeId: game.placeId,
      description: game.description,
      thumbnail: game.thumbnail,
      playerCount: game.playerCount,
      status: game.status,
      createdAt: game.createdAt,
      servers: game.servers.filter((server) =>
        canAccessServer(userTier, server.playerCount)
      ),
    }));

    return NextResponse.json(
      { success: true, data: { games: filteredGames } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[games] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch games",
        },
      },
      { status: 500 }
    );
  }
}
