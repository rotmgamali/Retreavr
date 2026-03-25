import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);
  const orgId = auth.org_id;

  const row = await queryOne<{
    contacted: string;
    qualified: string;
    quoted: string;
    bound: string;
    lost: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'contacted')::text as contacted,
       COUNT(*) FILTER (WHERE status = 'qualified')::text as qualified,
       COUNT(*) FILTER (WHERE status = 'quoted')::text as quoted,
       COUNT(*) FILTER (WHERE status = 'bound')::text as bound,
       COUNT(*) FILTER (WHERE status = 'lost')::text as lost
     FROM leads
     WHERE organization_id = $1 AND is_deleted = false
       AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
    [orgId, days.toString()]
  );

  return NextResponse.json([
    { stage: "contacted", count: parseInt(row?.contacted || "0") },
    { stage: "qualified", count: parseInt(row?.qualified || "0") },
    { stage: "quoted", count: parseInt(row?.quoted || "0") },
    { stage: "bound", count: parseInt(row?.bound || "0") },
    { stage: "lost", count: parseInt(row?.lost || "0") },
  ]);
}
