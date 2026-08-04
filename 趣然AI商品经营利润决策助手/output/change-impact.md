# Design Master 增量影响说明

> 变更日期：2026-08-04  
> 上游需求契约：`requirements.md` revision 3 → 4
> 变更性质：新增运营主管人工改判生效动作，保护原规则、库存联动和已执行事实。

| Changed Source | Old→New Revision | Affected Design IDs | Artifacts | Action | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-F06-04`、`AC-F06-07`～`AC-F06-09` | new @ revision 4 | `PAGE-F06-03`、`CMP-MANUAL-OVERRIDE`、`API-F06-03`、`DATA-F06-01`、`SEQ-F06-01` | PRD/requirements；`设计决策蓝图.md`；`页面清单.md`；`页面文档/建议详情高保真`；`技术方案.md`；`设计追溯矩阵.md` | 原规则结论保持只读；主管在未执行时选择新经营/库存动作并填写理由；清仓改加投不沿用禁补；已执行须先终止 | implemented |
| design-derived：运营工作台内置浏览器预览 | N/A（历史变更） | `PAGE-F05-01` | 运营工作台 MD/HTML | 取消 `<1024px` 全屏设备门禁并保留缩窄 PC 布局 | preserved |

## 不变范围

- `PAGE-F05-01` 及其他 8 个不受影响页面的页面身份、信息架构和业务行为保持不变。
- 正式产品仍定位为 PC Web；本次不新增移动端页面、移动端交互或新的 REQ/AC/NFR。
- 商品分类、规则阈值、AI 权限、采购最小字段及冻结历史均不变；改判不是规则编辑。

## 验证面

- 契约：revision 4 的 23 REQ、44 AC、5 NFR 全部必须出现于追溯矩阵且不得 stale/TBD。
- 页面：建议详情高保真可打开改判弹窗；空理由被拒绝；有理由后显示加投+不补货、人工改判标识和新审计行；原规则表保持清仓+禁补。
- 回归：页面 ID、JavaScript 语法、既有链接和不受影响页面保持有效。
