# AI 商品经营与利润决策助手

本仓库用于交付趣然电商“AI 商品经营与利润决策助手”的产品规格与生产应用。生产实现采用 React/TypeScript/Vite PC Web、Go API 与 Worker、PostgreSQL，并由 Nginx 通过同源路径发布。

当前 V0 聚焦玩具事业部，以 SPU/商品链接为唯一决策粒度：每周导入经营数据，由固定规则生成经营与库存动作，AI 只负责解释和排序，再由运营主管审核、责任运营执行并通过钉钉协调相关人员完成轻闭环。

## 工程命令

- 安装：`make install`
- 前端开发：`cd web && npm run dev`
- 数据迁移：`make migrate`（需要 `DATABASE_URL`）
- API / Worker：`make dev-api` / `make dev-worker`（Compose 数据库默认在本机 `55432` 端口可达）
- 校验：`make lint typecheck test build`
- 真实数据库集成测试：先迁移 PostgreSQL，再执行 `cd backend && TEST_DATABASE_URL="$DATABASE_URL" go test -race ./...`
- 真实 XLSX 批次集成测试：额外设置 `TEST_XLSX_PATH`，执行 `cd backend && TEST_DATABASE_URL="$DATABASE_URL" TEST_XLSX_PATH="/绝对路径/商品链接.xlsx" go test -v ./internal/batch`
- OpenAPI 类型同步：`cd web && npm run generate:api`（契约源为 `openapi/openapi.yaml`）
- Compose：复制 `.env.example` 为 `.env`，填入真实环境值后执行 `make compose-up`
- 备份：`BACKUP_DESTINATION=/受控异机目录 COMPOSE_PROJECT_NAME=profit-decision make backup`，生成数据库、XLSX、manifest 与 SHA256 校验和快照
- 隔离恢复：先以相同代码和迁移建立空 Compose 项目，再执行 `RESTORE_SNAPSHOT=/绝对路径/快照 COMPOSE_PROJECT_NAME=目标项目 make restore`；目标数据库或文件卷非空时命令拒绝执行

认证只接受钉钉 OAuth。角色映射由运维依据事业部负责人审批写入 PostgreSQL `role_mapping`；应用没有默认账号、密码登录、共享账号或角色选择入口。缺少钉钉配置时认证入口保持不可用并进入受控恢复页，不会降级放行。

### 配置钉钉测试身份

测试身份使用企业内真实钉钉账号，不在本系统创建用户名或密码。系统以钉钉 OAuth 返回的 `unionId` 作为 `role_mapping.actor_ref`；用于机器人发消息的企业 `User ID` 则写入 `role_mapping.dingtalk_user_id`，两者不能混用。

建议分别准备一个运营账号和一个主管账号，并为每个账号确认：

- `unionId`：登录身份唯一标识；
- 企业 `User ID`：机器人收件人标识，仅验证登录时可以暂不配置；
- 角色：只能是 `operations` 或 `supervisor`；
- 审批人：写入 `approved_by`，用于记录角色授权来源；
- 显示名：运营账号必须与导入商品数据中的责任运营名称完全一致，否则看不到名下商品；主管账号使用真实姓名即可。

取得上述信息后，在数据库中执行以下授权。一个 `unionId` 只能对应一个当前角色：

```sql
BEGIN;
INSERT INTO role_mapping (
  actor_ref,
  display_name,
  role,
  active,
  approved_by,
  configured_by,
  dingtalk_user_id
) VALUES (
  '<UNION_ID>',
  '<运营账号填商品数据中的责任运营名称；主管填真实姓名>',
  '<operations 或 supervisor>',
  true,
  '<角色审批人>',
  'lingfeng',
  '<企业钉钉 USER_ID；仅测登录时可改为 NULL>'
)
ON CONFLICT (actor_ref) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  active = true,
  approved_by = EXCLUDED.approved_by,
  configured_by = EXCLUDED.configured_by,
  configured_at = now(),
  dingtalk_user_id = EXCLUDED.dingtalk_user_id;
COMMIT;
```

钉钉开放平台还需满足：应用已发布、测试账号处于应用可见范围、回调地址与 `PUBLIC_BASE_URL` 一致。配置后打开 `/login` 并使用该企业账号授权；进入工作台表示身份映射生效，出现“未分配角色”表示实际 `unionId` 与数据库记录不一致。

