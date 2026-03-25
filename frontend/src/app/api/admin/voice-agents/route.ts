import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { query, queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");
  const orgId = searchParams.get("org_id");

  let where = "";
  const params: unknown[] = [];
  let idx = 1;

  if (orgId) {
    where = `WHERE va.organization_id = $${idx}`;
    params.push(orgId);
    idx++;
  }

  try {
  const items = await query(
    `SELECT va.*,
       o.name AS organization_name,
       o.slug AS organization_slug,
       COALESCE(cc.call_count, 0)::int AS total_calls
     FROM voice_agents va
     JOIN organizations o ON o.id = va.organization_id
     LEFT JOIN LATERAL (SELECT COUNT(*) AS call_count FROM calls WHERE agent_id = va.id) cc ON true
     ${where}
     ORDER BY va.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM voice_agents va ${where}`,
    params
  );

  return NextResponse.json({
    items,
    total: parseInt(countRow?.count || "0"),
    limit,
    offset,
  });
  } catch {
    return NextResponse.json({ error: "Failed to fetch voice agents" }, { status: 500 });
  }
}
