import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "./client.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("生产业务 schema", () => {
  let database: Database;
  const identity = `schema-test-${randomUUID()}`;

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    await database.pool.query(
      "insert into role_mappings(identity_ref, display_name, business_role) values ($1, $2, 'operator')",
      [identity, "真实数据库约束测试运营"],
    );
  });

  afterAll(async () => {
    await database.pool.query("delete from role_mappings where identity_ref = $1", [identity]);
    await database.pool.end();
  });

  it("数据库唯一约束阻止相同批次指纹建立第二批次", async () => {
    const fingerprint = `fingerprint-${randomUUID()}`;
    const storedFilename = `${randomUUID()}.xlsx`;
    const values = [
      fingerprint,
      storedFilename,
      "a".repeat(64),
      identity,
    ];
    const insert = `
      insert into import_batches(
        fingerprint, business_unit, period_start, period_end, business_date,
        original_filename, stored_filename, file_sha256, file_size_bytes, status, created_by
      ) values ($1, '玩具事业部', '2026-07-01', '2026-07-31', '2026-07-31',
        '经营表.xlsx', $2, $3, 128, 'received', $4)
      returning id
    `;
    const first = await database.pool.query<{ id: string }>(insert, values);
    await expect(database.pool.query(insert, values)).rejects.toMatchObject({ code: "23505" });
    await database.pool.query("delete from import_batches where id = $1", [first.rows[0]!.id]);
  });

  it("驳回建议没有非空原因时由数据库拒绝", async () => {
    const batch = await database.pool.query<{ id: string }>(
      `insert into import_batches(
        fingerprint, business_unit, period_start, period_end, business_date,
        original_filename, stored_filename, file_sha256, file_size_bytes, status, created_by
      ) values ($1, '玩具事业部', '2026-07-01', '2026-07-31', '2026-07-31',
        '经营表.xlsx', $2, $3, 128, 'received', $4) returning id`,
      [`fingerprint-${randomUUID()}`, `${randomUUID()}.xlsx`, "b".repeat(64), identity],
    );
    const snapshot = await database.pool.query<{ id: string }>(
      `insert into spu_snapshots(batch_id, spu_id, link_name, shop, platform, operator_name, raw_values)
       values ($1, 'SPU-约束测试', '约束测试商品', '测试店铺', '测试平台', '测试运营', '{}') returning id`,
      [batch.rows[0]!.id],
    );
    await expect(
      database.pool.query(
        `insert into decisions(
          batch_id, spu_snapshot_id, rule_version, product_type, main_action, inventory_action,
          trigger_rules, key_values, structured_advice, approval_status, review_note,
          reviewed_by, reviewed_at
        ) values ($1, $2, 'RULE-V1', 'eliminated', 'clearance', 'block_restock',
          '[]', '{}', '{}', 'rejected', '', $3, now())`,
        [batch.rows[0]!.id, snapshot.rows[0]!.id, identity],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await database.pool.query("delete from spu_snapshots where id = $1", [snapshot.rows[0]!.id]);
    await database.pool.query("delete from import_batches where id = $1", [batch.rows[0]!.id]);
  });
});
