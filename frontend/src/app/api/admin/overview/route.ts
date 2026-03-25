import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const stats = await queryOne<{
    total_tenants: string;
    active_tenants: string;
    trial_tenants: string;
    inactive_tenants: string;
    total_users: string;
    total_calls: string;
    total_leads: string;
    mrr: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM organizations) AS total_tenants,
      (SELECT COUNT(*) FROM organizations WHERE is_active = true) AS active_tenants,
      (SELECT COUNT(*) FROM organizations WHERE subscription_tier = 'trial') AS trial_tenants,
      (SELECT COUNT(*) FROM organizations WHERE is_active = false) AS inactive_tenants,
      (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
      (SELECT COUNT(*) FROM calls) AS total_calls,
      (SELECT COUNT(*) FROM leads) AS total_leads,
      (SELECT COALESCE(SUM(
        CASE subscription_tier
          WHEN 'enterprise' THEN 2500
          WHEN 'pro' THEN 500
          WHEN 'starter' THEN 150
          WHEN 'trial' THEN 0
          ELSE 0
        END
      ), 0) FROM organizations WHERE is_active = true) AS mrr
  `);

  const callVolume = await queryOne<{ today: string; this_week: string; this_month: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE)) AS this_week,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS this_month
    FROM calls
  `);

  return NextResponse.json({
    total_tenants: parseInt(stats?.total_tenants || "0"),
    active_tenants: parseInt(stats?.active_tenants || "0"),
    trial_tenants: parseInt(stats?.trial_tenants || "0"),
    inactive_tenants: parseInt(stats?.inactive_tenants || "0"),
    total_users: parseInt(stats?.total_users || "0"),
    total_calls: parseInt(stats?.total_calls || "0"),
    total_leads: parseInt(stats?.total_leads || "0"),
    mrr: parseInt(stats?.mrr || "0"),
    call_volume: {
      today: parseInt(callVolume?.today || "0"),
      this_week: parseInt(callVolume?.this_week || "0"),
      this_month: parseInt(callVolume?.this_month || "0"),
    },
  });
}
