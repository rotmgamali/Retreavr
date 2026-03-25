import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  // Live agent status: active agents with today's call counts and on-call duration
  const rows = await query(
    `SELECT
       va.id,
       va.name,
       va.status AS agent_status,
       COUNT(c.id) FILTER (WHERE c.created_at::date = CURRENT_DATE) AS calls_today,
       COALESCE(SUM(c.duration) FILTER (WHERE c.created_at::date = CURRENT_DATE), 0) AS seconds_on_call,
       EXISTS (
         SELECT 1 FROM calls ac
         WHERE ac.agent_id = va.id AND ac.status = 'in-progress' AND ac.is_deleted = false
       ) AS is_on_call
     FROM voice_agents va
     LEFT JOIN calls c ON c.agent_id = va.id AND c.is_deleted = false
     WHERE va.organization_id = $1
     GROUP BY va.id, va.name, va.status`,
    [auth.org_id]
  );

  return NextResponse.json(
    rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      name: r.name,
      status: r.is_on_call
        ? "On Call"
        : r.agent_status === "active"
          ? "Available"
          : r.agent_status === "inactive"
            ? "Offline"
            : "Paused",
      callsToday: parseInt(r.calls_today as string),
      secondsOnCall: parseInt(r.seconds_on_call as string),
    }))
  );
}
