import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { query } from "@/lib/db";
import { clearAuthCookies } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (refreshToken) {
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    await query("UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1", [tokenHash]);
  }

  const response = NextResponse.json({ message: "Logged out" });
  clearAuthCookies(response);
  return response;
}
