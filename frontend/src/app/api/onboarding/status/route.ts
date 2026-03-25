import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuth, TokenPayload } from "@/lib/auth";

interface OnboardingStatus {
  org_setup: boolean;
  agent_configured: boolean;
  first_campaign: boolean;
  phone_provisioned: boolean;
  onboarding_completed: boolean;
  current_step: number;
  organization_name: string | null;
  insurance_types: string[];
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult as TokenPayload;

  const orgId = user.org_id;

  // Fetch org details
  const org = await queryOne<{
    id: string;
    name: string;
    settings: Record<string, unknown> | null;
  }>("SELECT id, name, settings FROM organizations WHERE id = $1", [orgId]);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const settings = (org.settings as Record<string, unknown>) ?? {};

  // Check org setup: has company details beyond just a name
  const orgSetup =
    !!org.name &&
    !!(settings.company_phone || settings.company_address || settings.license_number);

  // Check agent configured
  const agentRow = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM voice_agents WHERE organization_id = $1",
    [orgId]
  );
  const agentConfigured = parseInt(agentRow?.count ?? "0", 10) > 0;

  // Check first campaign
  const campaignRow = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM campaigns WHERE organization_id = $1",
    [orgId]
  );
  const firstCampaign = parseInt(campaignRow?.count ?? "0", 10) > 0;

  // Check phone provisioned
  const phoneConfig = settings.phone_config as Record<string, unknown> | undefined;
  const phoneProvisioned = !!(phoneConfig?.provisioned || phoneConfig?.phone_number);

  const onboardingCompleted = settings.onboarding_completed === true;

  // Determine current step (1-indexed, 5 = review/complete)
  let currentStep = 1;
  if (orgSetup) currentStep = 2;
  if (orgSetup && (settings.insurance_types as string[] | undefined)?.length) currentStep = 3;
  if (currentStep >= 3 && agentConfigured) currentStep = 4;
  if (currentStep >= 4 && phoneProvisioned) currentStep = 5;
  if (onboardingCompleted) currentStep = 5;

  const status: OnboardingStatus = {
    org_setup: orgSetup,
    agent_configured: agentConfigured,
    first_campaign: firstCampaign,
    phone_provisioned: phoneProvisioned,
    onboarding_completed: onboardingCompleted,
    current_step: currentStep,
    organization_name: org.name,
    insurance_types: (settings.insurance_types as string[]) ?? [],
  };

  return NextResponse.json(status);
}
