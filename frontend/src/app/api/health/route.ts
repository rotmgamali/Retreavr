import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const ok = res.ok;
    return NextResponse.json({
      status: ok ? "healthy" : "degraded",
      service: "Retrevr Insurance Platform",
      backend: ok ? "connected" : "unreachable",
    }, { status: ok ? 200 : 503 });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "Retrevr Insurance Platform",
        backend: "unreachable",
      },
      { status: 503 },
    );
  }
}
