# TDD 验收结果 · 趣然 AI 商品经营与利润决策助手

- contract_sha256: sha256:0b66fa7a4214b8e9a0198811f74c7ed3219618ddfa9ce436339cb2b022727df9
- run_started_at: 2026-08-04T19:19:45+0800

| TDD ID | 状态 | 动作 | 证据 |
| :--- | :--- | :--- | :--- |
| SMOKE-01 | pending | 待发布候选执行完整安装、构建、Compose 与健康检查 | — |
| SMOKE-02 | pending | 待发布候选执行真实数据核心旅程 | — |
| FLOW-01 | pending | 待执行 | — |
| FLOW-02 | pending | 已完成真实 XLSX、8 路并发同指纹、领域层非法期间、必要身份缺失、重复 SPU、经营字段降级及批次/清单唯一持久化；等待批次页面浏览器 E2E | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 TEST_XLSX_PATH=…/商品链接.xlsx go test -race -count=1 -v ./internal/batch` exit 0；`TestBatchLifecycleAgainstPostgresAndRealWorkbook` 8 路并发仅 1 个非幂等结果、同一 batch_id、批次/清单 1/1，非法自然月持久化 0；`TestWorkbookValidationPreservesRowsIssuesAndMetricBoundaries` 重复 SPU 2 行拒绝、身份缺失 1 行拒绝、经营降级保留行与完整定位字段；浏览器返回 No browser is available，故不记 pass |
| FLOW-03 | pending | 已完成净销售额/源利润率、7 日品退率、14 日库存天数、零分母、负库存、汇总行排除与汇总差异警告边界；真实用户 XLSX 缺 7/14 日字段时保持未知且不补 0；等待证据抽屉/详情浏览器 E2E | 同一 `go test -race -count=1 -v ./internal/batch` exit 0；边界 XLSX 的品退率=1/100=0.01、库存天数=(100+20)/(70/14)=24、源利润率=0.1，零销售/负库存/非法利润均为 nil+独立质量态；合计行不进入 2 条有效 SPU，999 对明细 850 生成 1 条 `summary_net_sales_mismatch`；`TestRealWorkbookParsing` 真实 10 行销售/利润保留、7 日品退/库存天数均 nil；浏览器返回 No browser is available，故不记 pass |
| FLOW-04 | pending | 待执行 | — |
| FLOW-05 | pending | LiteLLM HTTP 适配器与 PostgreSQL 解释版本故障矩阵已执行；等待浏览器降级态与真实产品网关联调 | `go test -race -count=1 -v ./internal/explanation` exit 0；覆盖拒绝连接、5ms 超时、502、外层非法 JSON、缺 choice、内容非法 JSON、缺字段、冲突动作、虚构 999%、退款归因及合规恢复；每个失败版本无 content、failure_code 精确，规则/任务状态未改变；浏览器不可用且未提供产品 LiteLLM 配置，故不记 pass |
| FLOW-06 | pending | API/数据库页签、组合筛选、角色默认范围、清仓确认与完成态已执行；等待浏览器双角色 E2E 后才能判定 | `TestActionTabsAndFiltersFollowRoleProgress` 在真实 PostgreSQL 中推进待审核→待执行→执行→结果→清仓待确认→完成并通过；`make lint typecheck test build` exit 0；Compose 真实批次主管页签 `mine=6/all=7/processing=6/completed=1`，动作+运营+审核+经营+清仓+进度组合筛选 total=1；浏览器工具两次返回 `No browser is available`，故不记 pass |
| FLOW-07 | pending | 待执行 | — |
| FLOW-08 | pending | 已完成审核通过/驳回、驳回空理由、无审核权、重复提交、旧版本、原规则保留与 409 最新状态/版本/操作者/时间响应；等待主管浏览器 E2E | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 go test -race -count=1 -run 'TestSupervisorReview|TestSupervisorRejection|TestErrorResponses' -v ./internal/action ./internal/httpapi` exit 0；通过后双轨同时 pending_execution 且审核事件 1；驳回后双轨 closed、原因/操作者逐项一致、固定清仓+禁补仍保留且事件 1；隔离 Compose 重建后真实 `POST /api/suggestions/bc116354-…/review` 旧版本返回 HTTP 409，`error=version_conflict`，`latest=pending/review v1/business v1/inventory v1/actor candidate-supervisor/updated_at 2026-08-04T12:41:17.590271Z`，随后 GET 状态一致且最后事件为 version_conflict；浏览器返回 No browser is available，故不记 pass |
| FLOW-09 | pending | 已完成服务端人工改判字段存在性、动作变化、空理由、沿用禁补、旧版本、三种库存选择、已执行先终止和追加审计验证；等待主管建议详情浏览器弹窗闭环 | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 go test -race -count=1 -run 'TestSupervisorOverride' -v ./internal/action` exit 0；`TestSupervisorOverrideRequiresChangedActionAndExplicitInventoryChoice` 的 restock/no_restock/no_coordination 3/3 pass，非法请求事件数 0 且任务保持清仓+禁补；每个合法请求原固定规则仍为清仓+禁补、生效版本唯一、审计前后动作逐项一致；`TestSupervisorOverrideRequiresTerminationAfterExecution` pass；浏览器返回 No browser is available，故不记 pass |
| FLOW-10 | pending | 已完成真实 PostgreSQL 双轨独立推进、OA 送达不代业务确认、责任运营/主管/非责任运营/外部角色授权、旧版本、幂等重试和实际经营结果值持久化；等待双轨/结果浏览器闭环 | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 go test -race -count=1 -run 'TestOperationalCommands|TestOAFailure' -v ./internal/action` exit 0；`TestOperationalCommandsEnforceOwnershipVersionsAndIdempotency` 断言业务/协同/结果各 1 条事件，OA sent 后协同仍 pending_execution，结果周期 2026-07-01..31、销售 73210.5、利润 -5800.25、库存 2140、记录人/备注逐项持久化；`TestOAFailureCanRetryWithoutChangingInventoryState` pass；浏览器返回 No browser is available，故不记 pass |
| FLOW-11 | pending | 已完成真实 PostgreSQL 跨两个 Asia/Shanghai 自然日并发催办、首次发送失败/人工补发、主管确认停催及改判/终止停催；等待运营/主管浏览器闭环 | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 go test -race -count=1 -v ./internal/action` exit 0；`TestClearanceReminderIsUniqueAcrossConcurrentShanghaiDaysAndStopsAfterConfirmation` 断言 2 个自然日恰有 2 条通知、3 次发送尝试、确认后次日新增 0；`TestClearanceReminderStopsAfterOverrideOrTermination` 2/2 pass；浏览器返回 No browser is available，故不记 pass |
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
| RULE-01 | pass | 对 4 组冻结快照执行每组 3 次串行、24 次并发重放，覆盖销售/利润/新品阈值边界；真实 XLSX 批次完成后重建 Worker 3 次，验证不重领完成任务且冻结决策 JSON 逐字节一致 | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 TEST_XLSX_PATH=…/商品链接.xlsx go test -race -count=1 -v ./internal/batch` exit 0；`TestDecisionRuleBoundaries` 4/4 子用例 pass；`TestDecisionIsStableAcrossSerialAndConcurrentReplay` pass；`TestBatchLifecycleAgainstPostgresAndRealWorkbook` pass（3 次 Worker restart 均 `processed=false`，10 条决策重放前后 JSON bytes 相等） |
| RULE-02 | pending | 已补齐 OA 独立白名单 DTO、稳定任务引用、真实 PostgreSQL 消息快照与 HTTP 出站敏感字段负向扫描；等待浏览器遍历全部页面/错误/历史路径及公司 OA 正式回执 | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 go test -race -count=1 -v ./internal/oa ./internal/action` exit 0；`TestClientSendsOnlyNotificationWhitelist` 精确断言 7 个字段且扫描利润/推广/品退/售后/阈值/审核为 0；`TestOAFailureCanRetryWithoutChangingInventoryState` 真实 PostgreSQL 持久化与 HTTP 接收负载的 `spu_id/task_reference/action/operator` 逐项一致；浏览器与公司 OA 尚无可用外部资源，故不记 pass |
| RULE-03 | pending | 待执行 | — |
| RULE-04 | pending | LiteLLM 故障注入与同一 decision 追加版本已完成；等待浏览器中继续审核/执行/结果的降级闭环 | `TestClientFailsClosedForGatewayAndContentFaults` 8/8、`TestClientFailsClosedForConnectionRefusalAndTimeout`、`TestProcessorAppendsFaultVersionsWithoutChangingFrozenDecisionOrTask` 4/4、`TestProcessorPersistsValidatedExplanationWithoutChangingBusinessState` 均 pass；真实 PostgreSQL 保持 business/inventory/rule_version/trigger_rule 完全不变；浏览器返回 No browser is available，故不记 pass |
| RULE-05 | pass | 建立真实导入至闭环事件链，验证跨周前序/改判集成测试、不可变约束，并把 PostgreSQL 与 XLSX 快照恢复到全新 Compose 项目后从生产 API 读取 | `TEST_DATABASE_URL=postgres://…/candidate_tests_1936 TEST_XLSX_PATH=…/商品链接.xlsx go test -race ./...` exit 0（含跨周关联、改判、审核、执行、结果、清仓、OA 与冲突用例）；候选真实链=1 batch/10 snapshots/10 decisions/7 tasks/7 links/23 events/1 result/1 clearance/1 OA；`backup.sh` 生成 `database.dump+import-files.tar.gz+manifest+SHA256SUMS`；`restore.sh` 三项摘要 OK 且 `restore_status=complete batch_count=1 xlsx_file_count=1`；源/恢复上述 9 组计数逐项相等，恢复 API `/api/history?...683939339441` HTTP 200、audit_count=2、closed/processed；恢复 XLSX sha256=`af37a29543bf5a37117985e70619bee2534190a22655359d6e005ea80058cf5f`；原位 UPDATE snapshot 与 DELETE event 均 exit 1 `immutable batch artifact cannot be changed`；二次恢复 exit 3 `restore target table public.role_mapping is not empty`；本轮恢复耗时秒级，恢复点为本轮即时快照 |
