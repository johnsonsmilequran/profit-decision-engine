# AI 商品经营与利润决策助手

本仓库用于建设趣然电商“AI 商品经营与利润决策助手”的生产应用，并管理产品需求、稳定需求契约、设计和验收证据。

当前 V0 聚焦玩具事业部，以 SPU/商品链接为唯一决策粒度：每周导入经营数据，由固定规则生成经营与库存动作，AI 只负责解释和排序，再由运营主管、运营和采购计划完成轻闭环。

## 当前成果

- 正式 PRD：`趣然AI商品经营利润决策助手/output/PRD详细版.md`
- 稳定需求契约：`趣然AI商品经营利润决策助手/output/requirements.md`
- 需求正确性分析：`趣然AI商品经营利润决策助手/output/requirements-analysis.md`
- 方案 PPT 大纲：`趣然AI商品经营利润决策助手/output/ppt.md`
- HTML 演示：`趣然AI商品经营利润决策助手/output/ppt/p01.html` 至 `p11.html`
- 可编辑 PPTX：`趣然AI商品经营利润决策助手/output/AI商品经营与利润决策助手-阶段5正式版.pptx`
- 生产应用：`apps/api` 已建立 Fastify 与 PostgreSQL 基础运行链路，后续 MVP 闭环持续在 `weien` 分支实现。

## 本地开发

要求 Node.js 24+ 与 PostgreSQL 17+。复制 `.env.example` 为 `.env`，创建数据库后执行：

```bash
npm install
npm run db:migrate
npm run dev
```

`GET http://127.0.0.1:3001/health` 会查询 PostgreSQL 并返回当前数据库和检查时间；数据库不可用时接口不会伪造成功。迁移会建立角色映射、OAuth 防伪状态、会话、不可变批次、SPU 快照、指标、决策、双轨动作、AI 状态与追加审计事件等真实业务表。

认证 API 已实现 `GET /api/auth/dingtalk/start`、`GET /api/auth/dingtalk/callback`、`GET /api/auth/me` 与 `POST /api/auth/logout`。服务端使用真实钉钉 OAuth2 接口，以一次性 state 防回调伪造，只接受稳定 unionId 并要求 IT 预先配置有效业务角色；失败或无角色时不建立会话，也不提供本地账号或默认角色降级。

批次 API 已实现 `POST /api/batches/import`、`GET /api/batches` 与 `GET /api/batches/:batchId`。导入会把 XLSX 写入持久化目录，并由可恢复的同进程后台任务把有效行、字段质量、指标、固定规则决策和双轨动作写入 PostgreSQL；相同指纹始终返回原批次。

## 仓库结构

```text
.
├── .github/                         # Issue、PR 与 CODEOWNERS 协作配置
├── apps/api/                        # Fastify API 与 PostgreSQL 数据层
├── doc/                             # 跨会话项目纪要
├── 趣然AI商品经营利润决策助手/       # PRD、证据、评审与演示产物
├── CONTRIBUTING.md                  # 贡献流程
└── 仓库协作设置指引.md               # GitHub 分支保护与 CI 启用指引
```

## 协作方式

业务需求和 Bug 通过 GitHub Issue 模板提交；开发或文档改动从 `main` 创建 `feat/*`、`fix/*` 或 `docs/*` 分支，再通过 Pull Request 合并。详细规则见 `CONTRIBUTING.md`。
