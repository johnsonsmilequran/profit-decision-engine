# TDD 验收结果

- source_contract: `TDD验收契约.md`
- contract_sha256: `fa61742301d677a9165545d760d32027ce04600e6924616032a6cc57167afdb5`
- run_started_at: `2026-08-04T16:56:26+0800`
- evidence_policy: 仅发布候选阶段本轮真实执行所得命令、API、数据库、浏览器或截图证据可将状态改为 pass。
- latest_development_check: `2026-08-04 18:14`，新增真实数据库 F05 集成检查：导入 XLSX 后行动清单按清仓→加投固定顺序返回，建议详情回传 -18.6% 快照、清仓+禁补双轨状态及对象/问题/依据/动作四要素；API 定向测试 3/3 与 API 类型检查通过。此前 API 源码测试 30/30、Web 测试 8/8、生产构建及依赖审计证据仍为开发期参考。该证据未进入发布候选，以下状态保持 pending。

| TDD ID | 状态 | 动作 | 证据 |
| :--- | :--- | :--- | :--- |
| SMOKE-01 | pending | 待执行安装、全量工程门禁、启动与浏览器冒烟 | - |
| SMOKE-02 | pending | 待执行真实导入至双角色执行和经营结果端到端闭环 | - |
| FLOW-01 | pending | 待执行 XLSX 导入、幂等、期间与字段降级验收 | - |
| FLOW-02 | pending | 待执行经营指标及字段异常验收 | - |
| FLOW-03 | pending | 待执行版本化固定规则边界及事务验收 | - |
| FLOW-04 | pending | 待执行 LiteLLM 成功、失败与越界降级验收 | - |
| FLOW-05 | pending | 待执行行动清单、历史、筛选、排序与收录验收 | - |
| FLOW-06 | pending | 待执行审核、双动作、结果、并发与职责验收 | - |
| FLOW-07 | pending | 待执行钉钉认证及多角色权限验收 | - |
| FLOW-08 | pending | 待执行快照、事件及历史追溯验收 | - |
| DESIGN-01 | pending | 待执行 PAGE-F00-01 行为与独立视觉验收 | - |
| DESIGN-02 | pending | 待执行 PAGE-F01-01 行为与独立视觉验收 | - |
| DESIGN-03 | pending | 待执行 PAGE-F01-02 行为与独立视觉验收 | - |
| DESIGN-04 | pending | 待执行 PAGE-F01-03 行为与独立视觉验收 | - |
| DESIGN-05 | pending | 待执行 PAGE-F05-01 行为与独立视觉验收 | - |
| DESIGN-06 | pending | 待执行 PAGE-F05-02 行为与独立视觉验收 | - |
| DESIGN-07 | pending | 待执行 PAGE-F06-01 行为与独立视觉验收 | - |
| DESIGN-08 | pending | 待执行 PAGE-F06-02 行为与独立视觉验收 | - |
| DESIGN-09 | pending | 待执行 PAGE-F06-03 行为与独立视觉验收 | - |
| DESIGN-10 | pending | 待执行 PAGE-F06-04 行为与独立视觉验收 | - |
| DESIGN-11 | pending | 待执行 PAGE-F07-01 行为与独立视觉验收 | - |
| DESIGN-12 | pending | 待执行 PAGE-F07-02 行为与独立视觉验收 | - |
| DESIGN-13 | pending | 待执行 PAGE-F08-01 行为与独立视觉验收 | - |
| RULE-01 | pending | 待执行确定性重放及数据库结果比较 | - |
| RULE-02 | pending | 待执行采购全路径最小可见验收 | - |
| RULE-03 | pending | 待执行凭据泄露扫描 | - |
| RULE-04 | pending | 待执行 AI 故障注入下人工闭环验收 | - |
| RULE-05 | pending | 待执行审计完整率及事务原子性验收 | - |
