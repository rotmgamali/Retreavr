import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.POSTGRES_HOST) {
      throw new Error("POSTGRES_HOST environment variable is required");
    }
    if (!process.env.POSTGRES_PASSWORD) {
      throw new Error("POSTGRES_PASSWORD environment variable is required");
    }
    pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
      database: process.env.POSTGRES_DB || "postgres",
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 10,
      statement_timeout: 30000,
    });
  }
  return pool;
}

export function getPoolInstance(): Pool {
  return getPool();
}

export default { query: (text: string, params?: unknown[]) => getPool().query(text, params) };

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
