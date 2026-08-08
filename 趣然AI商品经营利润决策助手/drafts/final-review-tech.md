# 阶段 5.5 四方终审 · 工程评审

- 评审范围：`output/PRD详细版.md` revision 11、`output/requirements.md` revision 11、`output/requirements-analysis.md`、`proposal-v1.md`
- 评审维度：工程可行性、安全边界、并发/事务、外部依赖、可维护性
- 结论：**方案技术可行，原 4 个 P1 已全部关闭。复核后 P0 = 0，P1 = 0，P2 = 3。** `PRD详细版.md`、`requirements.md` 与 `requirements-analysis.md` 在秘密展示、管理写入安全、高权限幂等和 F06 契约结构上已一致，可冻结为开发/验收基线。

## P0

**0 个。**

## P1

**0 个未关闭项。原 4 个 P1 处置如下。**

### TECH-P1-01：NFR-007 与 TOTP/恢复码首次绑定流程直接冲突 — 已关闭

- 位置：`requirements.md` NFR-007；`PRD详细版.md` FR-9.1、FR-9.3、§4.9；`proposal-v1.md` §3.1。
- 处置：NFR-007 已改为“受保护绑定当次可通过 `no-store` 响应向 Admin 持有人单次展示 TOTP 密钥/二维码和新恢复码”，并禁止后续响应、URL、前端持久化/缓存、日志、审计、镜像和仓库留存。
- 复核证据：AC-F09-01、AC-F09-05、AC-F09-06、NFR-007 及 `requirements-analysis.md` “秘密展示与保护”行口径一致，不再需要未确认的客户端生成方案。

### TECH-P1-02：关键管理写入防护只在人读 PRD，没有进入最高权威机器契约 — 已关闭

- 位置：`proposal-v1.md` §3.2、§3.7；`PRD详细版.md` FR-9.2、FR-9.6、§9.7.G；`requirements.md` NFR-006、NFR-008、AC-F09-13/14。
- 处置：AC-F09-13/NFR-006 已要求所有管理写入同时校验 Admin 会话、CSRF token、严格 Origin 和预期 Content-Type；AC-F09-14/NFR-008 已禁止运行时数据库身份对管理审计表拥有 UPDATE、DELETE 或 DDL 权限。
- 复核证据：`requirements-analysis.md` 已将两类强制控制列入“管理写入与审计强制”，与详细 PRD FR-9.6 及 AC-F09-13/14 一致。

### TECH-P1-03：高权限写操作的“结果未知”幂等语义没有完整下沉到需求契约 — 已关闭

- 位置：`PRD详细版.md` §4.9—§4.10、§5.10、FR-9.1/9.3/9.5；`requirements.md` AC-F09-02、AC-F09-05/06、AC-F09-12。
- 处置：AC-F09-05/06/12 已强制稳定幂等键和可判定的“同一已提交/未提交结果”，网络重放不重复生成凭据、审计、outbox、审批、映射或会话撤销。
- 复核证据：详细 PRD §4.9—§4.10、FR-9.1/9.3/9.5、AC-F09-05/06/12 与 `requirements-analysis.md` “高权限操作幂等”行已对齐。

### TECH-P1-04：`requirements.md` 的 F06 存在未闭合代码围栏，机器契约结构已损坏 — 已关闭

- 位置：`requirements.md` AC-F06-09 至 AC-F06-12（约第 691—727 行）。
- 处置：AC-F06-09—12 现均为独立标题、Parent、Priority 和闭合 EARS `text` 围栏，AC-F06-12 后无孤立围栏。
- 复核证据：围栏状态检查得到 `fence_count=134, final_state=0`，且无 `AC/REQ/NFR` 标题落入围栏；PRD Master `check_requirements_contract.py` 返回“需求契约校验通过：feature，稳定对象 122 个”。

## P2

### TECH-P2-01：管理审计的 actor 模型不足以表达初始化与部署恢复的操作人

- 位置：`PRD详细版.md` §4.8—§4.9；`proposal-v1.md` §3.3、§3.7。
- 问题：ER 图只表达 `ADMIN_ACCOUNT -> ADMIN_AUDIT_EVENT`，但 setup 失败时 Admin 尚不存在，部署恢复的审批人/执行人也不应被伪装成 Admin。`actor_ref` 没有 actor 类型、外部责任引用或未登录安全主体的语义。
- 影响：实现可以留下事件，但无法稳定回答“谁审批、谁执行、当时是什么身份域”，降低恢复可追责性。

### TECH-P2-02：通知 outbox 有业务状态，但缺少并发投递的唯一与终态约束

- 位置：`PRD详细版.md` §4.9—§4.10、§6.8；`requirements.md` AC-F09-06。
- 问题：已有 `attempt_count/next_attempt_at` 和四态，但未规定每次部署恢复的通知唯一键、Worker 并发 claim/lease 语义，以及 `compensated_closed` 后延迟成功回执如何处理。
- 影响：多 Worker/超时重试可能重复发送，或把已补偿闭环的事件重写为另一终态，影响通知与审计勾稽。

### TECH-P2-03：生产外部依赖仍只是 committed，尚无 ready 证据

- 位置：`requirements.md` Capability prerequisites；`PRD详细版.md` §0.5、§9.6.B—G。
- 问题：真实钉钉回调的企业作用域+两个权威组织属性、唯一 Admin 持有人/交接人、审批证据目录、恢复审批/执行/通知岗位和安全通知主通道都未有 ready 证据。文档已正确把它们设为硬门禁，因此这不是规格自相矛盾。
- 影响：可以开发和在开发环境验证，但在证据补齐前不得将 F09 标记为生产可启用，也不得通过降低双属性、静默恢复或责任岗位要求来消除阻塞。

## 已核查且无新增阻塞的边界

- **恢复事务**：新凭据/代次、旧 Admin 会话撤销、恢复材料消费、审计和 outbox 入队在 PostgreSQL 同一事务；外部投递最终一致，没有伪造跨系统原子性。
- **角色事务**：角色映射、审批记录、映射版本、旧业务会话撤销、五态投影与管理审计已明确强一致，外部通知没有混入该事务。
- **OAuth 并发**：业务会话创建前复核当前映射版本，会话绑定版本，每次业务 API 持续校验；晚到旧会话不能进入工作台。
- **双会话隔离**：Admin 与业务入口、凭据、Cookie、会话、密钥和中间件分离，互访不 fallback/转换。
- **现有用户兼容**：已有唯一有效角色的用户不经待处理或重审，F09 管理面故障不阻断其正常登录。

## 最终判定

**通过。** 原 4 个 P1 全部关闭，当前 P0 = 0、P1 = 0；`requirements-analysis.md` 也明确记录 `P0 unresolved: 0` 与 `P1 unresolved: 0`。`requirements.md` 可作为开发/验收基线。3 个 P2 不阻断当前 MVP 实现，但仍须在技术方案和生产上线清单中追踪；生产外部依赖未达 ready 前不得宣称 F09 可生产启用。当前方案不需改变“单 Admin、固定双业务角色、外部审批、五态、不建通用 IAM”的用户已确认边界。
