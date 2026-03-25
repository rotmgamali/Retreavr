import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { queryOne } from "@/lib/db";
import { parseBody, errorResponse } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const org = await queryOne(
    `SELECT
       o.*,
       COALESCE(u.user_count, 0)::int AS total_users,
       COALESCE(a.agent_count, 0)::int AS total_agents,
       COALESCE(c.call_count, 0)::int AS total_calls,
       COALESCE(cm.month_calls, 0)::int AS calls_this_month,
       COALESCE(l.lead_count, 0)::int AS total_leads,
       COALESCE(cp.campaign_count, 0)::int AS total_campaigns
     FROM organizations o
     LEFT JOIN LATERAL (SELECT COUNT(*) AS user_count FROM users WHERE organization_id = o.id) u ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS agent_count FROM voice_agents WHERE organization_id = o.id) a ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS call_count FROM calls WHERE organization_id = o.id) c ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS month_calls FROM calls WHERE organization_id = o.id AND created_at >= date_trunc('month', CURRENT_DATE)) cm ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS lead_count FROM leads WHERE organization_id = o.id) l ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS campaign_count FROM campaigns WHERE organization_id = o.id) cp ON true
     WHERE o.id = $1`,
    [params.orgId]
  );

  if (!org) return errorResponse("Organization not found", 404);

  return NextResponse.json(org);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body) return errorResponse("Request body is required", 400);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const allowedFields = ["name", "slug", "subscription_tier", "is_active", "settings"];
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "settings") {
        setClauses.push(`${field} = $${idx}`);
        values.push(JSON.stringify(body[field]));
      } else {
        setClauses.push(`${field} = $${idx}`);
        values.push(body[field]);
      }
      idx++;
    }
  }

  if (setClauses.length === 0) return errorResponse("No valid fields to update", 400);

  setClauses.push(`updated_at = NOW()`);
  values.push(params.orgId);

  const org = await queryOne(
    `UPDATE organizations SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (!org) return errorResponse("Organization not found", 404);

  return NextResponse.json(org);
}
