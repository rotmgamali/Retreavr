import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  // Lead sources breakdown from metadata->source or insurance_type as fallback
  const rows = await query(
    `SELECT
       COALESCE(metadata->>'source', insurance_type, 'Unknown') AS name,
       COUNT(*) AS value
     FROM leads
     WHERE organization_id = $1 AND is_deleted = false
     GROUP BY name
     ORDER BY value DESC
     LIMIT 10`,
    [auth.org_id]
  );

  return NextResponse.json(
    rows.map((r: Record<string, unknown>) => ({
      name: r.name || "Unknown",
      value: parseInt(r.value as string),
    }))
  );
}
