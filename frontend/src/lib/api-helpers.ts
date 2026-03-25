import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasRole, TokenPayload } from "./auth";

/** Standard JSON error response. */
export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Parse JSON body safely. */
export async function parseBody<T = Record<string, unknown>>(
  req: NextRequest
): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Auth + role guard in one call. Returns user payload or error response. */
export async function requireAuthAndRole(
  req: NextRequest,
  roles?: string[]
): Promise<TokenPayload | NextResponse> {
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;

  if (roles && !hasRole(result.role, roles)) {
    return errorResponse(
      `Insufficient role. Required one of: ${roles.join(", ")}`,
      403
    );
  }
  return result;
}

/** Build pagination SQL + params. */
export function paginate(
  searchParams: URLSearchParams
): { limit: number; offset: number; sql: string; params: unknown[] } {
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "20"),
    100
  );
  const offset = parseInt(searchParams.get("offset") || "0");
  return {
    limit,
    offset,
    sql: "LIMIT $__limit OFFSET $__offset",
    params: [limit, offset],
  };
}
