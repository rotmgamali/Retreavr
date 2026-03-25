import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

const COST_PER_MINUTE = 0.05;

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);
  const orgId = auth.org_id;

  const [current, previous, activeLeads, daily] = await Promise.all([
    // Current period KPIs
    queryOne<{
      total_calls: string;
      total_duration_sec: string;
      avg_duration: string;
      total_leads: string;
      bound_leads: string;
    }>(
      `SELECT
         COUNT(c.id)::text as total_calls,
         COALESCE(SUM(c.duration), 0)::text as total_duration_sec,
         COALESCE(AVG(c.duration), 0)::text as avg_duration,
         (SELECT COUNT(*) FROM leads
          WHERE organization_id = $1 AND is_deleted = false
            AND created_at >= NOW() - ($2 || ' days')::INTERVAL)::text as total_leads,
         (SELECT COUNT(*) FROM leads
          WHERE organization_id = $1 AND is_deleted = false AND status = 'bound'
            AND created_at >= NOW() - ($2 || ' days')::INTERVAL)::text as bound_leads
       FROM calls c
       WHERE c.organization_id = $1 AND c.is_deleted = false
         AND c.created_at >= NOW() - ($2 || ' days')::INTERVAL`,
      [orgId, days.toString()]
    ),
    // Previous period KPIs (for change %)
    queryOne<{
      total_calls: string;
      total_duration_sec: string;
      total_leads: string;
      bound_leads: string;
    }>(
      `SELECT
         COUNT(c.id)::text as total_calls,
         COALESCE(SUM(c.duration), 0)::text as total_duration_sec,
         (SELECT COUNT(*) FROM leads
          WHERE organization_id = $1 AND is_deleted = false
            AND created_at >= NOW() - ($2 * 2 || ' days')::INTERVAL
            AND created_at < NOW() - ($2 || ' days')::INTERVAL)::text as total_leads,
         (SELECT COUNT(*) FROM leads
          WHERE organization_id = $1 AND is_deleted = false AND status = 'bound'
            AND created_at >= NOW() - ($2 * 2 || ' days')::INTERVAL
            AND created_at < NOW() - ($2 || ' days')::INTERVAL)::text as bound_leads
       FROM calls c
       WHERE c.organization_id = $1 AND c.is_deleted = false
         AND c.created_at >= NOW() - ($2 * 2 || ' days')::INTERVAL
         AND c.created_at < NOW() - ($2 || ' days')::INTERVAL`,
      [orgId, days.toString()]
    ),
    // Active leads (not bound or lost)
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM leads
       WHERE organization_id = $1 AND is_deleted = false
         AND status NOT IN ('bound', 'lost')`,
      [orgId]
    ),
    // 7-day daily trends
    query<{ date: string; calls: string; dur_sec: string; new_leads: string; bound: string }>(
      `SELECT
         d.date::text,
         COALESCE(c.calls, 0)::text as calls,
         COALESCE(c.dur_sec, 0)::text as dur_sec,
         COALESCE(l.new_leads, 0)::text as new_leads,
         COALESCE(l.bound, 0)::text as bound
       FROM generate_series(
         (NOW() - '6 days'::INTERVAL)::date,
         NOW()::date,
         '1 day'::INTERVAL
       ) AS d(date)
       LEFT JOIN (
         SELECT created_at::date as dt,
                COUNT(*)::text as calls,
                COALESCE(SUM(duration), 0)::text as dur_sec
         FROM calls
         WHERE organization_id = $1 AND is_deleted = false
           AND created_at >= NOW() - '6 days'::INTERVAL
         GROUP BY created_at::date
       ) c ON c.dt = d.date
       LEFT JOIN (
         SELECT created_at::date as dt,
                COUNT(*)::text as new_leads,
                COUNT(*) FILTER (WHERE status = 'bound')::text as bound
         FROM leads
         WHERE organization_id = $1 AND is_deleted = false
           AND created_at >= NOW() - '6 days'::INTERVAL
         GROUP BY created_at::date
       ) l ON l.dt = d.date
       ORDER BY d.date`,
      [orgId]
    ),
  ]);

  const totalCalls = parseInt(current?.total_calls || "0");
  const totalLeads = parseInt(current?.total_leads || "0");
  const boundLeads = parseInt(current?.bound_leads || "0");
  const totalDurSec = parseFloat(current?.total_duration_sec || "0");
  const avgDuration = parseFloat(current?.avg_duration || "0");
  const revenue = Math.round((totalDurSec / 60) * COST_PER_MINUTE * 100) / 100;

  const prevCalls = parseInt(previous?.total_calls || "0");
  const prevLeads = parseInt(previous?.total_leads || "0");
  const prevBound = parseInt(previous?.bound_leads || "0");
  const prevDurSec = parseFloat(previous?.total_duration_sec || "0");
  const prevRevenue = Math.round((prevDurSec / 60) * COST_PER_MINUTE * 100) / 100;
  const prevConvRate = prevLeads > 0 ? prevBound / prevLeads : 0;
  const convRate = totalLeads > 0 ? boundLeads / totalLeads : 0;

  function pctChange(current: number, prev: number): number {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 10000) / 100;
  }

  const callsTrend = daily.map((r) => parseInt(r.calls));
  const leadsTrend = daily.map((r) => parseInt(r.new_leads));
  const revenueTrend = daily.map((r) =>
    Math.round((parseFloat(r.dur_sec) / 60) * COST_PER_MINUTE * 100) / 100
  );
  const convTrend = daily.map((r) => {
    const nl = parseInt(r.new_leads) || 1;
    const nb = parseInt(r.bound);
    return Math.round((nb / nl) * 10000) / 100;
  });

  return NextResponse.json({
    total_calls: totalCalls,
    conversion_rate: Math.round(convRate * 10000) / 100,
    avg_call_duration: Math.round(avgDuration * 10) / 10,
    revenue,
    active_leads: parseInt(activeLeads?.count || "0"),
    calls_change: pctChange(totalCalls, prevCalls),
    conversion_change: pctChange(convRate, prevConvRate),
    leads_change: pctChange(totalLeads, prevLeads),
    revenue_change: pctChange(revenue, prevRevenue),
    calls_trend: callsTrend,
    conversion_trend: convTrend,
    leads_trend: leadsTrend,
    revenue_trend: revenueTrend,
  });
}
