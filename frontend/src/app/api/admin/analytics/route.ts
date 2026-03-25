import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
  // Top tenants by call volume
  const topTenantsByCalls = await query(
    `SELECT o.id, o.name, o.slug, COUNT(c.id)::int AS total_calls,
       COUNT(c.id) FILTER (WHERE c.created_at >= date_trunc('month', CURRENT_DATE))::int AS calls_this_month
     FROM organizations o
     LEFT JOIN calls c ON c.organization_id = o.id
     GROUP BY o.id, o.name, o.slug
     ORDER BY total_calls DESC
     LIMIT 10`
  );

  // Call volume by day (last 30 days)
  const dailyCallVolume = await query(
    `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS calls
     FROM calls
     WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY date
     ORDER BY date`
  );

  // Tenant growth over time (cumulative count by month)
  const tenantGrowth = await query(
    `SELECT date_trunc('month', created_at)::date AS month, COUNT(*)::int AS new_tenants
     FROM organizations
     WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
     GROUP BY month
     ORDER BY month`
  );

  // Calls by status distribution
  const callsByStatus = await query(
    `SELECT status, COUNT(*)::int AS count
     FROM calls
     GROUP BY status
     ORDER BY count DESC`
  );

  // Top tenants by conversion (leads with status = 'bound' / total leads)
  const topTenantsByConversion = await query(
    `SELECT o.id, o.name,
       COUNT(l.id)::int AS total_leads,
       COUNT(l.id) FILTER (WHERE l.status = 'bound')::int AS bound_leads,
       CASE WHEN COUNT(l.id) > 0
         THEN ROUND(COUNT(l.id) FILTER (WHERE l.status = 'bound')::numeric / COUNT(l.id) * 100, 1)
         ELSE 0
       END AS conversion_rate
     FROM organizations o
     LEFT JOIN leads l ON l.organization_id = o.id
     GROUP BY o.id, o.name
     HAVING COUNT(l.id) > 0
     ORDER BY conversion_rate DESC
     LIMIT 10`
  );

  // Subscription tier distribution
  const tierDistribution = await query(
    `SELECT subscription_tier, COUNT(*)::int AS count
     FROM organizations
     GROUP BY subscription_tier
     ORDER BY count DESC`
  );

  return NextResponse.json({
    top_tenants_by_calls: topTenantsByCalls,
    daily_call_volume: dailyCallVolume,
    tenant_growth: tenantGrowth,
    calls_by_status: callsByStatus,
    top_tenants_by_conversion: topTenantsByConversion,
    tier_distribution: tierDistribution,
  });
  } catch {
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
