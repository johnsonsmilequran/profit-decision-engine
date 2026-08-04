# Design Master 增量影响说明

> 变更日期：2026-08-05
> 上游需求契约：`requirements.md` revision 10
> 变更性质：新增当前真实验收数据与历史 SPU 515 案例分离，并同步钉钉机器人真实投递证据；既有 revision 8 最近前序待办语义纠正与 Go + React 技术栈增量继续保留。

| Changed Source | Old→New Revision | Affected Design IDs | Artifacts | Action | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 当前真实验收源：仓库根目录 `商品链接.xlsx`；历史案例 SPU 515 | 证据边界纠正（不改变 REQ/AC 行为） | `PAGE-F05-01`、`PAGE-F06-01`、`PAGE-F01-01/02`、`PAGE-F05-02`、`PAGE-F06-03`、`PAGE-F08-01`、`CMP-PREVIOUS-TODO-LINK` | PRD/requirements/正确性分析；`DESIGN.md`；7 个业务页面 HTML；追溯矩阵；TDD 契约与结果台账 | 当前候选 E2E、HTML 明确呈现状态与视觉截图改用真实单期 10 SPU 数据，如实展示品退未校验、库存数据不足与无前序；跨周续接/动作变化仍用真实 PostgreSQL 持久化集成测试验收，不生成伪真实 XLSX 或脑补视觉基线 | in_progress |
| 钉钉企业内部机器人真实能力证据 | committed→ready | `API-F06-05`、`SEQ-F06-02`、`DATA-F06-01` | PRD/requirements/正确性分析；技术方案；追溯矩阵；TDD 结果 | 手动协同与 Worker 每日催办均以官方 `readStatus=SUCCESS`、单收件人为真实投递证据；保持“未读≠业务确认”与同日幂等不变 | implemented |
| design-derived：前后端技术栈 | N/A（用户实现约束） | `API-F01-01/02`、`API-F04-01`、`API-F05-01`、`API-F06-01/02/03/04/05`、`API-F07-01`、`API-F08-01`、全部 `DATA-*` 与 `SEQ-*` | PRD 技术边界；设计蓝图；技术方案；TDD 验收契约；项目状态与纪要 | 后端从 Next.js/Node/TypeScript Worker 改为同一 Go Module 的 Go API + Go Worker；前端从 Next.js 改为 React + TypeScript + Vite 静态应用；用同源 Nginx 与版本化 OpenAPI 契约保持跨端一致，业务行为、页面和稳定设计 ID 不变 | implemented |
| design-derived：最近前序待办同构整行 | N/A（revision 8 设计纠正） | `PAGE-F05-01`、`PAGE-F05-02`、`CMP-PREVIOUS-TODO-LINK` | 设计系统、蓝图、页面清单；运营工作台/行动清单 MD+HTML；追溯矩阵；TDD 下游验证面 | 前序与当前属于同一种待办记录；保留默认折叠，但展开后复用当前表头、字段顺序、列宽和视觉语义显示一整行，只增加前序批次与只读标识；移除对象单元格内摘要卡 | implemented |
| `REQ-F05-05`、`AC-F05-09` | 6→8 | `PAGE-F05-01`、`PAGE-F05-02`、`PAGE-F06-03`、`CMP-PREVIOUS-TODO-LINK`、`API-F05-01`、`DATA-F05-01` | PRD/requirements；设计系统、蓝图、页面清单；运营工作台/行动清单/建议详情 MD+HTML；技术方案；追溯矩阵 | 最近前序不再只显示来源批次与时间；展开后必须显示原批次自己的主动作、关键依据、库存语境、经营状态与时间，禁止当前批次回填 | implemented |
| `REQ-F06-05`、`AC-F06-10`～`AC-F06-12` | new @ revision 7 | `PAGE-F05-01`、`PAGE-F06-01`、`PAGE-F05-02`、`PAGE-F06-03`、`CMP-CLEARANCE-COMPLETION`、`API-F06-04/05`、`DATA-F06-01`、`SEQ-F06-02` | PRD/requirements；蓝图、页面清单与设计系统；双工作台/行动清单/建议详情 MD+HTML；技术方案；追溯矩阵 | 同清仓跨周不重复建任；运营提交实际完成时间，主管确认/退回；最终确认前每日 OA 催办责任运营，确认/改判/终止后停止 | implemented |
| `REQ-F06-02/03`、`AC-F06-03`～`AC-F06-06` | modified @ revision 7 | `PAGE-F05-01`、`PAGE-F05-02`、`PAGE-F06-03`、`CMP-OA-COORDINATION`、`API-F06-02/05`、`DATA-F06-01`、`SEQ-F06-01` | 运营工作台、行动清单、建议详情、技术方案与追溯矩阵 | 经营与库存/OA 协同均由责任运营在产品内处理；外部反馈由运营核验回填，OA 送达不等于业务完成 | implemented |
| `REQ-F07-01`～`REQ-F07-03`、`AC-F07-03/04/06`、`NFR-002` | modified @ revision 7 | `PAGE-F07-01/02`、`PAGE-F05-01`、`PAGE-F06-01/03`、`API-F07-01`、`CMP-OA-COORDINATION` | 登录/恢复、双工作台、行动中心 MD+HTML；蓝图；技术方案；追溯矩阵 | 产品登录角色仅保留运营和运营主管；`PAGE-F06-02` 退役并移出导航/路由；外部相关人员无产品会话，OA 使用消息白名单 | implemented |
| `REQ-F05-05`、`AC-F05-09`～`AC-F05-10` | new @ revision 6 | `PAGE-F05-01`、`PAGE-F05-02`、`PAGE-F06-03`、`CMP-CROSS-BATCH-CONTINUITY`、`CMP-PREVIOUS-TODO-LINK`、`API-F05-01`、`DATA-F05-01` | PRD/requirements；蓝图与页面清单；运营工作台/行动清单/建议详情 MD+HTML；技术方案；追溯矩阵 | 当前待办显示最近前序记录、首次产生/本周关联/执行时间；列表和运营工作台增加经营状态筛选 | implemented |
| design-derived：最近前序待办折叠展示 | N/A（revision 7 历史设计增量，已被 revision 8 语义扩展） | `PAGE-F05-01`、`PAGE-F05-02`、`PAGE-F06-03`、`CMP-PREVIOUS-TODO-LINK` | 设计系统、蓝图、页面清单；运营工作台/行动清单/建议详情 MD+HTML；追溯矩阵；TDD 下游验证面 | 保留“当前任务常驻、前序默认折叠、可访问披露、首次无前序不渲染”的交互；展开内容由 revision 8 扩展为完整前序建议快照 | preserved |
| `REQ-F05-04`、`AC-F05-06`～`AC-F05-08` | new @ revision 5 | `PAGE-F05-02`、`PAGE-F06-03`、`CMP-CROSS-BATCH-CONTINUITY`、`API-F05-01`、`DATA-F05-01`、`SEQ-F03-01` | PRD/requirements；`设计决策蓝图.md`；`页面清单.md`；行动清单/建议详情 MD+HTML；`技术方案.md`；`设计追溯矩阵.md` | 每周决策快照不变；同 SPU 同动作续接稳定任务和状态；清仓变观察等变更追加待主管确认版本 | implemented |
| `REQ-F06-04`、`AC-F06-07`～`AC-F06-09` | new @ revision 4 | `PAGE-F06-03`、`CMP-MANUAL-OVERRIDE`、`API-F06-03`、`DATA-F06-01`、`SEQ-F06-01` | 人工改判全链路产物 | 原规则保留、库存重新确认和已执行保护不变 | preserved |
| design-derived：运营工作台内置浏览器预览 | N/A（历史变更） | `PAGE-F05-01` | 运营工作台 MD/HTML | 取消 `<1024px` 全屏设备门禁并保留缩窄 PC 布局 | preserved |

