/**
 * Custom Next.js server with WebSocket support for Twilio media streams.
 *
 * Usage:
 *   npx tsx server.ts        # development
 *   node server.js            # production (after next build + tsc)
 *
 * This server runs standard Next.js HTTP handling, plus intercepts
 * WebSocket upgrade requests at /api/voice/stream and delegates
 * them to the Twilio <-> OpenAI Realtime bridge.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { handleTwilioStream } from "./src/lib/voice-engine/stream-handler";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server — no auto-listen, we handle upgrades manually
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url ?? "/", true);

    if (pathname === "/api/voice/stream") {
      const sessionId = query.session_id as string | undefined;

      if (!sessionId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
        // Adapt ws.WebSocket to our minimal WS interface
        handleTwilioStream(ws as unknown as Parameters<typeof handleTwilioStream>[0], sessionId);
      });
    } else {
      // Let Next.js handle HMR WebSocket upgrades in dev
      if (dev) return;
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket stream: ws://${hostname}:${port}/api/voice/stream`);
  });
});
