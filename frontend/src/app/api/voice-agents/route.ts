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
      `SELECT id, organization_id, name, persona, system_prompt, voice, status, vad_config, created_at, updated_at
       FROM voice_agents WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [auth.org_id, limit, offset]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM voice_agents WHERE organization_id = $1",
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
  if (!body || !body.name) return errorResponse("name is required", 400);

  const id = randomUUID();
  const agent = await queryOne(
    `INSERT INTO voice_agents (id, organization_id, name, persona, system_prompt, voice, status, vad_config, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     RETURNING *`,
    [
      id,
      auth.org_id,
      body.name,
      body.persona || null,
      body.system_prompt || null,
      body.voice || "alloy",
      body.status || "draft",
      body.vad_config ? JSON.stringify(body.vad_config) : null,
    ]
  );

  return NextResponse.json(agent, { status: 201 });
}
