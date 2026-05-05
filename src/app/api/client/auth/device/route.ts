import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessToken, verifyToken } from "@/lib/jwt";

const deviceSchema = z.object({
  hwid: z.string().min(1, "Hardware ID is required"),
  deviceName: z.string().min(1, "Device name is required"),
  platform: z.string().min(1, "Platform is required"),
});

export async function POST(request: Request) {
  try {
    // Verify JWT from cookies
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required. Please sign in.",
          },
        },
        { status: 401 }
      );
    }

    const payload = await verifyToken(accessToken);

    if (!payload?.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired token. Please sign in again.",
          },
        },
        { status: 401 }
      );
    }

    // Parse and validate input
    const body = await request.json();
    const parsed = deviceSchema.safeParse(body);

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

    const { hwid, deviceName, platform } = parsed.data;

    // In production, we would create/update a device record in the database
    // For now, log and return success
    console.log(
      `[client/auth/device] Device registered: userId=${payload.userId}, hwid=${hwid}, deviceName=${deviceName}, platform=${platform}`
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "Device registered",
          hwid,
          deviceName,
          platform,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[client/auth/device] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to register device",
        },
      },
      { status: 500 }
    );
  }
}
