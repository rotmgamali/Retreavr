import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import {
  verifyToken,
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const oldRefresh =
    req.cookies.get("refresh_token")?.value ||
    (await req.json().catch(() => ({})))?.refresh_token;

  if (!oldRefresh) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyToken(oldRefresh);
  } catch {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  // Verify token exists and is not revoked
  const tokenHash = createHash("sha256").update(oldRefresh).digest("hex");
  const stored = await queryOne<{ id: string; is_revoked: boolean }>(
    "SELECT id, is_revoked FROM refresh_tokens WHERE token_hash = $1",
    [tokenHash]
  );

  if (!stored || stored.is_revoked) {
    return NextResponse.json({ error: "Token revoked" }, { status: 401 });
  }

  // Revoke old token
  await query("UPDATE refresh_tokens SET is_revoked = true WHERE id = $1", [stored.id]);

  // Issue new pair
  const accessToken = await signAccessToken({
    sub: payload.sub!,
    org_id: payload.org_id,
    role: payload.role,
  });
  const refreshToken = await signRefreshToken({
    sub: payload.sub!,
    org_id: payload.org_id,
    role: payload.role,
  });

  const newHash = createHash("sha256").update(refreshToken).digest("hex");
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, is_revoked, expires_at, created_at)
     VALUES ($1, $2, $3, false, NOW() + INTERVAL '7 days', NOW())`,
    [randomUUID(), payload.sub, newHash]
  );

  const response = NextResponse.json({ access_token: accessToken, refresh_token: refreshToken });
  setAuthCookies(response, accessToken, refreshToken);
  return response;
}
