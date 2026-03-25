import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  // Weekly conversion: calls made, leads qualified/quoted/bound per week
  const rows = await query(
    `WITH weeks AS (
       SELECT date_trunc('week', created_at) AS week,
              COUNT(*) AS calls
       FROM calls
       WHERE organization_id = $1 AND is_deleted = false
         AND created_at >= NOW() - INTERVAL '12 weeks'
       GROUP BY week
     ),
     lead_weeks AS (
       SELECT date_trunc('week', created_at) AS week,
              COUNT(*) FILTER (WHERE status IN ('qualified','quoted','bound')) AS qualified,
              COUNT(*) FILTER (WHERE status IN ('quoted','bound')) AS quoted,
              COUNT(*) FILTER (WHERE status = 'bound') AS bound
       FROM leads
       WHERE organization_id = $1 AND is_deleted = false
         AND created_at >= NOW() - INTERVAL '12 weeks'
       GROUP BY week
     )
     SELECT
       TO_CHAR(w.week, 'YYYY-MM-DD') AS week,
       w.calls,
       COALESCE(lw.qualified, 0) AS qualified,
       COALESCE(lw.quoted, 0) AS quoted,
       COALESCE(lw.bound, 0) AS bound
     FROM weeks w
     LEFT JOIN lead_weeks lw ON lw.week = w.week
     ORDER BY w.week`,
    [auth.org_id]
  );

  return NextResponse.json(
    rows.map((r: Record<string, unknown>) => ({
      week: r.week,
      calls: parseInt(r.calls as string),
      qualified: parseInt(r.qualified as string),
      quoted: parseInt(r.quoted as string),
      bound: parseInt(r.bound as string),
    }))
  );
}
