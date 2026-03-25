import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole, errorResponse, parseBody } from "@/lib/api-helpers";
import { generateQuote, type QuoteInput } from "@/lib/quotes/engine";

interface GenerateQuoteBody {
  type: "auto" | "home" | "life";
  data: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody<GenerateQuoteBody>(req);
  if (!body || !body.type || !body.data) {
    return errorResponse("Missing required fields: type, data", 400);
  }

  if (!["auto", "home", "life"].includes(body.type)) {
    return errorResponse("Invalid insurance type. Must be: auto, home, life", 400);
  }

  try {
    const input = { type: body.type, data: body.data } as unknown as QuoteInput;
    const result = generateQuote(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quote generation failed";
    return errorResponse(message, 400);
  }
}
