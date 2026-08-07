# F09 · Admin 管理后台技术可行性预检

> 门禁状态：用户复看后确认不需要调整；本预检结论已于 2026-08-07 通过人工门禁。

## 结论

F09 在现有 Go API、React + TypeScript、PostgreSQL、Goose migration 和同源 Web 部署架构内可实现，**没有必须删除或后置的已确认产品范围**。

但必须遵守一条不可妥协的架构边界：**Admin 是独立管理身份，不是第三种业务角色**。Admin 账号、会话、Cookie、认证中间件和审计记录必须与钉钉业务身份物理分离；业务数据 API 继续只接受 `operations/supervisor` 业务会话。

## 硬约束与现有系统证据

| 硬约束 | 代码证据 | 对 F09 的影响 |
|---|---|---|
| 业务角色固定为运营/主管 | `backend/migrations/00001_identity.sql:4`；`backend/internal/identity/service.go:14-17` | 不得把 `admin` 加入 `business_role`，否则会污染所有现有业务权限判断 |
| 业务会话必须绑定有效角色映射 | `backend/migrations/00001_identity.sql:16-25`；`backend/internal/identity/service.go:45-55` | Admin 不能复用 `user_session`，需独立 `admin_session` |
| 角色停用或变化会使业务会话失效 | `backend/internal/identity/service.go:65-80` | 现有业务权限撤销机制可保留；Admin 修改映射后旧业务会话会自然失效 |
| 无角色回调当前直接失败 | `backend/internal/httpapi/server.go:607-617` | 在 `CreateSession` 失败分支前后增加幂等待审批写入，不得因此创建业务会话 |
| 当前钉钉用户客户端只返回 `unionId` | `backend/internal/identity/dingtalk.go:75-90` | 稳定身份键已具备；姓名展示字段需扩展或降级，不阻塞授权闭环 |
| 当前 HTTP 路由没有 Admin 表面 | `backend/internal/httpapi/server.go:37-64` | 需新增 `/admin/*` 页面路由与 `/api/admin/*` API，不改现有业务路由语义 |
| 当前只有一个业务会话 Cookie | `backend/internal/httpapi/server.go:24`、`:619`、`:649-654` | 需新增独立 `quran_admin_session`，业务认证不得读取它 |
| 现有审计表属于经营任务域 | `backend/migrations/00003_action_lifecycle.sql:54-67`、`:214-221` | 管理操作不能伪装成 `business_event`，需独立不可变管理审计表 |
| 部署配置已通过环境变量注入 API | `backend/internal/config/config.go:9-43`；`compose.yaml:34-42` | 可增加初始化、恢复和 TOTP 加密部署秘密；开发与线上必须使用不同值 |
| 前端采用轻量路径分发并由 OpenAPI 生成类型 | `web/src/App.tsx:16-30`；`web/src/api.ts:1-31`；`openapi/openapi.yaml:1-9` | 可增量加入 Admin 页面和契约，无需更换前端框架或路由体系 |
| 数据库迁移链已存在 | `backend/cmd/migrate/main.go:11-23`；`compose.yaml:17-28` | 可追加 `00006_admin_access.sql`，无需重建现有库 |

## 推荐可行方案

### 1. 数据模型

追加迁移，不修改既有 `business_role` 语义：

- `admin_account`：单例约束、用户名、Argon2id 密码摘要、加密后的 TOTP 密钥、恢复码摘要、凭据版本、创建与更新时间。
- `admin_session`：只保存随机令牌摘要、凭据版本、绝对/空闲过期时间、撤销时间；恢复后按账号一次性撤销全部旧会话。
- `access_request`：以钉钉 `actor_ref` 唯一，保存首次/最近认证时间、状态和可用展示信息；重复 OAuth 回调使用 upsert，不产生重复申请。
- `admin_audit_event`：只追加，记录 Admin 初始化、登录失败/锁定、恢复、角色新增/修改/停用/恢复、审批人和审批依据；数据库触发器禁止更新和删除。
- `role_mapping`：保留单一业务角色约束，增补审批依据、最后修改时间和必要的并发版本；当前值用于鉴权，完整变更史进入管理审计表。

### 2. 认证与会话隔离

- 业务用户继续使用钉钉 OAuth、`quran_session` 和现有 `identity.Service`。
- Admin 使用 `/admin/login`、独立 `quran_admin_session` 和独立认证中间件。
- Admin Cookie 必须 `HttpOnly`、线上 `Secure`、`SameSite=Strict` 或经验证的最严格兼容值；管理写操作同时校验 CSRF token 与同源 `Origin`。
- Admin Principal 不得转换为业务 Principal；Admin 没有业务角色时访问任何业务 API 都按未认证/无权限处理。
- 密码使用 Argon2id 等内存困难摘要；仓库已有 `golang.org/x/crypto` 依赖，但具体参数由后续安全设计和测试契约固定。
- TOTP 使用标准时间型动态码，密钥以部署加密键保护；服务端需要可靠时钟，并只接受有限漂移窗口。

