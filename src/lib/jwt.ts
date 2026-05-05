import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "beulrock-super-secret-jwt-key-2024"
);

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export interface TokenPayload {
  userId: string;
  email: string;
  sessionId: string;
}

export interface AuthPayload extends TokenPayload {
  tier: string;
}

/**
 * Verifies the access token from the httpOnly cookie and fetches
 * the user's tier from the database. Returns null if auth fails.
 */
export async function verifyAccessToken(_request: Request): Promise<AuthPayload | null> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const payload = await verifyToken(accessToken);
    if (!payload || !payload.userId) return null;

    // Dynamically import db to avoid circular deps at module level
    const { db } = await import("@/lib/db");
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { tier: true },
    });

    if (!user) return null;

    return { ...payload, tier: user.tier };
  } catch {
    return null;
  }
}

export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer("beulrock-serverside")
    .sign(JWT_SECRET);
}

export async function generateRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setIssuer("beulrock-serverside")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: "beulrock-serverside",
    });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
) {
  const cookieStore = await cookies();
  
  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 900, // 15 minutes
  });

  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 604800, // 7 days
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  
  cookieStore.set("access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  cookieStore.set("refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0,
  });
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("refresh_token")?.value;
}
