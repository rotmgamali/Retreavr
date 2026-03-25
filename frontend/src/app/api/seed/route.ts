/**
 * POST /api/seed
 *
 * Runs the comprehensive seed SQL against the connected database.
 * Restricted to development mode or requests with SEED_SECRET header.
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/seed \
 *     -H "x-seed-secret: <SEED_SECRET env var>"
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import pool from "@/lib/db";

const SEED_SECRET = process.env.SEED_SECRET;

export async function POST(req: NextRequest) {
  // Guard: require secret header or dev environment
  const incomingSecret = req.headers.get("x-seed-secret");
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && (!SEED_SECRET || incomingSecret !== SEED_SECRET)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide x-seed-secret header." },
      { status: 401 }
    );
  }

  try {
    // Load the seed SQL from the lib directory
    const sqlPath = join(process.cwd(), "src", "lib", "seed.sql");
    const sql = await readFile(sqlPath, "utf-8");

    const client = await pool.connect();
    try {
      await client.query(sql);

      // Return row counts after seeding
      const { rows: counts } = await client.query<{
        tbl: string;
        count: string;
      }>(
        `SELECT 'organizations' AS tbl, COUNT(*)::text FROM organizations
         UNION ALL SELECT 'users', COUNT(*)::text FROM users
         UNION ALL SELECT 'voice_agents', COUNT(*)::text FROM voice_agents
         UNION ALL SELECT 'leads', COUNT(*)::text FROM leads
         UNION ALL SELECT 'calls', COUNT(*)::text FROM calls
         UNION ALL SELECT 'call_transcripts', COUNT(*)::text FROM call_transcripts
         UNION ALL SELECT 'call_summaries', COUNT(*)::text FROM call_summaries
         UNION ALL SELECT 'call_sentiments', COUNT(*)::text FROM call_sentiments
         UNION ALL SELECT 'campaigns', COUNT(*)::text FROM campaigns
         UNION ALL SELECT 'campaign_results', COUNT(*)::text FROM campaign_results
         UNION ALL SELECT 'knowledge_documents', COUNT(*)::text FROM knowledge_documents
         ORDER BY 1`
      );

      const summary = Object.fromEntries(
        counts.map(({ tbl, count }) => [tbl, parseInt(count, 10)])
      );

      return NextResponse.json({
        success: true,
        message: "Database seeded successfully.",
        counts: summary,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[seed] Error running seed SQL:", message);
    return NextResponse.json(
      { error: "Seed failed.", detail: message },
      { status: 500 }
    );
  }
}

// Reject GET requests with a helpful message
export async function GET() {
  return NextResponse.json(
    {
      info: "Use POST /api/seed to run the seed script.",
      note: "Requires x-seed-secret header in non-development environments.",
    },
    { status: 405 }
  );
}
