import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const heartbeatSchema = z.object({
  hwid: z.string().min(1, "Hardware ID is required"),
  sessionToken: z.string().min(1, "Session token is required"),
});

export async function POST(request: Request) {
  try {
    // Parse and validate input
    const body = await request.json();
    const parsed = heartbeatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const { sessionToken } = parsed.data;

    // Verify session is valid by looking up the session
    // The sessionToken maps to a session's refreshTokenHash or could be a dedicated field
    // For now, check if the session exists and is not revoked
    const session = await db.session.findFirst({
      where: {
        refreshTokenHash: sessionToken,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SESSION",
            message: "Invalid or expired session. Please re-authenticate.",
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          status: "active",
          sessionId: session.id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[client/heartbeat] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process heartbeat",
        },
      },
      { status: 500 }
    );
  }
}
