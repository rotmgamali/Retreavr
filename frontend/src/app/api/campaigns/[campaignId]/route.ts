import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const campaign = await queryOne(
    "SELECT * FROM campaigns WHERE id = $1 AND organization_id = $2 AND is_deleted = false",
    [params.campaignId, auth.org_id]
  );

  if (!campaign) return errorResponse("Campaign not found", 404);
  return NextResponse.json(campaign);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body) return errorResponse("Invalid JSON", 400);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ["name", "type", "status"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(body[key]);
    }
  }
  if (body.config !== undefined) {
    fields.push(`config = $${idx++}`);
    values.push(JSON.stringify(body.config));
  }

  if (fields.length === 0) return errorResponse("No fields to update", 400);

  fields.push("updated_at = NOW()");
  values.push(params.campaignId, auth.org_id);

  const campaign = await queryOne(
    `UPDATE campaigns SET ${fields.join(", ")}
     WHERE id = $${idx++} AND organization_id = $${idx} AND is_deleted = false
     RETURNING *`,
    values
  );

  if (!campaign) return errorResponse("Campaign not found", 404);
  return NextResponse.json(campaign);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const campaign = await queryOne(
    `UPDATE campaigns SET is_deleted = true, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND is_deleted = false RETURNING id`,
    [params.campaignId, auth.org_id]
  );

  if (!campaign) return errorResponse("Campaign not found", 404);
  return new NextResponse(null, { status: 204 });
}
