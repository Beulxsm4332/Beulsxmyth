import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearAuthCookies, getAccessToken, verifyToken } from "@/lib/jwt";

export async function POST() {
  try {
    // Get access token to find the session
    const accessToken = await getAccessToken();

    if (accessToken) {
      const payload = await verifyToken(accessToken);
      if (payload?.sessionId) {
        // Mark session as revoked in DB
        await db.session.update({
          where: { id: payload.sessionId },
          data: { isRevoked: true },
        }).catch(() => {
          // Session might not exist, ignore error
        });
      }
    }

    // Clear auth cookies
    await clearAuthCookies();

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[logout] Error:", error);

    // Still clear cookies even if DB update fails
    await clearAuthCookies();

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  }
}
