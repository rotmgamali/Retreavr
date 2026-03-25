import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const lead = await queryOne(
    "SELECT * FROM leads WHERE id = $1 AND organization_id = $2 AND is_deleted = false",
    [params.leadId, auth.org_id]
  );

  if (!lead) return errorResponse("Lead not found", 404);
  return NextResponse.json(lead);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body) return errorResponse("Invalid JSON", 400);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ["first_name", "last_name", "email", "phone", "insurance_type", "status", "propensity_score"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(body[key]);
    }
  }
  if (body.metadata !== undefined) {
    fields.push(`metadata = $${idx++}`);
    values.push(JSON.stringify(body.metadata));
  }

  if (fields.length === 0) return errorResponse("No fields to update", 400);

  fields.push("updated_at = NOW()");
  values.push(params.leadId, auth.org_id);

  const lead = await queryOne(
    `UPDATE leads SET ${fields.join(", ")}
     WHERE id = $${idx++} AND organization_id = $${idx} AND is_deleted = false
     RETURNING *`,
    values
  );

  if (!lead) return errorResponse("Lead not found", 404);
  return NextResponse.json(lead);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const lead = await queryOne(
    `UPDATE leads SET is_deleted = true, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND is_deleted = false RETURNING id`,
    [params.leadId, auth.org_id]
  );

  if (!lead) return errorResponse("Lead not found", 404);
  return new NextResponse(null, { status: 204 });
}
