import { readConfig } from "../config.js";
import { createDatabase } from "./client.js";

const config = readConfig();
const database = createDatabase(config.DATABASE_URL);

await database.pool.query(`
  create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`);

await database.pool.end();
console.log("数据库迁移基础设施已就绪");
