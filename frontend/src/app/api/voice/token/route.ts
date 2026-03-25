import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole, errorResponse } from "@/lib/api-helpers";

/**
 * POST /api/voice/token — Generate an ephemeral OpenAI Realtime API key.
 *
 * Uses the OpenAI /v1/realtime/sessions endpoint to mint a short-lived
 * token that the browser can use directly, keeping the real API key
 * server-side only.
 *
 * Body: { model?: string, voice?: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResponse("OpenAI API key not configured", 500);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const model = (body.model as string) ?? "gpt-4o-realtime-preview";
  const voice = (body.voice as string) ?? "alloy";

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        voice,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return errorResponse(`OpenAI error: ${err}`, res.status);
    }

    const data = await res.json();

    // data contains: { id, object, client_secret: { value, expires_at } }
    return NextResponse.json({
      token: data.client_secret?.value ?? null,
      expires_at: data.client_secret?.expires_at ?? null,
      session_id: data.id ?? null,
      model,
      voice,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create token";
    return errorResponse(msg, 500);
  }
}
