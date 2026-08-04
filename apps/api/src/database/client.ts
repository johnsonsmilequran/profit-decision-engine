import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";

types.setTypeParser(1082, (value) => value);

export function createDatabase(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    pool,
    orm: drizzle(pool),
  };
}

export type Database = ReturnType<typeof createDatabase>;
