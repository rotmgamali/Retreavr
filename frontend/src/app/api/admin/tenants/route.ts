import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { query, queryOne } from "@/lib/db";
import { parseBody, errorResponse } from "@/lib/api-helpers";
import { PLANS, type PlanTier } from "@/lib/plans";
import {
  getTemplate,
  type InsuranceFocus,
} from "@/lib/default-agent-templates";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");
  const status = searchParams.get("status"); // active, inactive, trial
  const search = searchParams.get("search");

  let where = "WHERE 1=1";
  const params: unknown[] = [];
  let idx = 1;

  if (status === "active") {
    where += ` AND o.is_active = true AND o.subscription_tier != 'trial'`;
  } else if (status === "inactive") {
    where += ` AND o.is_active = false`;
  } else if (status === "trial") {
    where += ` AND o.subscription_tier = 'trial'`;
  }

  if (search) {
    where += ` AND (o.name ILIKE $${idx} OR o.slug ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  const items = await query(
    `SELECT
       o.id, o.name, o.slug, o.subscription_tier, o.is_active, o.created_at, o.updated_at,
       COALESCE(u.user_count, 0)::int AS total_users,
       COALESCE(a.agent_count, 0)::int AS total_agents,
       COALESCE(c.call_count, 0)::int AS total_calls,
       COALESCE(cm.month_calls, 0)::int AS calls_this_month,
       COALESCE(l.lead_count, 0)::int AS total_leads
     FROM organizations o
     LEFT JOIN LATERAL (SELECT COUNT(*) AS user_count FROM users WHERE organization_id = o.id) u ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS agent_count FROM voice_agents WHERE organization_id = o.id) a ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS call_count FROM calls WHERE organization_id = o.id) c ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS month_calls FROM calls WHERE organization_id = o.id AND created_at >= date_trunc('month', CURRENT_DATE)) cm ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) AS lead_count FROM leads WHERE organization_id = o.id) l ON true
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM organizations o ${where}`,
    params
  );

  return NextResponse.json({
    items,
    total: parseInt(countRow?.count || "0"),
    limit,
    offset,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody<{
    name: string;
    slug?: string;
    subscription_tier?: PlanTier;
    is_active?: boolean;
    settings?: Record<string, unknown>;
    insurance_types?: InsuranceFocus[];
    provision_defaults?: boolean;
  }>(req);
  if (!body || !body.name) return errorResponse("name is required", 400);

  const id = randomUUID();
  const slug =
    body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const tier: PlanTier = body.subscription_tier ?? "free_trial";
  const limits = PLANS[tier] ?? PLANS.free_trial;

  // Build settings with plan limits
  const settings: Record<string, unknown> = {
    ...(body.settings ?? {}),
    plan_limits: limits,
    insurance_types: body.insurance_types ?? [],
    notification_rules: {
      missed_call_alert: true,
      daily_summary_email: true,
      escalation_threshold_minutes: 5,
      channels: ["email", "in_app"],
    },
    onboarding_completed: body.provision_defaults === true,
    onboarding_completed_at: body.provision_defaults === true ? new Date().toISOString() : null,
  };

  const org = await queryOne(
    `INSERT INTO organizations (id, name, slug, subscription_tier, is_active, settings, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [id, body.name, slug, tier, body.is_active !== false, JSON.stringify(settings)]
  );

  // Provision default voice agents if requested
  const agentsCreated: string[] = [];
  if (body.provision_defaults && body.insurance_types && body.insurance_types.length > 0) {
    for (const insuranceType of body.insurance_types) {
      // Respect plan agent limits
      if (limits.agents !== -1 && agentsCreated.length >= limits.agents) break;

      const template = getTemplate(insuranceType);
      const agentId = randomUUID();
      await query(
        `INSERT INTO voice_agents (
           id, organization_id, name, system_prompt, greeting_message,
           voice_id, persona, tools, is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())`,
        [
          agentId,
          id,
          template.name,
          template.system_prompt,
          template.greeting,
          template.voice,
          template.persona,
          JSON.stringify(template.tools),
        ]
      );
      agentsCreated.push(agentId);
    }

    // Create default campaign with first agent
    if (agentsCreated.length > 0) {
      await query(
        `INSERT INTO campaigns (
           id, organization_id, name, description, type, status,
           voice_agent_id, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          randomUUID(),
          id,
          "Welcome Campaign",
          "Default onboarding campaign to welcome new policyholders.",
          "outbound",
          "draft",
          agentsCreated[0],
          auth.sub,
        ]
      );
    }
  }

  return NextResponse.json(
    {
      ...org,
      agents_created: agentsCreated.length,
      plan_limits: limits,
    },
    { status: 201 }
  );
}
