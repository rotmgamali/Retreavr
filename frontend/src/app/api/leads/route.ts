import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");
  const status = searchParams.get("status");

  let where = "organization_id = $1 AND is_deleted = false";
  const params: unknown[] = [auth.org_id];
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }

  const [items, countResult] = await Promise.all([
    query(
      `SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM leads WHERE ${where}`, params),
  ]);

  return NextResponse.json({
    items,
    total: parseInt(countResult?.count || "0"),
    limit,
    offset,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body || !body.first_name || !body.last_name) {
    return errorResponse("first_name and last_name required", 400);
  }

  const id = randomUUID();
  const lead = await queryOne(
    `INSERT INTO leads (id, organization_id, first_name, last_name, email, phone, insurance_type, status, propensity_score, metadata, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, NOW(), NOW())
     RETURNING *`,
    [
      id, auth.org_id, body.first_name, body.last_name,
      body.email || null, body.phone || null, body.insurance_type || null,
      body.status || "new", body.propensity_score || null,
      body.metadata ? JSON.stringify(body.metadata) : null,
    ]
  );

  return NextResponse.json(lead, { status: 201 });
}
