import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const user = await queryOne(
    `SELECT id, organization_id, email, first_name, last_name, role, is_active, created_at
     FROM users WHERE id = $1`,
    [auth.sub]
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}
