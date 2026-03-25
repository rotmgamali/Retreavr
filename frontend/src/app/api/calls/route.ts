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

  const [items, countResult] = await Promise.all([
    query(
      `SELECT * FROM calls WHERE organization_id = $1 AND is_deleted = false
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [auth.org_id, limit, offset]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM calls WHERE organization_id = $1 AND is_deleted = false",
      [auth.org_id]
    ),
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
  if (!body) return errorResponse("Invalid JSON", 400);

  const id = randomUUID();
  const call = await queryOne(
    `INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, phone_from, phone_to, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
     RETURNING *`,
    [
      id, auth.org_id,
      body.agent_id || null, body.lead_id || null,
      body.direction || "outbound", body.status || "initiated",
      body.phone_from || null, body.phone_to || null,
    ]
  );

  return NextResponse.json(call, { status: 201 });
}
