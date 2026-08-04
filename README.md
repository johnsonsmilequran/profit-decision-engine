# AI 商品经营与利润决策助手

本仓库用于交付趣然电商“AI 商品经营与利润决策助手”的产品规格与生产应用。生产实现采用 React/TypeScript/Vite PC Web、Go API 与 Worker、PostgreSQL，并由 Nginx 通过同源路径发布。

当前 V0 聚焦玩具事业部，以 SPU/商品链接为唯一决策粒度：每周导入经营数据，由固定规则生成经营与库存动作，AI 只负责解释和排序，再由运营主管审核、责任运营执行并通过 OA 协调外部相关人员完成轻闭环。

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

认证只接受钉钉 OAuth。角色映射由运维依据事业部负责人审批写入 PostgreSQL `role_mapping`；应用没有默认账号、密码登录、共享账号或角色选择入口。缺少钉钉配置时认证入口保持不可用并进入受控恢复页，不会降级放行。

数据批次使用 `POST /api/batches` 接收真实 XLSX，Go Worker 从 PostgreSQL 持久任务表领取解析任务，并在单一事务内写入冻结 SPU 快照、字段质量、固定规则决策和行动清单。原始文件保存在 API/Worker 共用的持久卷中；同一文件、事业部、期间和截止日重复上传时返回既有批次。

行动域将每周不可变决策与跨周稳定任务分离：`spu_action_task` 保持 SPU 任务身份，`decision_task_link` 精确关联当周决策和最近更早前序，`action_revision` 保存固定规则或主管改判版本。运营与主管工作台、行动清单和建议详情均读取这些真实投影；整体审核、人工改判、执行后终止、双轨执行、经营结果及清仓完成双人确认均通过版本号与幂等键写入 PostgreSQL 追加事件。

OA 协同由 API/Worker 通过 `OA_MESSAGE_URL` 和 `OA_TOKEN` 调用公司适配入口。消息使用独立最小字段 DTO；发送、失败、人工补发和每日清仓催办均持久化到 `oa_notification`，送达不等同于业务确认。未配置 OA 时默认失败并保留受控错误状态，不伪造回执。

AI 解读由 Worker 通过 `LITELLM_BASE_URL`、`LITELLM_API_KEY` 和 `LITELLM_MODEL` 异步调用 LiteLLM；API 服务不持有模型密钥。模型只接收单条决策的冻结白名单数据，输出经严格四字段、动作一致性、数字来源和禁用主题校验后才进入 `ai_explanation`。失败或未采用不会改变固定规则、审核或执行状态，重新生成只追加版本并保留上一版合规内容。

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
