import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import { requireAuth, TokenPayload } from "@/lib/auth";
import { parseBody, errorResponse } from "@/lib/api-helpers";
import { PLANS, type PlanTier } from "@/lib/plans";
import {
  getTemplate,
  type InsuranceFocus,
} from "@/lib/default-agent-templates";

interface OnboardingBody {
  // Step 1 - Company Details
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_website?: string;
  license_number?: string;

  // Step 2 - Insurance Focus
  insurance_types?: InsuranceFocus[];

  // Step 3 - Voice Agent Setup
  agent_voice?: string;
  agent_greeting?: string;
  agent_name?: string;

  // Step 4 - Phone Configuration
  phone_number?: string;
  phone_provider?: string; // "twilio" | "existing"
  request_new_number?: boolean;

  // Plan override (admin only)
  plan_tier?: PlanTier;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult as TokenPayload;

  const body = await parseBody<OnboardingBody>(req);
  if (!body) return errorResponse("Invalid JSON body", 400);

  const orgId = user.org_id;

  // Fetch current org
  const org = await queryOne<{
    id: string;
    name: string;
    subscription_tier: string;
    settings: Record<string, unknown> | null;
  }>("SELECT id, name, subscription_tier, settings FROM organizations WHERE id = $1", [
    orgId,
  ]);

  if (!org) return errorResponse("Organization not found", 404);

  const tier = (body.plan_tier ?? org.subscription_tier ?? "free_trial") as PlanTier;
  const limits = PLANS[tier] ?? PLANS.free_trial;

