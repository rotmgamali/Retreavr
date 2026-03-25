import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  // Call volume heatmap: hour (0-23) x day-of-week (0=Sun..6=Sat)
  const rows = await query(
    `SELECT
       EXTRACT(DOW FROM created_at) AS day,
       EXTRACT(HOUR FROM created_at) AS hour,
       COUNT(*) AS value
     FROM calls
     WHERE organization_id = $1 AND is_deleted = false
       AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY day, hour
     ORDER BY day, hour`,
    [auth.org_id]
  );

  return NextResponse.json(
    rows.map((r: Record<string, unknown>) => ({
      day: parseInt(r.day as string),
      hour: parseInt(r.hour as string),
      value: parseInt(r.value as string),
    }))
  );
}
