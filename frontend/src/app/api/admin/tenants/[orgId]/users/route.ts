import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { query, queryOne } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    const [items, countRow] = await Promise.all([
      query(
        `SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
         FROM users
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [params.orgId, limit, offset]
      ),
      queryOne<{ count: string }>(
        "SELECT COUNT(*) AS count FROM users WHERE organization_id = $1",
        [params.orgId]
      ),
    ]);

    return NextResponse.json({
      items,
      total: parseInt(countRow?.count || "0"),
      limit,
      offset,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
