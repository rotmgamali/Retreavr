import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const org = await queryOne(
    "SELECT id, name, slug, settings, subscription_tier FROM organizations WHERE id = $1",
    [auth.org_id]
  );

  if (!org) return errorResponse("Organization not found", 404);
  return NextResponse.json(org);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["admin", "superadmin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body) return errorResponse("Invalid JSON", 400);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(body.name);
  }
  if (body.settings !== undefined) {
    fields.push(`settings = $${idx++}`);
    values.push(JSON.stringify(body.settings));
  }
  if (body.subscription_tier !== undefined) {
    fields.push(`subscription_tier = $${idx++}`);
    values.push(body.subscription_tier);
  }

  if (fields.length === 0) return errorResponse("No fields to update", 400);

  fields.push("updated_at = NOW()");
  values.push(auth.org_id);

  const org = await queryOne(
    `UPDATE organizations SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, slug, settings, subscription_tier`,
    values
  );

  if (!org) return errorResponse("Organization not found", 404);
  return NextResponse.json(org);
}
