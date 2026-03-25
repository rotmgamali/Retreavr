import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

// Estimated rates
const TELEPHONY_PER_MINUTE = 0.04; // Twilio outbound
const AI_API_PER_CALL = 0.02; // LLM cost per call
const INFRA_PER_CALL = 0.005; // server/infra per call
const REVENUE_PER_BOUND = 150; // estimated first-month premium commission

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const months = Math.min(parseInt(searchParams.get("months") || "6"), 24);
  const orgId = auth.org_id;

  const rows = await query<{
    month: string;
    total_calls: string;
    total_duration_sec: string;
    bound_leads: string;
  }>(
    `SELECT
       TO_CHAR(DATE_TRUNC('month', c.created_at), 'Mon YYYY') as month,
       COUNT(c.id)::text as total_calls,
       COALESCE(SUM(c.duration), 0)::text as total_duration_sec,
       (SELECT COUNT(*) FROM leads l
        WHERE l.organization_id = $1 AND l.is_deleted = false AND l.status = 'bound'
          AND DATE_TRUNC('month', l.updated_at) = DATE_TRUNC('month', c.created_at))::text as bound_leads
     FROM calls c
     WHERE c.organization_id = $1 AND c.is_deleted = false
       AND c.created_at >= NOW() - ($2 || ' months')::INTERVAL
     GROUP BY DATE_TRUNC('month', c.created_at)
     ORDER BY DATE_TRUNC('month', c.created_at)`,
    [orgId, months.toString()]
  );

  return NextResponse.json(
    rows.map((r) => {
      const calls = parseInt(r.total_calls);
      const minutes = parseFloat(r.total_duration_sec) / 60;
      const bound = parseInt(r.bound_leads);
      return {
        month: r.month,
        telephony: Math.round(minutes * TELEPHONY_PER_MINUTE * 100) / 100,
        apiCost: Math.round(calls * AI_API_PER_CALL * 100) / 100,
        infra: Math.round(calls * INFRA_PER_CALL * 100) / 100,
        revenue: bound * REVENUE_PER_BOUND,
      };
    })
  );
}
