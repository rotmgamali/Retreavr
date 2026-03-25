import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";

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
