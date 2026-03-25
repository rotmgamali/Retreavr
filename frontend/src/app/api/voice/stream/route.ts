/**
 * GET /api/voice/stream — Twilio Media Stream WebSocket endpoint.
 *
 * Next.js App Router does not natively support WebSocket upgrades.
 * This route serves as documentation and a fallback for non-WS requests.
 *
 * In production, the WebSocket is handled by the custom server
 * (server.ts) which intercepts upgrade requests at this path and
 * delegates to the stream-handler module.
 *
 * For Vercel serverless deployment, deploy the stream bridge on a
 * separate WebSocket-capable host and update the webhook route
 * to point to that host.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Check if this is a WebSocket upgrade attempt that slipped through
  const upgrade = req.headers.get("upgrade");
  if (upgrade?.toLowerCase() === "websocket") {
    return new NextResponse(
      "WebSocket upgrades must be handled by the custom server. " +
        "Ensure you are running with `node server.js` instead of `next dev`.",
      { status: 426 }
    );
  }

  return NextResponse.json({
    endpoint: "/api/voice/stream",
    protocol: "websocket",
    description: "Twilio Media Stream <-> OpenAI Realtime bridge",
    parameters: {
      session_id: "Required. Voice session ID from /api/voice/webhook or /api/voice/session.",
    },
    note: "This endpoint only accepts WebSocket connections. Use the custom server (server.ts) for local development.",
  });
}
