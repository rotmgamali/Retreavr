import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";
import { extractInsuranceData } from "@/lib/extraction";
import { scoreLead } from "@/lib/lead-scoring";

export async function GET(
  req: NextRequest,
  { params }: { params: { callId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const call = await queryOne(
    "SELECT * FROM calls WHERE id = $1 AND organization_id = $2 AND is_deleted = false",
    [params.callId, auth.org_id]
  );

  if (!call) return errorResponse("Call not found", 404);
  return NextResponse.json(call);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { callId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body) return errorResponse("Invalid JSON", 400);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ["status", "duration", "sentiment_score", "twilio_sid"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(body[key]);
    }
  }

  if (fields.length === 0) return errorResponse("No fields to update", 400);

  fields.push("updated_at = NOW()");
  values.push(params.callId, auth.org_id);

  const call = await queryOne(
    `UPDATE calls SET ${fields.join(", ")}
     WHERE id = $${idx++} AND organization_id = $${idx} AND is_deleted = false
     RETURNING *`,
    values
  );

  if (!call) return errorResponse("Call not found", 404);

  // Post-processing: when call completes, extract insurance data and score lead
  if (body.status === "completed") {
    try {
      const callRecord = call as Record<string, unknown>;
      const leadId = callRecord.lead_id as string | null;
      const callId = params.callId;

      // Fetch transcript
      const transcriptRow = await queryOne<{ transcript: string }>(
        "SELECT transcript FROM call_transcripts WHERE call_id = $1",
        [callId]
      );

      if (transcriptRow?.transcript && leadId) {
        // Extract insurance fields from transcript
        const extracted = extractInsuranceData(transcriptRow.transcript);

        // Merge extracted data into lead metadata
        const existingLead = await queryOne<{ metadata: Record<string, unknown> | null; insurance_type: string | null }>(
          "SELECT metadata, insurance_type FROM leads WHERE id = $1 AND organization_id = $2",
          [leadId, auth.org_id]
        );

        if (existingLead) {
          const mergedMetadata = {
            ...(existingLead.metadata || {}),
            ...(extracted.coverageAmount && { coverage_amount: extracted.coverageAmount }),
            ...(extracted.deductible && { deductible: extracted.deductible }),
            ...(extracted.currentCarrier && { current_carrier: extracted.currentCarrier }),
            ...(extracted.renewalDate && { renewal_date: extracted.renewalDate }),
            ...(extracted.age && { age: extracted.age }),
            ...(extracted.zipCode && { zip_code: extracted.zipCode }),
            ...(extracted.tobaccoStatus && { tobacco_status: extracted.tobaccoStatus }),
            ...(extracted.drivingRecord && { driving_record: extracted.drivingRecord }),
            ...(extracted.propertyValue && { property_value: extracted.propertyValue }),
            ...(extracted.vehicleYear && { vehicle_year: extracted.vehicleYear }),
            ...(extracted.vehicleType && { vehicle_type: extracted.vehicleType }),
            extraction_confidence: extracted.confidence,
            last_extracted_at: new Date().toISOString(),
          };

          // Score the lead with enriched data
          const scoreResult = scoreLead({
            policyType: extracted.policyType || existingLead.insurance_type || undefined,
            coverageAmount: extracted.coverageAmount || undefined,
            renewalDate: extracted.renewalDate || undefined,
            currentCarrier: extracted.currentCarrier || undefined,
            email: extracted.email || undefined,
            phone: extracted.phone || undefined,
            age: extracted.age || undefined,
            zipCode: extracted.zipCode || undefined,
            tobaccoStatus: extracted.tobaccoStatus || undefined,
            drivingRecord: extracted.drivingRecord || undefined,
            propertyValue: extracted.propertyValue || undefined,
            vehicleYear: extracted.vehicleYear || undefined,
          });

          // Update lead with extracted data and score
          await query(
            `UPDATE leads SET
              metadata = $1,
              propensity_score = $2,
              insurance_type = COALESCE($3, insurance_type),
              updated_at = NOW()
            WHERE id = $4 AND organization_id = $5`,
            [
              JSON.stringify(mergedMetadata),
              scoreResult.score,
              extracted.policyType,
              leadId,
              auth.org_id,
            ]
          );
        }
      }
    } catch {
      // Non-blocking: extraction failure shouldn't fail the call update
    }
  }

  return NextResponse.json(call);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { callId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const call = await queryOne(
    `UPDATE calls SET is_deleted = true, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND is_deleted = false RETURNING id`,
    [params.callId, auth.org_id]
  );

  if (!call) return errorResponse("Call not found", 404);
  return new NextResponse(null, { status: 204 });
}
