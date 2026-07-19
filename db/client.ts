import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Returns a Drizzle client connected to Neon via the DATABASE_URL env var.
 * Safe to call in every Vercel function (Neon uses HTTP — no persistent connections).
 */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof getDb>;
