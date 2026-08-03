# AI 商品经营与利润决策助手

本仓库用于管理趣然电商“AI 商品经营与利润决策助手”的产品需求、稳定需求契约、演示页面和方案 PPT。

当前 V0 聚焦玩具事业部，以 SPU/商品链接为唯一决策粒度：每周导入经营数据，由固定规则生成经营与库存动作，AI 只负责解释和排序，再由运营主管、运营和采购计划完成轻闭环。

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
├── doc/                             # 跨会话项目纪要
├── 趣然AI商品经营利润决策助手/       # PRD、证据、评审与演示产物
├── CONTRIBUTING.md                  # 贡献流程
└── 仓库协作设置指引.md               # GitHub 分支保护与 CI 启用指引
```

## 协作方式

业务需求和 Bug 通过 GitHub Issue 模板提交；开发或文档改动从 `main` 创建 `feat/*`、`fix/*` 或 `docs/*` 分支，再通过 Pull Request 合并。详细规则见 `CONTRIBUTING.md`。
