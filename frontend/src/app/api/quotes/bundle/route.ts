import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole, errorResponse, parseBody } from "@/lib/api-helpers";
import { generateBundleQuotes, type QuoteInput } from "@/lib/quotes/engine";

interface BundleQuoteBody {
  quotes: Array<{
    type: "auto" | "home" | "life";
    data: Record<string, unknown>;
  }>;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody<BundleQuoteBody>(req);
  if (!body || !Array.isArray(body.quotes) || body.quotes.length === 0) {
    return errorResponse("Missing required field: quotes (non-empty array)", 400);
  }

  if (body.quotes.length > 5) {
    return errorResponse("Maximum 5 policies per bundle", 400);
  }

  for (const q of body.quotes) {
    if (!["auto", "home", "life"].includes(q.type)) {
      return errorResponse(`Invalid insurance type: ${q.type}`, 400);
    }
  }

  try {
    const inputs = body.quotes as unknown as QuoteInput[];
    const result = generateBundleQuotes(inputs);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bundle quote generation failed";
    return errorResponse(message, 400);
  }
}
