import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAuthAndRole, errorResponse } from "@/lib/api-helpers";
import { scoreLead } from "@/lib/lead-scoring";

export async function POST(
  req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  // Fetch lead with its data
  const lead = await queryOne<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    insurance_type: string | null;
    status: string;
    metadata: Record<string, unknown> | null;
    propensity_score: number | null;
  }>(
    "SELECT id, first_name, last_name, email, phone, insurance_type, status, metadata, propensity_score FROM leads WHERE id = $1 AND organization_id = $2 AND is_deleted = false",
    [params.leadId, auth.org_id]
  );

  if (!lead) return errorResponse("Lead not found", 404);

  const meta = (lead.metadata || {}) as Record<string, unknown>;

  // Score the lead using available data
  const result = scoreLead({
    policyType: lead.insurance_type,
    coverageAmount: meta.coverage_amount as number | undefined,
    renewalDate: meta.renewal_date as string | undefined,
    currentCarrier: meta.current_carrier as string | undefined,
    email: lead.email,
    phone: lead.phone,
    firstName: lead.first_name,
    lastName: lead.last_name,
    age: meta.age as number | undefined,
    zipCode: meta.zip_code as string | undefined,
    tobaccoStatus: meta.tobacco_status as string | undefined,
    drivingRecord: meta.driving_record as string | undefined,
    propertyValue: meta.property_value as number | undefined,
    vehicleYear: meta.vehicle_year as number | undefined,
  });

  // Update lead propensity_score in database
  await query(
    "UPDATE leads SET propensity_score = $1, updated_at = NOW() WHERE id = $2",
    [result.score, params.leadId]
  );

  return NextResponse.json({
    lead_id: lead.id,
    ...result,
    previous_score: lead.propensity_score,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const lead = await queryOne<{ propensity_score: number | null }>(
    "SELECT propensity_score FROM leads WHERE id = $1 AND organization_id = $2 AND is_deleted = false",
    [params.leadId, auth.org_id]
  );

  if (!lead) return errorResponse("Lead not found", 404);

  return NextResponse.json({
    lead_id: params.leadId,
    score: lead.propensity_score,
  });
}
