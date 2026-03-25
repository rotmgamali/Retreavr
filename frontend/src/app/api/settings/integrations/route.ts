import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await query(
    "SELECT id, name, provider, config, is_active, created_at FROM integrations WHERE organization_id = $1",
    [auth.org_id]
  );

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["admin", "superadmin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body || !body.name || !body.provider) {
    return errorResponse("name and provider required", 400);
  }

  const id = randomUUID();
  const integration = await queryOne(
    `INSERT INTO integrations (id, organization_id, name, provider, config, credentials, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
     RETURNING id, name, provider, config, is_active`,
    [
      id, auth.org_id, body.name, body.provider,
      body.config ? JSON.stringify(body.config) : null,
      body.credentials ? JSON.stringify(body.credentials) : null,
    ]
  );

  return NextResponse.json(integration, { status: 201 });
}
