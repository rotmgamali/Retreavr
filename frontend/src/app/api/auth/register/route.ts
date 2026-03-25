import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import { signAccessToken, signRefreshToken, setAuthCookies } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { email, password, first_name, last_name, organization_name, organization_slug } = body;
  if (!email || !password || !first_name || !last_name || !organization_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check for existing email
  const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // Create org
  const orgId = randomUUID();
  const slug = organization_slug || organization_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await query(
    `INSERT INTO organizations (id, name, slug, subscription_tier, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, 'starter', true, NOW(), NOW())`,
    [orgId, organization_name, slug]
  );

  // Create user (store password as bcrypt-style hash placeholder — in production use proper hashing)
  const userId = randomUUID();
  // For MVP, we store a simple hash. Production should use bcrypt via a library.
  const { createHash } = await import("crypto");
  const hashedPassword = createHash("sha256").update(password).digest("hex");

  await query(
    `INSERT INTO users (id, organization_id, email, hashed_password, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'admin', true, NOW(), NOW())`,
    [userId, orgId, email, hashedPassword, first_name, last_name]
  );

  const accessToken = await signAccessToken({ sub: userId, org_id: orgId, role: "admin" });
  const refreshToken = await signRefreshToken({ sub: userId, org_id: orgId, role: "admin" });

  // Store refresh token
  const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, is_revoked, expires_at, created_at)
     VALUES ($1, $2, $3, false, NOW() + INTERVAL '7 days', NOW())`,
    [randomUUID(), userId, tokenHash]
  );

  const response = NextResponse.json({
    user: { id: userId, email, first_name, last_name, role: "admin", organization_id: orgId },
    access_token: accessToken,
  }, { status: 201 });

  setAuthCookies(response, accessToken, refreshToken);
  return response;
}
