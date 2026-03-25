import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);
  const orgId = auth.org_id;

  const rows = await query<{
    id: string;
    name: string;
    total_calls: string;
    completed_calls: string;
    avg_duration: string;
    sentiment_avg: string;
    bound_leads: string;
    total_leads: string;
  }>(
    `SELECT
       va.id::text,
       va.name,
       COUNT(c.id)::text as total_calls,
       COUNT(c.id) FILTER (WHERE c.status = 'completed')::text as completed_calls,
       COALESCE(AVG(c.duration), 0)::text as avg_duration,
       COALESCE(AVG(c.sentiment_score), 0)::text as sentiment_avg,
       COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'bound')::text as bound_leads,
       COUNT(DISTINCT l.id)::text as total_leads
     FROM voice_agents va
     LEFT JOIN calls c ON c.agent_id = va.id
       AND c.created_at >= NOW() - ($2 || ' days')::INTERVAL
       AND c.is_deleted = false
     LEFT JOIN leads l ON l.id = c.lead_id AND l.is_deleted = false
     WHERE va.organization_id = $1
     GROUP BY va.id, va.name
     ORDER BY COUNT(c.id) FILTER (WHERE c.status = 'completed') DESC`,
    [orgId, days.toString()]
  );

  return NextResponse.json(
    rows.map((r) => {
      const totalLeads = parseInt(r.total_leads) || 1;
      const boundLeads = parseInt(r.bound_leads);
      return {
        agent_id: r.id,
        agent_name: r.name,
        total_calls: parseInt(r.total_calls),
        avg_duration: parseFloat(r.avg_duration),
        conversion_rate: Math.round((boundLeads / totalLeads) * 10000) / 100,
        sentiment_avg: parseFloat(r.sentiment_avg),
      };
    })
  );
}
