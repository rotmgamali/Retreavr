import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

type Period = "hourly" | "daily" | "weekly";

const TRUNC_MAP: Record<Period, string> = {
  hourly: "hour",
  daily: "day",
  weekly: "week",
};

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const rawPeriod = searchParams.get("period") || "daily";
  const period: Period = rawPeriod in TRUNC_MAP ? (rawPeriod as Period) : "daily";
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);
  const orgId = auth.org_id;

  const trunc = TRUNC_MAP[period];
  const rows = await query<{ timestamp: string; count: string }>(
    `SELECT
       DATE_TRUNC($3, created_at)::text as timestamp,
       COUNT(*)::text as count
     FROM calls
     WHERE organization_id = $1 AND is_deleted = false
       AND created_at >= NOW() - ($2 || ' days')::INTERVAL
     GROUP BY DATE_TRUNC($3, created_at)
     ORDER BY DATE_TRUNC($3, created_at)`,
    [orgId, days.toString(), trunc]
  );

  return NextResponse.json(rows.map((r) => ({ timestamp: r.timestamp, count: parseInt(r.count) })));
}