  // ------------------------------------------------------------------
  // Step 1: Company Details - update the organization record
  // ------------------------------------------------------------------
  if (body.company_name || body.company_address || body.company_phone || body.company_website || body.license_number) {
    const currentSettings: Record<string, unknown> = (org.settings as Record<string, unknown>) ?? {};
    const updatedSettings = {
      ...currentSettings,
      company_address: body.company_address ?? currentSettings.company_address,
      company_phone: body.company_phone ?? currentSettings.company_phone,
      company_website: body.company_website ?? currentSettings.company_website,
      license_number: body.license_number ?? currentSettings.license_number,
    };

    await query(
      `UPDATE organizations
       SET name = COALESCE($1, name),
           settings = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [
        body.company_name ?? org.name,
        JSON.stringify(updatedSettings),
        orgId,
      ]
    );
  }

  // ------------------------------------------------------------------
  // Step 2: Insurance Focus - store on org and create default agents
  // ------------------------------------------------------------------
  const agentsCreated: string[] = [];

  if (body.insurance_types && body.insurance_types.length > 0) {
    // Save insurance types to org settings
    const freshOrg = await queryOne<{ settings: Record<string, unknown> | null }>(
      "SELECT settings FROM organizations WHERE id = $1",
      [orgId]
    );
    const settings: Record<string, unknown> = (freshOrg?.settings as Record<string, unknown>) ?? {};
    settings.insurance_types = body.insurance_types;
    await query(
      "UPDATE organizations SET settings = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(settings), orgId]
    );

    // Create default voice agents for each selected insurance type (respect plan limits)
    for (const insuranceType of body.insurance_types) {
      // Check agent limit
      const agentCount = await queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM voice_agents WHERE organization_id = $1",
        [orgId]
      );
      const currentCount = parseInt(agentCount?.count ?? "0", 10);
      if (limits.agents !== -1 && currentCount >= limits.agents) break;

      const template = getTemplate(insuranceType);

      // Use custom overrides from Step 3 for the first agent
      const isFirst = agentsCreated.length === 0;
      const agentName = isFirst && body.agent_name ? body.agent_name : template.name;
      const greeting = isFirst && body.agent_greeting ? body.agent_greeting : template.greeting;
      const voice = isFirst && body.agent_voice ? body.agent_voice : template.voice;

      const agentId = randomUUID();
      await query(
        `INSERT INTO voice_agents (
           id, organization_id, name, system_prompt, greeting_message,
           voice_id, persona, tools, is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          agentId,
          orgId,
          agentName,
          template.system_prompt,
          greeting,
          voice,
          template.persona,
          JSON.stringify(template.tools),
        ]
      );
      agentsCreated.push(agentId);
    }
  }

  // ------------------------------------------------------------------
  // Step 3: If no insurance types but agent config provided, create/update first agent
  // ------------------------------------------------------------------
  if (
    (!body.insurance_types || body.insurance_types.length === 0) &&
    (body.agent_voice || body.agent_greeting || body.agent_name)
  ) {
    const existingAgent = await queryOne<{ id: string }>(
      "SELECT id FROM voice_agents WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1",
      [orgId]
    );

    if (existingAgent) {
      await query(
        `UPDATE voice_agents
         SET name = COALESCE($1, name),
             greeting_message = COALESCE($2, greeting_message),
             voice_id = COALESCE($3, voice_id),
             updated_at = NOW()
         WHERE id = $4`,
        [body.agent_name, body.agent_greeting, body.agent_voice, existingAgent.id]
      );
    }
  }

  // ------------------------------------------------------------------
  // Step 4: Phone Configuration
  // ------------------------------------------------------------------
  if (body.phone_number || body.request_new_number) {
    const freshOrg2 = await queryOne<{ settings: Record<string, unknown> | null }>(
      "SELECT settings FROM organizations WHERE id = $1",
      [orgId]
    );
    const settings: Record<string, unknown> = (freshOrg2?.settings as Record<string, unknown>) ?? {};
    settings.phone_config = {
      phone_number: body.phone_number ?? null,
      provider: body.phone_provider ?? "twilio",
      request_new_number: body.request_new_number ?? false,
      provisioned: !!body.phone_number,
      provisioned_at: body.phone_number ? new Date().toISOString() : null,
    };
    await query(
      "UPDATE organizations SET settings = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(settings), orgId]
    );
  }

  // ------------------------------------------------------------------
  // Step 5: Create default campaign templates
  // ------------------------------------------------------------------
  const campaignCount = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM campaigns WHERE organization_id = $1",
    [orgId]
  );
  if (parseInt(campaignCount?.count ?? "0", 10) === 0) {
    const campaignId = randomUUID();
    const firstAgent = agentsCreated[0] ?? (
      await queryOne<{ id: string }>(
        "SELECT id FROM voice_agents WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1",
        [orgId]
      )
    )?.id;

    if (firstAgent) {
      await query(
        `INSERT INTO campaigns (
           id, organization_id, name, description, type, status,
           voice_agent_id, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          campaignId,
          orgId,
          "Welcome Campaign",
          "Default onboarding campaign to welcome new policyholders and answer coverage questions.",
          "outbound",
          "draft",
          firstAgent,
          user.sub,
        ]
      );
    }
  }

  // ------------------------------------------------------------------
  // Step 6: Default notification rules
  // ------------------------------------------------------------------
  const freshOrg3 = await queryOne<{ settings: Record<string, unknown> | null }>(
    "SELECT settings FROM organizations WHERE id = $1",
    [orgId]
  );
  const finalSettings: Record<string, unknown> = (freshOrg3?.settings as Record<string, unknown>) ?? {};
  if (!finalSettings.notification_rules) {
    finalSettings.notification_rules = {
      missed_call_alert: true,
      daily_summary_email: true,
      escalation_threshold_minutes: 5,
      channels: ["email", "in_app"],
    };
    await query(
      "UPDATE organizations SET settings = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(finalSettings), orgId]
    );
  }

  // ------------------------------------------------------------------
  // Mark onboarding as completed
  // ------------------------------------------------------------------
  const orgSettingsFinal = await queryOne<{ settings: Record<string, unknown> | null }>(
    "SELECT settings FROM organizations WHERE id = $1",
    [orgId]
  );
  const settingsFinal: Record<string, unknown> = (orgSettingsFinal?.settings as Record<string, unknown>) ?? {};
  settingsFinal.onboarding_completed = true;
  settingsFinal.onboarding_completed_at = new Date().toISOString();
  await query(
    "UPDATE organizations SET settings = $1, subscription_tier = $2, updated_at = NOW() WHERE id = $3",
    [JSON.stringify(settingsFinal), tier, orgId]
  );

  return NextResponse.json(
    {
      success: true,
      organization_id: orgId,
      plan_tier: tier,
      plan_limits: limits,
      agents_created: agentsCreated.length,
      onboarding_completed: true,
    },
    { status: 200 }
  );
}
