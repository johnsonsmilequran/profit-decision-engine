# TDD 验收结果 · 趣然 AI 商品经营与利润决策助手

- contract_sha256: sha256:0b66fa7a4214b8e9a0198811f74c7ed3219618ddfa9ce436339cb2b022727df9
- run_started_at: 2026-08-04T19:19:45+0800

| TDD ID | 状态 | 动作 | 证据 |
| :--- | :--- | :--- | :--- |
| SMOKE-01 | pending | 待发布候选执行完整安装、构建、Compose 与健康检查 | — |
| SMOKE-02 | pending | 待发布候选执行真实数据核心旅程 | — |
| FLOW-01 | pending | 待执行 | — |
| FLOW-02 | pending | 待执行 | — |
| FLOW-03 | pending | 待执行 | — |
| FLOW-04 | pending | 待执行 | — |
| FLOW-05 | pending | 待执行 | — |
| FLOW-06 | pending | 待执行 | — |
| FLOW-07 | pending | 待执行 | — |
| FLOW-08 | pending | 待执行 | — |
| FLOW-09 | pending | 待执行 | — |
| FLOW-10 | pending | 待执行 | — |
| FLOW-11 | pending | 待执行 | — |
| FLOW-12 | pending | 待执行 | — |
| DESIGN-01 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| DESIGN-02 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| DESIGN-03 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| DESIGN-04 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| DESIGN-05 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| DESIGN-06 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| DESIGN-07 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| DESIGN-08 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| DESIGN-09 | pending | 待生成同状态截图并由独立视觉验收官看图 | — |
| RULE-01 | pending | 待执行 | — |
| RULE-02 | pending | 待执行 | — |
| RULE-03 | pending | 待执行 | — |
| RULE-04 | pending | 待执行 | — |
| RULE-05 | pass | 建立真实导入至闭环事件链，验证跨周前序/改判集成测试、不可变约束，并把 PostgreSQL 与 XLSX 快照恢复到全新 Compose 项目后从生产 API 读取 | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 TEST_XLSX_PATH=…/商品链接.xlsx go test -race ./...` exit 0（含跨周关联、改判、审核、执行、结果、清仓、OA 与冲突用例）；候选真实链=1 batch/10 snapshots/10 decisions/7 tasks/7 links/23 events/1 result/1 clearance/1 OA；`backup.sh` 生成 `database.dump+import-files.tar.gz+manifest+SHA256SUMS`；`restore.sh` 三项摘要 OK 且 `restore_status=complete batch_count=1 xlsx_file_count=1`；源/恢复上述 9 组计数逐项相等，恢复 API `/api/history?...683939339441` HTTP 200、audit_count=2、closed/processed；恢复 XLSX sha256=`af37a29543bf5a37117985e70619bee2534190a22655359d6e005ea80058cf5f`；原位 UPDATE snapshot 与 DELETE event 均 exit 1 `immutable batch artifact cannot be changed`；二次恢复 exit 3 `restore target table public.role_mapping is not empty`；本轮恢复耗时秒级，恢复点为本轮即时快照 |
