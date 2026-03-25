import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  const auth = await requireAuthAndRole(req, ["admin", "superadmin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body) return errorResponse("Invalid JSON", 400);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ["name", "is_active"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(body[key]);
    }
  }
  if (body.config !== undefined) {
    fields.push(`config = $${idx++}`);
    values.push(JSON.stringify(body.config));
  }
  if (body.credentials !== undefined) {
    fields.push(`credentials = $${idx++}`);
    values.push(JSON.stringify(body.credentials));
  }

  if (fields.length === 0) return errorResponse("No fields to update", 400);

  fields.push("updated_at = NOW()");
  values.push(params.integrationId, auth.org_id);

  const integration = await queryOne(
    `UPDATE integrations SET ${fields.join(", ")}
     WHERE id = $${idx++} AND organization_id = $${idx}
     RETURNING id, name, provider, config, is_active`,
    values
  );

  if (!integration) return errorResponse("Integration not found", 404);
  return NextResponse.json(integration);
}
