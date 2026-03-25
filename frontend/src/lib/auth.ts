import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "./db";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "CHANGE-ME-IN-PRODUCTION"
);
const ALG = "HS256";
const ACCESS_TTL = "30m";
const REFRESH_TTL = "7d";

export interface TokenPayload extends JWTPayload {
  sub: string; // user id
  org_id: string;
  role: string;
}

export async function signAccessToken(payload: {
  sub: string;
  org_id: string;
  role: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(SECRET);
}

export async function signRefreshToken(payload: {
  sub: string;
  org_id: string;
  role: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return payload as TokenPayload;
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
) {
  response.cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60, // 30 min
  });
  response.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
}

/** Extract and verify the current user from the request cookies or Authorization header. */
export async function getAuthUser(
  req: NextRequest
): Promise<TokenPayload | null> {
  // Try cookie first
  const cookieToken = req.cookies.get("access_token")?.value;
  // Then Authorization header
  const headerToken = req.headers
    .get("authorization")
    ?.replace("Bearer ", "");

  const token = cookieToken || headerToken;
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

/** Middleware helper: returns 401 response or the authenticated payload. */
export async function requireAuth(
  req: NextRequest
): Promise<TokenPayload | NextResponse> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }
  return user;
}

const ROLE_LEVELS: Record<string, number> = {
  superadmin: 5,
  admin: 4,
  manager: 3,
  agent: 2,
  viewer: 1,
};

export function hasRole(
  userRole: string,
  requiredRoles: string[]
): boolean {
  const userLevel = ROLE_LEVELS[userRole] ?? 0;
  const minRequired = Math.min(
    ...requiredRoles.map((r) => ROLE_LEVELS[r] ?? 0)
  );
  return userLevel >= minRequired;
}
