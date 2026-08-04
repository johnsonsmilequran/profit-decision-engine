# Design Master 增量影响说明

> 变更日期：2026-08-04  
> 上游需求契约：`requirements.md` revision 5 → 6
> 变更性质：在既有跨周任务续接上补充 SPU/商品链接锚定的最近前序待办、生命周期时间展示和经营状态筛选。

| Changed Source | Old→New Revision | Affected Design IDs | Artifacts | Action | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-F05-05`、`AC-F05-09`～`AC-F05-10` | new @ revision 6 | `PAGE-F05-01`、`PAGE-F05-02`、`PAGE-F06-03`、`CMP-CROSS-BATCH-CONTINUITY`、`CMP-PREVIOUS-TODO-LINK`、`API-F05-01`、`DATA-F05-01` | PRD/requirements；蓝图与页面清单；运营工作台/行动清单/建议详情 MD+HTML；技术方案；追溯矩阵 | 当前待办显示最近前序记录、首次产生/本周关联/执行时间；列表和运营工作台增加经营状态筛选 | implemented |
| `REQ-F05-04`、`AC-F05-06`～`AC-F05-08` | new @ revision 5 | `PAGE-F05-02`、`PAGE-F06-03`、`CMP-CROSS-BATCH-CONTINUITY`、`API-F05-01`、`DATA-F05-01`、`SEQ-F03-01` | PRD/requirements；`设计决策蓝图.md`；`页面清单.md`；行动清单/建议详情 MD+HTML；`技术方案.md`；`设计追溯矩阵.md` | 每周决策快照不变；同 SPU 同动作续接稳定任务和状态；清仓变观察等变更追加待主管确认版本 | implemented |
| `REQ-F06-04`、`AC-F06-07`～`AC-F06-09` | new @ revision 4 | `PAGE-F06-03`、`CMP-MANUAL-OVERRIDE`、`API-F06-03`、`DATA-F06-01`、`SEQ-F06-01` | 人工改判全链路产物 | 原规则保留、库存重新确认和已执行保护不变 | preserved |
| design-derived：运营工作台内置浏览器预览 | N/A（历史变更） | `PAGE-F05-01` | 运营工作台 MD/HTML | 取消 `<1024px` 全屏设备门禁并保留缩窄 PC 布局 | preserved |

## 不变范围

- `PAGE-F06-01/02`、`PAGE-F01-01/02`、`PAGE-F07-01/02`、`PAGE-F08-01` 的页面身份、信息架构和业务行为保持不变；`PAGE-F05-01` 只增加经营待办关联、时间和状态筛选，不增加写操作。
- 正式产品仍定位为 PC Web；本次不新增移动端页面、移动端交互或新的 REQ/AC/NFR。
- 商品分类、规则阈值、AI 权限、采购最小字段及冻结历史均不变；改判不是规则编辑。

## 验证面

- 契约：revision 6 的 25 REQ、49 AC、5 NFR 全部必须出现于追溯矩阵且不得 stale/TBD。
- 页面：运营工作台、行动清单与建议详情显示稳定任务 ID、最近前序待办、产生/关联/执行时间；行动清单与运营工作台可按经营状态筛选。
- 回归：页面 ID、JavaScript 语法、既有链接和不受影响页面保持有效。