数据批次使用 `POST /api/batches` 接收真实 XLSX，Go Worker 从 PostgreSQL 持久任务表领取解析任务，并在单一事务内写入冻结 SPU 快照、字段质量、固定规则决策和行动清单。原始文件保存在 API/Worker 共用的持久卷中；同一文件、事业部、期间和截止日重复上传时返回既有批次。

行动域将每周不可变决策与跨周稳定任务分离：`spu_action_task` 保持 SPU 任务身份，`decision_task_link` 精确关联当周决策和最近更早前序，`action_revision` 保存固定规则或主管改判版本。运营与主管工作台、行动清单和建议详情均读取这些真实投影；整体审核、人工改判、执行后终止、双轨执行、经营结果及清仓完成双人确认均通过版本号与幂等键写入 PostgreSQL 追加事件。

钉钉协同由 API/Worker 使用 `DINGTALK_CLIENT_ID`、`DINGTALK_CLIENT_SECRET` 和 `DINGTALK_ROBOT_CODE` 调用企业内部机器人单聊接口，收件人是公司钉钉 User ID。钉钉应用必须在开放平台开通 `qyapi_robot_sendmsg`；本产品不自动同步全公司通讯录，User ID 与角色映射由运维按审批结果配置。消息正文使用独立最小字段 DTO；调用、失败、人工补发和每日清仓催办均持久化到 `oa_notification`。接口受理不等同于送达、已读或业务确认；未配置或缺权限时默认失败并保留受控错误状态，不伪造回执。

AI 解读由 Worker 通过 `LITELLM_BASE_URL`、`LITELLM_API_KEY` 和 `LITELLM_MODEL` 异步调用 LiteLLM；API 服务不持有模型密钥。模型只接收单条决策的冻结白名单数据，输出经严格四字段、动作一致性、数字来源和禁用主题校验后才进入 `ai_explanation`。失败或未采用不会改变固定规则、审核或执行状态，重新生成只追加版本并保留上一版合规内容。

备份恢复通过 `deploy/backup.sh` 与 `deploy/restore.sh` 在 Compose 主机执行。每个快照将 PostgreSQL data-only custom dump、原始 XLSX 卷归档、非敏感版本清单和 SHA256 校验和放在同一目录；恢复只接受空数据库和空 XLSX 卷，不自动删除或覆盖已有数据。

历史追溯使用 `GET /api/history` 和 React `/history`，按批次/SPU 独立列出不可变决策快照，并以链接级追加事件重放审核与双轨进度。只读详情复用 `/suggestions/:linkId?mode=history`，保留原规则建议和当时生效版本，隐藏全部写入口；筛选、分页及返回上下文保存在 URL。

## 当前成果

- 正式 PRD：`趣然AI商品经营利润决策助手/output/PRD详细版.md`
- 稳定需求契约：`趣然AI商品经营利润决策助手/output/requirements.md`
- 需求正确性分析：`趣然AI商品经营利润决策助手/output/requirements-analysis.md`
- 方案 PPT 大纲：`趣然AI商品经营利润决策助手/output/ppt.md`
- HTML 演示：`趣然AI商品经营利润决策助手/output/ppt/p01.html` 至 `p11.html`
- 可编辑 PPTX：`趣然AI商品经营利润决策助手/output/AI商品经营与利润决策助手-阶段5正式版.pptx`

## 仓库结构

```text
.
├── .github/                         # Issue、PR 与 CODEOWNERS 协作配置
├── backend/                         # Go API、Worker、迁移与领域模块
├── deploy/                          # Nginx 生产同源入口
├── doc/                             # 跨会话项目纪要
├── openapi/                         # 版本化 API 契约
├── web/                             # React/TypeScript/Vite PC Web
├── compose.yaml                     # PostgreSQL、迁移、API、Worker、Web
├── 趣然AI商品经营利润决策助手/       # PRD、证据、评审与演示产物
├── CONTRIBUTING.md                  # 贡献流程
└── 仓库协作设置指引.md               # GitHub 分支保护与 CI 启用指引
```

## 协作方式

业务需求和 Bug 通过 GitHub Issue 模板提交；开发或文档改动从 `main` 创建 `feat/*`、`fix/*` 或 `docs/*` 分支，再通过 Pull Request 合并。详细规则见 `CONTRIBUTING.md`。
