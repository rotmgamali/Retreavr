import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuthAndRole } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  // A/B tests with variant data
  const tests = await query(
    `SELECT
       t.id, t.name, t.status,
       json_agg(json_build_object(
         'id', v.id, 'name', v.name,
         'config', v.config, 'traffic_weight', v.traffic_weight
       ) ORDER BY v.created_at) AS variants
     FROM ab_tests t
     LEFT JOIN ab_test_variants v ON v.ab_test_id = t.id
     WHERE t.organization_id = $1
     GROUP BY t.id, t.name, t.status
     ORDER BY t.created_at DESC`,
    [auth.org_id]
  );

  // Get result metrics per variant
  const results = await query(
    `SELECT r.variant_id, r.metrics, r.sample_size
     FROM ab_test_results r
     JOIN ab_tests t ON t.id = r.ab_test_id
     WHERE t.organization_id = $1`,
    [auth.org_id]
  );

  const resultMap = new Map<string, { metrics: Record<string, unknown>; sample_size: number }>();
  for (const r of results as Array<{ variant_id: string; metrics: Record<string, unknown>; sample_size: number }>) {
    if (r.variant_id) resultMap.set(r.variant_id, r);
  }

  return NextResponse.json(
    tests.map((t: Record<string, unknown>) => {
      const variants = (t.variants as Array<{ id: string; name: string; config: Record<string, unknown>; traffic_weight: number }>) || [];
      const [vA, vB] = variants;

      const rA = vA ? resultMap.get(vA.id) : null;
      const rB = vB ? resultMap.get(vB.id) : null;

      return {
        id: t.id,
        name: t.name,
        status: t.status === "active" ? "running" : t.status,
        variantA: {
          name: vA?.name || "Control",
          convRate: (rA?.metrics as Record<string, number>)?.conversion_rate ?? 0,
          calls: rA?.sample_size ?? 0,
        },
        variantB: {
          name: vB?.name || "Variant B",
          convRate: (rB?.metrics as Record<string, number>)?.conversion_rate ?? 0,
          calls: rB?.sample_size ?? 0,
        },
        confidence: Math.min(
          ((rA?.sample_size ?? 0) + (rB?.sample_size ?? 0)) / 200,
          0.99
        ) * 100,
      };
    })
  );
}
