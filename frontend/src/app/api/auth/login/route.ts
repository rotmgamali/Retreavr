import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { queryOne, query } from "@/lib/db";
import { signAccessToken, signRefreshToken, setAuthCookies } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await queryOne<{
    id: string;
    organization_id: string;
    email: string;
    hashed_password: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
  }>(
    "SELECT id, organization_id, email, hashed_password, first_name, last_name, role, is_active FROM users WHERE email = $1",
    [email]
  );

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user.is_active) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const hashedInput = createHash("sha256").update(password).digest("hex");
  if (hashedInput !== user.hashed_password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    org_id: user.organization_id,
    role: user.role,
  });
  const refreshToken = await signRefreshToken({
    sub: user.id,
    org_id: user.organization_id,
    role: user.role,
  });

  // Store refresh token
  const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, is_revoked, expires_at, created_at)
     VALUES ($1, $2, $3, false, NOW() + INTERVAL '7 days', NOW())`,
    [randomUUID(), user.id, tokenHash]
  );

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      organization_id: user.organization_id,
    },
    access_token: accessToken,
  });

  setAuthCookies(response, accessToken, refreshToken);
  return response;
}
