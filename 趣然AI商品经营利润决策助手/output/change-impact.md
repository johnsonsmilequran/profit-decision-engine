# 设计增量影响分析

> 当前上游契约：`requirements.md` revision 2  
> 比较基线：Design Master 启动时读取的 revision 1  
> 结论：变更发生在阶段 II 深度产物生成之前；认证、权限和页面骨架已在总蓝图中按 revision 2 重新收敛，无遗留 `stale` 产物。

| Changed Source | Old→New Revision | Affected Design IDs | Artifacts | Action | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-F07-03 | 1→2 | PAGE-F07-01, PAGE-F07-02, DEC-001, API-F07-01, DATA-F07-01, SEQ-F07-01 | `设计决策蓝图.md` §3、§4、§7、§9；待生成登录/无权限页文档与 HTML；待生成《技术方案》 | 增加铉铉唯一身份入口、IT 角色映射责任、服务端默认拒绝和恢复路径；按 revision 2 生成全部新产物 | resolved |
| AC-F07-05 | 1→2（继承 REQ-F07-03） | PAGE-F07-01, API-F07-01, SEQ-F07-01 | `设计决策蓝图.md` §3、§4.1；待生成铉铉登录页文档与 HTML | 把铉铉认证成功与稳定操作人身份落到页面、服务端契约与时序 | resolved |
| AC-F07-06 | 1→2（继承 REQ-F07-03） | PAGE-F07-02, API-F07-01, SEQ-F07-01 | `设计决策蓝图.md` §3、§4.2；待生成无权限页文档与 HTML | 把认证失败、无有效角色映射和越权直链统一为不泄露数据的默认拒绝路径 | resolved |
| NFR-002 | 1→2 | PAGE-F07-02, API-F07-01, DATA-F07-01 | `设计决策蓝图.md` §3、§7、§9；待生成采购视图相关页面文档/HTML；待生成《技术方案》 | 将“页面隐藏”收紧为服务端读模型裁剪，覆盖页面、接口响应与错误路径 | resolved |

## 保留范围

- F01—F06、F08 的业务行为、固定规则、批次幂等、AI 降级与审核/分动作状态机语义未变，按已确认蓝图继续生成。
- 浅色企业数据风格、“行动罗盘”签名、PC 1440/1280 边界和模块化单体决策在 revision 2 完整契约上确认，不存在需要保留的 revision 1 深度产物。
- 阶段 II 全部新产物以 revision 2 为生成基线；完成后《设计追溯矩阵》必须将上述条目标记为 `covered`，不得仅更新 revision 数字。
