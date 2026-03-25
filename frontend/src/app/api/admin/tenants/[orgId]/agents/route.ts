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
        `SELECT va.*,
           COALESCE(cc.call_count, 0)::int AS total_calls
         FROM voice_agents va
         LEFT JOIN LATERAL (SELECT COUNT(*) AS call_count FROM calls WHERE agent_id = va.id) cc ON true
         WHERE va.organization_id = $1
         ORDER BY va.created_at DESC
         LIMIT $2 OFFSET $3`,
        [params.orgId, limit, offset]
      ),
      queryOne<{ count: string }>(
        "SELECT COUNT(*) AS count FROM voice_agents WHERE organization_id = $1",
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
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
