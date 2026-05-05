import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { isPublic: true };

    if (category && category !== "All") {
      where.category = category.toLowerCase();
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const scripts = await db.script.findMany({
      where,
      orderBy: { usageCount: "desc" },
      take: 100,
    });

    return NextResponse.json(
      { success: true, data: { scripts } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[scripts] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch scripts",
        },
      },
      { status: 500 }
    );
  }
}
