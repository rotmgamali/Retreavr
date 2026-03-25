import { NextRequest, NextResponse } from "next/server";
import { requireAuth, TokenPayload } from "./auth";

/** Require superadmin role. Returns TokenPayload or 401/403 response. */
export async function requireSuperAdmin(
  req: NextRequest
): Promise<TokenPayload | NextResponse> {
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;

  if (result.role !== "superadmin") {
    return NextResponse.json(
      { error: "Forbidden: superadmin role required" },
      { status: 403 }
    );
  }
  return result;
}
