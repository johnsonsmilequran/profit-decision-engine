# TDD 验收结果 · 趣然 AI 商品经营与利润决策助手

- contract_sha256: sha256:86e926125c96eb73c9e5a19bfc9a1ee5f74d2a05c72af4fb00de8a5988402221
- run_started_at: 2026-08-04T15:30:48+0800
- run_completed_at: 2026-08-05T01:52:36+0800

> 本台账在任何生产代码改动前建立。开发阶段保持 `pending`；仅发布候选阶段按契约真实执行并留下本轮证据后更新状态。

| TDD ID | 状态 | 动作 | 证据 |
| :--- | :--- | :--- | :--- |
| `SMOKE-01` | `passed` | 安装、构建、启动与健康检查 | 前后端生产构建成功；Compose 的 PostgreSQL/Web 健康，Worker/Backup 运行；`GET /api/health` 返回 `status=ok,database=ok` |
| `SMOKE-02` | `passed` | 跨角色核心用户旅程 | 本地钉钉协议服务驱动真实 OAuth 会话；运营、主管、采购三角色完成清单、审核、分轨执行与追溯旅程 |
| `FLOW-01` | `passed` | 导入、幂等与字段降级 | 真实 XLSX 批次 `BAT-6ecbf6d273a24144b4b583c3ad261c36`：11 有效、1 拒绝、1 降级；重复导入命中既有批次；后端测试通过 |
| `FLOW-02` | `passed` | 指标口径与数据质量 | `pytest -q` 覆盖解析、经营准利润、净销售额、品退率与降级字段；28/28 通过 |
| `FLOW-03` | `passed` | 固定规则边界 | 规则优先级、阈值边界、动作原子与不可判定分支测试通过；规则快照为 `RULE-V1.0` |
| `FLOW-04` | `passed` | AI 解释、过滤与降级 | AI 超时、异常、非法动作、敏感内容和不可用降级 5 类测试通过；固定规则建议始终可继续处理 |
| `FLOW-05` | `passed` | 清单唯一性、筛选与排序 | 数据库唯一约束与 API 测试通过；浏览器证据 `PAGE-F05-02-baseline.png` 覆盖 8 筛选、卡片与分页 |
| `FLOW-06` | `passed` | 建议整体审核 | 主管真实会话打开整条建议确认层；版本化审核接口与事件写入测试通过；`PAGE-F05-03-confirm.png` 留证 |
| `FLOW-07` | `passed` | 分角色动作与结果 | 运营与采购分别完成动作执行、结果回填；追溯页存在中文动作执行/结果回填事件与前后状态 |
| `FLOW-08` | `passed` | 并发与幂等 | 审核/动作 version 冲突返回 409，重复请求保持幂等；相关 API 与数据库测试通过 |
| `FLOW-09` | `passed` | 运营与主管权限 | 真实 OAuth 映射到运营、运营主管；页面能力、审核权限与服务端拒绝矩阵验证通过 |
| `FLOW-10` | `passed` | 采购最小可见 | 采购真实会话仅见采购轨道与必要证据；经营敏感字段和主管审核能力由服务端过滤/拒绝 |
| `FLOW-11` | `passed` | 钉钉认证与默认拒绝 | 一次性 state、换票、HttpOnly 会话、CSRF、未映射身份无权限页与默认拒绝测试通过 |
| `FLOW-12` | `passed` | 快照与事件追溯 | 批次、规则、建议快照及追加式事件可按批次/SPU/动作/状态/操作者/日期/事件类型检索；`PAGE-F08-01-baseline.png` 留证 |
| `DESIGN-01` | `passed` | 登录页视觉验收 | `tests/visual/PAGE-F07-01-baseline.png` / `PAGE-F07-01-actual.png`；独立视觉复核 PASS，blocking=0 |
| `DESIGN-02` | `passed` | 无权限页视觉验收 | `tests/visual/PAGE-F07-02-baseline.png` / `PAGE-F07-02-actual.png`；独立视觉复核 PASS，blocking=0 |
| `DESIGN-03` | `passed` | 工作台视觉验收 | `tests/visual/PAGE-F05-01-baseline.png` / `PAGE-F05-01-actual.png`；独立视觉复核 PASS，blocking=0 |
| `DESIGN-04` | `passed` | 批次列表视觉验收 | `tests/visual/PAGE-F01-01-baseline.png` / `PAGE-F01-01-actual.png`；独立视觉复核 PASS，blocking=0 |
| `DESIGN-05` | `passed` | 新建导入视觉验收 | `tests/visual/PAGE-F01-02-baseline.png` / `PAGE-F01-02-actual.png`；独立视觉复核 PASS，blocking=0 |
| `DESIGN-06` | `passed` | 批次详情视觉验收 | `tests/visual/PAGE-F01-03-baseline.png` / `PAGE-F01-03-actual.png`；质量分区筛选、搜索、清除入口可见；独立视觉复核 PASS，blocking=0 |
| `DESIGN-07` | `passed` | 行动清单视觉验收 | `tests/visual/PAGE-F05-02-baseline.png` / `PAGE-F05-02-actual.png`；历史批次切换入口可见；独立视觉复核 PASS，blocking=0 |
| `DESIGN-08` | `passed` | 建议详情视觉验收 | `tests/visual/PAGE-F05-03-baseline.png` / `PAGE-F05-03-actual.png`；面包屑与刷新状态入口可见；独立视觉复核 PASS，blocking=0 |
| `DESIGN-09` | `passed` | 追溯记录视觉验收 | `tests/visual/PAGE-F08-01-baseline.png` / `PAGE-F08-01-actual.png`；角色裁剪提示及操作者、规则、备注首屏可见；独立视觉复核 PASS，blocking=0 |
| `RULE-01` | `passed` | 规则确定性与历史重放 | 相同快照重放得到相同分类、经营/库存动作与规则 ID；规则测试通过 |
| `RULE-02` | `passed` | 角色矩阵与默认拒绝 | 三角色授权矩阵、未映射身份、越权直链及采购字段白名单测试通过 |
| `RULE-03` | `passed` | 凭据与依赖安全 | 凭据 canary 扫描无命中；前端 `npm audit --audit-level=high` 为 0 漏洞；生产配置无认证旁路 |
| `RULE-04` | `passed` | 唯一约束与审计完整性 | 批次指纹、建议、分轨动作唯一约束及追加式事件完整性测试通过 |
| `RULE-05` | `passed` | AI 故障注入与业务可用性 | 5 类 AI 故障/过滤测试通过；AI 失败时固定规则、审核与执行链保持可用 |
