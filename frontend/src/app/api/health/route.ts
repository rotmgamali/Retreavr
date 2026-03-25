import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({
      status: "healthy",
      service: "Retrevr Insurance Platform",
      database: "connected",
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "Retrevr Insurance Platform",
        database: "disconnected",
      },
      { status: 503 }
    );
  }
}