### 3. 一次性初始化与恢复

- 新增 `ADMIN_BOOTSTRAP_TOKEN`、`ADMIN_RECOVERY_TOKEN`、`ADMIN_TOTP_ENCRYPTION_KEY` 等部署秘密；实际命名由设计阶段固定。
- 原始口令只存在于部署秘密和用户当次输入中；数据库只保存摘要、消费时间和审计事实，日志与 API 响应不得出现原值。
- 初始化事务同时检查“Admin 数量为 0”、口令有效、未消费，并用数据库单例约束阻止并发创建第二个 Admin。
- 恢复事务同时重设密码/TOTP、递增凭据版本、撤销全部旧会话、标记恢复口令已消费。
- 运维在使用后必须轮换或移除对应环境变量；数据库恢复到旧快照时也必须重新轮换，避免旧口令随快照复活。

### 4. 待审批与业务角色配置

- 钉钉回调取得 `actor_ref` 后先查询有效业务角色；不存在唯一有效角色时 upsert `access_request`，随后仍跳转待审批页，不创建业务会话。
- 已有有效角色时按现有路径创建业务会话，并将同一待审批记录标记为已处理。
- Admin 配置角色必须提交事业部负责人、审批依据和目标唯一角色；缺任一项拒绝写入。
- 角色修改、停用或恢复采用事务同时更新当前映射、撤销受影响业务会话并追加管理审计，避免权限窗口。
- 10 分钟目标不依赖新增外部系统；第一版记录人工审批依据，不接 OA 审批 API。

### 5. 前端与契约

- 在现有路径分发中增加 `/admin/setup`、`/admin/login`、`/admin/recovery`、`/admin/access-requests`、`/admin/audit`。
- 在 OpenAPI 中增加独立 Admin session、初始化、恢复、待审批、角色变更和审计接口，再重新生成 TypeScript 类型。
- 现有 `/auth/recovery` 继续服务钉钉业务认证；Admin 恢复必须使用 `/admin/recovery`，避免两种身份恢复语义混用。

## 不可采用的方案

| 方案 | 不可采用原因 |
|---|---|
| 把 `admin` 加入 `business_role` | 会让既有大量二角色判断出现第三分支，并破坏“Admin 默认不读业务数据” |
| 复用 `role_mapping` 和 `user_session` 保存 Admin | 数据库外键要求 Admin 必须有业务角色，与正交权限决定直接冲突 |
| 预置固定 Admin 用户名密码 | 无法满足一次性初始化与零默认凭据边界，形成通用后门 |
| 复用 `business_event` 记录管理审计 | 该表面向经营任务/链接，Admin 初始化、登录与授权申请没有合法业务对象 |
| 把初始化/恢复口令或 TOTP 密钥明文落库 | 数据库或日志泄露会直接导致高权限账号接管 |
| 仅依赖 Cookie `SameSite` 防护管理写操作 | 不能替代明确的 CSRF/Origin 校验，不足以保护本地高权限账号 |

## 风险与缓解

1. **单 Admin 锁死**：密码、动态码和恢复码同时丢失会阻断管理。缓解：部署级一次性恢复口令、恢复后撤销旧会话、运维轮换演练。
2. **初始化/恢复口令被重复使用**：环境变量仍存在或数据库回滚可能使旧口令复活。缓解：数据库保存摘要与消费事实、使用后移除/轮换、恢复数据库后强制换新。
3. **并发初始化创建多个 Admin**：两个请求同时通过“无 Admin”检查。缓解：数据库单例唯一约束与单事务写入，不能只靠应用层判断。
4. **Admin 越权读取经营数据**：错误复用业务 Principal 或 API。缓解：独立会话 Cookie/中间件/路由；业务服务继续只接受两种业务角色。
5. **审批记录与当前权限不一致**：只覆盖 `role_mapping` 会丢失历史。缓解：当前映射与不可变管理审计在同一事务中写入，并撤销旧业务会话。
6. **待审批列表无法友好识别人**：当前客户端只保留 `unionId`。缓解：设计阶段核实现有钉钉响应可用姓名字段；不可用时展示掩码标识并要求 Admin 依据审批材料核对，核心流程不阻塞。

## 范围收缩判断

- **需要删除的已确认功能：无。**
- **需要后置的已确认功能：无。**
- **必须新增的实现约束：**独立 Admin 身份域、不可变管理审计、CSRF/Origin 防护、部署秘密分环境隔离、初始化/恢复单次消费、角色变更时撤销业务会话。
- **仍需在设计阶段固定：**密码哈希参数、TOTP 漂移窗口、登录失败锁定阈值、Admin 会话时长、审计保留期、姓名字段降级展示。

## 基线验证

- `cd backend && go test ./...`：通过。
- `cd web && npm run typecheck`：通过。
- `cd web && npm test -- --run`：4 个测试文件、4 个测试全部通过。

这些结果只证明现有基线健康；F09 尚未实现，不能据此声称新功能测试通过。
