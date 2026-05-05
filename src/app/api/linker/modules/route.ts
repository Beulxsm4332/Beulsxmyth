import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyLinkerSignature } from "@/lib/server-linker";
import { redis } from "@/lib/redis";

/**
 * GET /api/linker/modules
 *
 * Delivers module definitions to the Roblox game's ModuleLinker.
 * Modules are versioned Lua code blocks stored in the database
 * that can be dynamically loaded by the game server.
 *
 * Query params:
 *   moduleId  — Fetch a specific module by ID
 *   gameId    — Fetch all modules for a game
 *   version   — Request a specific version (default: latest)
 *
 * POST /api/linker/modules
 *
 * Register or update a module from the game server.
 * This allows in-game developers to create modules
 * that sync back to the web platform.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");
    const gameId = searchParams.get("gameId");

    // ── Check Redis cache first ──
    const cacheKey = `modules:${gameId || "all"}:${moduleId || "list"}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(JSON.parse(cached));
      }
    }

    if (moduleId) {
      // Fetch specific module — stored as Script with category "module"
      const moduleData = await db.script.findUnique({
        where: { id: moduleId },
      });

      if (!moduleData || moduleData.category !== "module") {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Module not found" } },
          { status: 404 }
        );
      }

      const response = {
        success: true,
        data: {
          id: moduleData.id,
          name: moduleData.name,
          description: moduleData.description,
          code: moduleData.code,
          version: moduleData.usageCount, // Using usageCount as version proxy
          category: moduleData.category,
          isPublic: moduleData.isPublic,
          authorId: moduleData.authorId,
          createdAt: moduleData.createdAt,
        },
      };

      // Cache for 30 seconds
      if (redis) {
        await redis.setex(cacheKey, 30, JSON.stringify(response));
      }

      return NextResponse.json(response);
    }

    // ── Fetch all modules for a game ──
    const where: Record<string, unknown> = { category: "module", isPublic: true };
    if (gameId) {
      // Find scripts that belong to authors who have access to this game
      where.author = {
        executions: { some: { gameId } },
      };
    }

    const modules = await db.script.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        usageCount: true,
        isPublic: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const response = {
      success: true,
      data: {
        count: modules.length,
        modules: modules.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          version: m.usageCount,
          isPublic: m.isPublic,
          createdAt: m.createdAt,
        })),
      },
    };

    if (redis) {
      await redis.setex(cacheKey, 30, JSON.stringify(response));
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[linker/modules] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch modules" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, code, authorId, signature, timestamp, nonce, serverId, gameId } = body;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "name and code are required" } },
        { status: 400 }
      );
    }

    // ── Verify HMAC-SHA256 signature if provided ──
    if (signature && timestamp && nonce && serverId) {
      const verification = verifyLinkerSignature({
        signature,
        timestamp,
        nonce,
        serverId,
        gameId: gameId || "modules",
        jobId: `module:${name}`,
      });

      if (!verification.valid) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_SIGNATURE", message: verification.reason } },
          { status: 401 }
        );
      }
    }

    // ── Create or update module ──
    const newModule = await db.script.upsert({
      where: {
        id: `mod_${name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`,
      },
      update: {
        code,
        description: description || "",
      },
      create: {
        name: `[Module] ${name}`,
        description: description || `Module: ${name}`,
        code,
        category: "module",
        isPublic: true,
        authorId: authorId || "system",
      },
    });

    // ── Invalidate cache ──
    if (redis) {
      const keys = await redis.keys("modules:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newModule.id,
        name: newModule.name,
        version: newModule.usageCount,
        createdAt: newModule.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[linker/modules] POST Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create module" } },
      { status: 500 }
    );
  }
}
