import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccessToken, verifyToken } from "@/lib/jwt";
import { canAccessServer, type TierKey } from "@/lib/tier";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Get game by ID with associated servers
    const game = await db.game.findUnique({
      where: { id },
      include: { servers: true },
    });

    if (!game) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Game not found",
          },
        },
        { status: 404 }
      );
    }

    // Filter servers by user tier
    const filteredGame = {
      ...game,
      servers: game.servers.filter((server) =>
        canAccessServer(userTier, server.playerCount)
      ),
    };

    return NextResponse.json(
      { success: true, data: { game: filteredGame } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[games/id] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch game",
        },
      },
      { status: 500 }
    );
  }
}