## 不变范围

- `PAGE-F01-01/02` 与规则、指标、批次、AI、历史冻结行为保持不变；`PAGE-F06-02` 稳定 ID 仅保留退役记录，不再属于运行页面。
- 正式产品仍定位为 PC Web；本次不新增移动端页面、移动端交互或新的 REQ/AC/NFR。
- 商品分类、规则阈值、AI 边界及冻结历史均不变；改判不是规则编辑。
- 商品分类、阈值、跨周任务续接、审核/执行状态机和权限边界不变；本次只改变最近前序待办的读取投影与展示完整度，当前任务数据不受影响。
- Go/React 技术栈调整不改变 9 个运行态 MVP 页面、视觉 tokens、高保真 HTML、业务规则、数据口径、角色权限、接口语义或审计不变量；`PAGE-F06-02` 继续保持 retired。

## 验证面

- 契约：revision 8 的 26 REQ、52 AC、5 NFR（共 83 个 source）全部必须出现于追溯矩阵且不得 stale/TBD；`REQ-F05-05` 与 `AC-F05-09` 必须按 revision 8 验证。
- 页面：双角色工作台、行动清单与建议详情显示责任运营、OA 协同、清仓完成确认与最近催办；行动清单与运营工作台可按经营状态筛选。
- 回归：页面 ID、JavaScript 语法、既有链接和不受影响页面保持有效。
- 技术栈：React 构建、类型检查和前端测试通过；Go API/Worker 执行格式、静态检查、单元/集成测试和构建；OpenAPI 与 Go/TypeScript DTO 契约一致；生产容器中不需要 Node Runtime。

## TDD 下游同步

正式进入 TDD Master 时必须把以下 revision 8 验收面设为 required；revision 7 的双角色/OA/清仓确认用例继续保留，不得仅复用更早的双轨用例：

| 测试主题 | 必测结果 |
| :--- | :--- |
| 双角色权限 | 运营、运营主管可按职责访问；采购、仓库等外部相关人员和无角色账号不建立产品业务会话 |
| OA 字段白名单 | 消息仅含 SPU/链接、协同动作、责任运营、反馈要求和任务引用；利润、推广、品退、售后、AI、审核详情均不外发 |
| 送达与业务状态分离 | OA 发送成功只更新通知状态；只有责任运营核验反馈后才更新协同结果 |
| 清仓完成双人确认 | 运营提交/修正，主管确认/必填原因退回；运营提交或 OA 送达均不能直接闭环 |
| 跨周去重与催办幂等 | 同 SPU 同清仓沿用稳定任务；同任务+自然日+接收人+模板最多一条提醒 |
| 催办停止条件 | 主管确认、动作改判为非清仓或任务终止后不再产生提醒；OA 失败保留失败状态并允许人工补发 |
| 最近前序折叠披露 | 当前任务信息始终可见；有前序时横跨整表的控制行默认收起，鼠标点击或键盘 Enter/Space 只展开当前 SPU 的一条同构前序整行，列结构、字段顺序和列宽与当前待办一致，并标识前序批次与只读；前序值与当前值隔离；首次无前序不出现空折叠；刷新、筛选、分页和详情返回后恢复折叠 |
