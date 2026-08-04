# TDD 验收结果 · 趣然 AI 商品经营与利润决策助手

- contract_sha256: sha256:2fba40f6abd94224579b7a5c2af166e3ce5b3d87ee774dfa2036ccb3cc0ccf8c
- run_started_at: 2026-08-05T04:38:55+08:00

| TDD ID | 状态 | 动作 | 证据 |
| :--- | :--- | :--- | :--- |
| SMOKE-01 | pending | 在干净检出 `1cc8252` 的空 PostgreSQL 库执行完整前后端门禁，并构建启动全新 RC3 Compose 后检查健康、登录壳和匿名拒绝；待浏览器连接恢复后补真实页面交互 | 干净检出 `/tmp/profit-rc-gate.WWd8z6/repo`：迁移 00001–00005、`go mod download`、gofmt、`go vet ./...`、`go test -race -count=1 ./...`、`go build ./cmd/...`、`npm ci`、OpenAPI generate/diff、lint、typecheck、Vitest、build 均 exit 0；RC3 db healthy、migrate exit 0、api/worker/web Up，`/health/ready`=200 ready、`/health/live`=200 ok、`/login`=200 React、匿名 `/api/session`=401；当前浏览器发现列表为空，故不提前记 pass |
| SMOKE-02 | pending | 本轮尚未执行 | 本轮尚无证据 |
| FLOW-01 | pending | 在全新数据库执行钉钉 OAuth 协议、会话生命周期、角色变化和安全返回地址测试；待真实测试账号回调与浏览器权限矩阵 | 干净检出 `go test -race -count=1 ./...` 中 `internal/identity`、`internal/httpapi` 均 exit 0；`TestDingTalkOAuthContract`、`TestDingTalkOAuthFailsClosed`、`TestSessionLifecycleAgainstPostgres`、`TestSafeReturn` 全过；尚无本轮真实 unionId 回调和页面证据 |
| FLOW-02 | pending | 用原始 `商品链接.xlsx` 在全新数据库执行真实解析、合法导入、幂等/并发、非法期间、身份与经营字段降级测试，并通过 RC3 产品 API 再导入一次；待浏览器批次状态操作 | `internal/batch` race 测试 exit 0；RC3 API 返回 `BATCH-20260630-F14F13E5`，Worker 投影为 ready，数据库为 1 batch/10 snapshots/10 decisions、有效10/拒绝0/降级10/警告1；缺浏览器状态流证据 |
| FLOW-03 | pending | 执行指标边界、异常值、汇总排除与真实工作簿字段质量测试；待浏览器证据抽屉和详情操作 | `TestWorkbookValidationPreservesRowsIssuesAndMetricBoundaries`、`TestRealWorkbookParsing`、`TestMissingReturnDataCannotProveInvestment` 在全新库均 pass；缺本轮真实页面抽屉与详情 E2E |
| FLOW-04 | pending | 执行全部商品分类、阈值边界、证据不足、唯一动作和重放测试；待浏览器清单/详情断言 | `TestDecisionRuleBoundaries` 13/13、`TestInsufficientRuleEvidenceDoesNotInventDependentActions` 5/5、真实工作簿生命周期测试均 pass；缺本轮清单与详情 E2E |
| FLOW-05 | pending | 执行 LiteLLM 合法、连接拒绝、超时、5xx、非法 JSON、缺字段、冲突动作、虚构数字和敏感归因故障矩阵；待真实网关恢复与浏览器降级闭环 | `internal/explanation` race 测试 exit 0，`TestClientFailsClosedForGatewayAndContentFaults` 8/8、连接/超时、故障版本追加和合规解释持久化均 pass；本轮尚无真实 LiteLLM 调用和页面证据 |
| FLOW-06 | pending | 执行最新批次、双角色范围、四页签、组合筛选、分页和经营轨计数测试；待双角色浏览器操作 | `internal/action` race 测试 exit 0，`TestActionTabsAndFiltersFollowRoleProgress`、`TestWorkbenchKeepsLatestReadyBatchWhenOperationsHasNoMineItems`、`TestWorkbenchPendingExecutionCountsOnlyBusinessTrack` 均 pass；缺本轮浏览器 E2E |
| FLOW-07 | pending | 在真实 PostgreSQL 连续建立三周期同 SPU 的清仓、清仓、动作变化，验证稳定任务、动作版本和最近前序快照；待浏览器折叠/展开 | `TestActionLifecycleContinuesStableTaskAndStagesChangedAction` pass：稳定任务不重复、三条周关联、动作变化追加版本且前序按原快照投影；缺本轮键盘/鼠标页面 E2E |
| FLOW-08 | pending | 执行主管通过、驳回、幂等、旧版本冲突和首次续接审核激活测试；待主管浏览器逐条审核 | `TestSupervisorReviewIsVersionedAndIdempotent`、`TestSupervisorRejectionRequiresReasonAndPreservesRule`、`TestFirstReviewOnPendingContinuationActivatesTask` 均 pass；缺本轮主管页面 E2E |
| FLOW-09 | pending | 执行人工改判三类库存选择、空理由、沿用禁补、已执行保护、终止后改判和版本冲突测试；待详情弹层操作 | `TestSupervisorOverrideRequiresChangedActionAndExplicitInventoryChoice` 3/3 与 `TestSupervisorOverrideRequiresTerminationAfterExecution` 均 pass；缺本轮建议详情 E2E |
| FLOW-10 | pending | 执行双轨责任人、OA 失败补发、白名单、重复/旧版本与结果持久化测试；待本轮真实钉钉状态查询和浏览器闭环 | `TestOperationalCommandsEnforceOwnershipVersionsAndIdempotency`、`TestOAFailureCanRetryWithoutChangingInventoryState` 及 `internal/oa` 协议测试均 pass；尚未取得本轮机器人官方回执和页面证据 |
| FLOW-11 | pending | 执行清仓完成双人确认、跨日并发提醒、唯一/未配置/歧义收件映射和改判/终止停催测试；待本轮真实 Worker 回执与双角色浏览器 | `TestClearanceCompletionNeedsSupervisorConfirmation`、`TestClearanceReminderIsUniqueAcrossConcurrentShanghaiDaysAndStopsAfterConfirmation`、映射歧义/未配置、改判/终止停催测试均 pass；尚缺本轮外部与页面证据 |
| FLOW-12 | pending | 执行历史冻结投影、驳回/部分执行/改判、权限裁剪与不可变约束测试；待历史组合检索和只读详情浏览器 E2E | `TestHistoryKeepsFrozenBatchDecisionAndAppliesRoleProjection`、`TestHistoryProjectsRejectedAndPartiallyExecutedSuggestions`、直接访问隐藏对象测试均 pass；缺本轮浏览器证据 |
| DESIGN-01 | pending | 本轮尚未执行 | 本轮尚无证据 |
| DESIGN-02 | pending | 本轮尚未执行 | 本轮尚无证据 |
| DESIGN-03 | pending | 本轮尚未执行 | 本轮尚无证据 |
| DESIGN-04 | pending | 本轮尚未执行 | 本轮尚无证据 |
| DESIGN-05 | pending | 本轮尚未执行 | 本轮尚无证据 |
| DESIGN-06 | pending | 本轮尚未执行 | 本轮尚无证据 |
| DESIGN-07 | pending | 本轮尚未执行 | 本轮尚无证据 |
| DESIGN-08 | pending | 本轮尚未执行 | 本轮尚无证据 |
| DESIGN-09 | pending | 本轮尚未执行 | 本轮尚无证据 |
| RULE-01 | pass | 在全新 PostgreSQL 库对同一冻结快照串行/并发重放、阈值边界与真实工作簿 Worker 重启执行确定性验证 | 干净检出 `TEST_DATABASE_URL=…candidate_tests_0442 TEST_XLSX_PATH=…/商品链接.xlsx go test -race -count=1 ./...` exit 0；`TestDecisionIsStableAcrossSerialAndConcurrentReplay`、`TestDecisionRuleBoundaries`、`TestBatchLifecycleAgainstPostgresAndRealWorkbook` 全过，固定规则不受 AI 或领取顺序影响 |
| RULE-02 | pending | 执行双角色/匿名/无权对象 API 与钉钉白名单、失败名单、不重试协议测试；待本轮页面权限矩阵和官方机器人回执 | `TestSuggestionDirectAccessHidesObjectFromUnauthorizedActors`、`TestAnonymousSuggestionDirectAccessDoesNotRevealObject`、`TestDingTalkClientSendsRobotOneToOneWhitelist` 与三类收件失败测试均 pass；尚缺本轮浏览器和真实外部证据 |
| RULE-03 | pending | 完成干净构建、Compose 日志和受控响应前置检查；待可轮换哨兵密钥、旧密钥失效窗口及完整扫描 | 前后端干净门禁、RC3 Compose 构建/健康均成功，日志未见 panic/fatal；本轮未执行运维密钥轮换，不能记 pass |
| RULE-04 | pending | 对 LiteLLM 全故障矩阵和解释版本数据库追加执行 race 测试；待故障中浏览器人工闭环 | `internal/explanation` 全包 exit 0；拒绝连接、超时、5xx、非法响应、动作冲突、虚构数字、敏感内容均失败关闭，合规恢复只追加版本且业务状态不变；缺页面 E2E |
| RULE-05 | pass | 在 RC3 由真实产品 API 导入原始 XLSX 后运行完整 action 事件链，停止 Worker 取得静止点备份；校验三项 SHA256，恢复到全新空 Compose 并逐项比较关联，随后验证非空目标拒绝二次恢复 | `backup.sh` 生成 `/tmp/profit-rule05-rc3-stable.y3YnAi/20260804T204552Z`，database.dump/import-files.tar.gz/manifest.txt 均 OK；`restore.sh` exit 0；源/恢复计数完全相同=batch25,snapshot34,decision34,task31,link31,event65,result3,clearance4,notification11,role6；XLSX SHA 两端均为 `af37a29543bf5a37117985e70619bee2534190a22655359d6e005ea80058cf5f`；二次恢复因非空 user_session 明确拒绝 |
