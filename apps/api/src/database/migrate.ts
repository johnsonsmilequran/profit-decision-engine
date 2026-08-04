import { readDatabaseUrl } from "../config.js";
import { createDatabase } from "./client.js";
import { readdir, readFile } from "node:fs/promises";

const database = createDatabase(readDatabaseUrl());

await database.pool.query(`
  create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`);

const migrationsDirectory = new URL("../../migrations/", import.meta.url);
const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const client = await database.pool.connect();
try {
  await client.query("select pg_advisory_lock(2026080401)");
  for (const name of migrationNames) {
    const existing = await client.query("select 1 from schema_migrations where name = $1", [name]);
    if (existing.rowCount) {
      continue;
    }
    const sql = await readFile(new URL(name, migrationsDirectory), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations(name) values ($1)", [name]);
      await client.query("commit");
      console.log(`已应用迁移 ${name}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.query("select pg_advisory_unlock(2026080401)");
  client.release();
  await database.pool.end();
}

console.log("数据库迁移完成");
