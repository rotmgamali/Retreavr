import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "overview";
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);

  const orgId = auth.org_id;

  switch (type) {
    case "overview": {
      const [leads, calls, agents, campaigns] = await Promise.all([
        queryOne<{ count: string }>(
          "SELECT COUNT(*) as count FROM leads WHERE organization_id = $1 AND is_deleted = false",
          [orgId]
        ),
        queryOne<{ total: string; this_month: string }>(
          `SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as this_month
           FROM calls WHERE organization_id = $1 AND is_deleted = false`,
          [orgId]
        ),
        queryOne<{ count: string }>(
          "SELECT COUNT(*) as count FROM voice_agents WHERE organization_id = $1 AND status = 'active'",
          [orgId]
        ),
        queryOne<{ count: string }>(
          "SELECT COUNT(*) as count FROM campaigns WHERE organization_id = $1 AND status = 'active' AND is_deleted = false",
          [orgId]
        ),
      ]);

      return NextResponse.json({
        total_leads: parseInt(leads?.count || "0"),
        total_calls: parseInt(calls?.total || "0"),
        calls_this_month: parseInt(calls?.this_month || "0"),
        active_agents: parseInt(agents?.count || "0"),
        active_campaigns: parseInt(campaigns?.count || "0"),
      });
    }

    case "conversion": {
      const rows = await query(
        `SELECT
           COUNT(*) as total_leads,
           COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
           COUNT(*) FILTER (WHERE status = 'qualified') as qualified,
           COUNT(*) FILTER (WHERE status = 'quoted') as quoted,
           COUNT(*) FILTER (WHERE status = 'bound') as bound,
           COUNT(*) FILTER (WHERE status = 'lost') as lost
         FROM leads
         WHERE organization_id = $1 AND is_deleted = false
           AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
        [orgId, days.toString()]
      );
      const r = rows[0] as Record<string, string>;
      const total = parseInt(r.total_leads) || 1;
      return NextResponse.json({
        period_days: days,
        total_leads: parseInt(r.total_leads),
        funnel: {
          contacted: parseInt(r.contacted),
          qualified: parseInt(r.qualified),
          quoted: parseInt(r.quoted),
          bound: parseInt(r.bound),
          lost: parseInt(r.lost),
        },
        conversion_rate: Math.round((parseInt(r.bound) / total) * 10000) / 100,
      });
    }

    case "call-volume": {
      const rows = await query(
        `SELECT
           created_at::date as date,
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
           COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
           ROUND(AVG(duration)::numeric, 1) as avg_duration
         FROM calls
         WHERE organization_id = $1 AND is_deleted = false
           AND created_at >= NOW() - ($2 || ' days')::INTERVAL
         GROUP BY created_at::date
         ORDER BY created_at::date`,
        [orgId, days.toString()]
      );

      return NextResponse.json({
        period_days: days,
        daily: rows.map((r: Record<string, unknown>) => ({
          date: r.date,
          total: parseInt(r.total as string),
          inbound: parseInt(r.inbound as string),
          outbound: parseInt(r.outbound as string),
          avg_duration_sec: parseFloat((r.avg_duration as string) || "0"),
        })),
        total_calls: rows.reduce(
          (sum: number, r: Record<string, unknown>) => sum + parseInt(r.total as string),
          0
        ),
      });
    }

    case "agent-performance": {
      const rows = await query(
        `SELECT
           va.id, va.name,
           COUNT(c.id) as total_calls,
           ROUND(AVG(c.duration)::numeric, 1) as avg_duration,
           ROUND(AVG(c.sentiment_score)::numeric, 2) as avg_sentiment,
           COUNT(c.id) FILTER (WHERE c.status = 'completed') as completed
         FROM voice_agents va
         LEFT JOIN calls c ON c.agent_id = va.id
           AND c.created_at >= NOW() - ($2 || ' days')::INTERVAL
           AND c.is_deleted = false
         WHERE va.organization_id = $1
         GROUP BY va.id, va.name`,
        [orgId, days.toString()]
      );

      return NextResponse.json({
        period_days: days,
        agents: rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          name: r.name,
          total_calls: parseInt(r.total_calls as string),
          completed_calls: parseInt(r.completed as string),
          avg_duration_sec: parseFloat((r.avg_duration as string) || "0"),
          avg_sentiment: parseFloat((r.avg_sentiment as string) || "0"),
        })),
      });
    }

    default:
      return NextResponse.json({ error: `Unknown analytics type: ${type}` }, { status: 400 });
  }
}
