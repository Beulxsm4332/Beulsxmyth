import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { verifyToken, getAccessToken } from "@/lib/jwt";

const analyticsEventSchema = z.object({
  event: z.string().min(1, "Event name is required").max(255, "Event name too long"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = analyticsEventSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: result.error.issues[0]?.message || "Invalid input",
          },
        },
        { status: 400 }
      );
    }

    const { event, metadata } = result.data;

    // Try to get user ID from access token (optional — fire-and-forget style)
    let userId: string | null = null;
    try {
      const accessToken = await getAccessToken();
      if (accessToken) {
        const payload = await verifyToken(accessToken);
        if (payload?.userId) {
          userId = payload.userId;
        }
      }
    } catch {
      // Ignore auth errors for analytics — still track the event
    }

    // Get IP address
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    // Store in AnalyticsEvent table
    await db.analyticsEvent.create({
      data: {
        event,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ip,
        userId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "Event tracked successfully",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[analytics/event] Error:", error);
    // Fire-and-forget style — don't expose internal errors to client
    return NextResponse.json(
      {
        success: true,
        data: {
          message: "Event received",
        },
      },
      { status: 200 }
    );
  }
}
