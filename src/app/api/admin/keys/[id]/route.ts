import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";
import { WHITELIST_TIERS, type TierKey } from "@/lib/tier";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 2. Get key ID from params
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Key ID is required" },
        { status: 400 }
      );
    }

    // 3. Check if key exists
    const key = await db.redeemKey.findUnique({
      where: { id },
    });

    if (!key) {
      return NextResponse.json(
        { success: false, error: "Key not found" },
        { status: 404 }
      );
    }

    // 4. Delete the key (cascades to related whitelist entries' redeemedKeyId field)
    await db.redeemKey.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "Key deleted successfully",
          deletedKey: key.key,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/keys/delete] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete key" },
      { status: 500 }
    );
  }
}
