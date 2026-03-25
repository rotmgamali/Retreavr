import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const agent = await queryOne(
    "SELECT * FROM voice_agents WHERE id = $1 AND organization_id = $2",
    [params.agentId, auth.org_id]
  );

  if (!agent) return errorResponse("Voice agent not found", 404);
  return NextResponse.json(agent);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body) return errorResponse("Invalid JSON", 400);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ["name", "persona", "system_prompt", "voice", "status"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(body[key]);
    }
  }
  if (body.vad_config !== undefined) {
    fields.push(`vad_config = $${idx++}`);
    values.push(JSON.stringify(body.vad_config));
  }

  if (fields.length === 0) return errorResponse("No fields to update", 400);

  fields.push(`updated_at = NOW()`);
  values.push(params.agentId, auth.org_id);

  const agent = await queryOne(
    `UPDATE voice_agents SET ${fields.join(", ")}
     WHERE id = $${idx++} AND organization_id = $${idx}
     RETURNING *`,
    values
  );

  if (!agent) return errorResponse("Voice agent not found", 404);
  return NextResponse.json(agent);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const agent = await queryOne(
    `UPDATE voice_agents SET status = 'inactive', updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [params.agentId, auth.org_id]
  );

  if (!agent) return errorResponse("Voice agent not found", 404);
  return new NextResponse(null, { status: 204 });
}
