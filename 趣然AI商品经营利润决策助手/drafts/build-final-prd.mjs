import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pm = readFileSync(resolve(root, "drafts/r3-pm.md"), "utf8");
const architect = readFileSync(resolve(root, "drafts/r3-architect.md"), "utf8");
const engineer = readFileSync(resolve(root, "drafts/r3-engineer.md"), "utf8");

function section(text, number) {
  const startPattern = new RegExp(`^## §${number}[^\\n]*`, "m");
  const match = text.match(startPattern);
  if (!match || match.index === undefined) throw new Error(`missing section ${number}`);
  const start = match.index;
  const rest = text.slice(start + match[0].length);
  const next = rest.search(/^## (?:§|R3 |⚠️)/m);
  const end = next === -1 ? text.length : start + match[0].length + next;
  const raw = text.slice(start, end).trim();
  return raw.replace(new RegExp(`^## §${number}\\s*`), `## ${number}. `);
}

function body(text, number) {
  return section(text, number).replace(/^##[^\n]*\n+/, "").trim();
}

const acIndex = [];
let legacy = 1;
for (const [feature, count] of [["F01", 4], ["F02", 6], ["F03", 6], ["F04", 4], ["F05", 5], ["F06", 6], ["F07", 4], ["F08", 4]]) {
  for (let index = 1; index <= count; index += 1) {
    const modern = `AC-${feature}-${String(index).padStart(2, "0")}`;
    const priority = [4, 39].includes(legacy) ? "P1" : "P0";
    acIndex.push(`| AC-${legacy} | ${modern} | ${priority} | 详见本节同名验收条件 |`);
    legacy += 1;
  }
}

const techAdvice = `### 9.F 技术栈建议（待设计阶段确认）

以下内容只用于降低首版实现歧义，不是已经拍板的技术选型；技术负责人可在设计阶段替换等价实现，但不得改变 \`output/requirements.md\` 的产品行为。

| 层次 | 建议 | 原因与边界 |
| :--- | :--- | :--- |
| 后端 | Python + FastAPI | 便于处理 XLSX、固定规则纯函数和结构化校验；框架可替换，规则确定性不可替换。 |
| 前端 | React + TypeScript | 适合内部工具的表格、筛选、详情和角色视图；具体 UI 框架待设计。 |
| 数据库 | PostgreSQL | 适合批次快照、建议、动作和追加事件的关系及事务约束；物理字段类型由技术设计定义。 |
| 核心算法库/求解器 | 不使用机器学习求解器；建立版本化固定规则模块 | V0 是确定性阈值决策，不需要 sklearn、XGBoost 或优化求解器；AI 仅通过 LiteLLM 生成解释。 |
| 部署与基础设施 | 容器化部署并复用现有 LiteLLM 网关 | 普通用户不可见部署密钥；模型故障不得影响规则清单。具体 Docker、调度和监控方案待技术设计确认。 |

失败模式：如果团队把建议栈当成不可变约束，可能与现有基础设施冲突。缓解方式是把稳定需求契约作为唯一行为边界，技术栈只在设计阶段形成正式决策。`;

const acceptance = section(pm, 10)
  .replace(/^### 10\.([1-6]) /gm, (_, n) => `### 10.${Number(n) + 1} `)
  .replace(
    "### 10.0 通用验收口径",
    `### 10.0 验收索引\n\n| 展示别名 | 稳定 AC ID | 优先级 | 产品可观察结果 |\n| :--- | :--- | :--- | :--- |\n${acIndex.join("\n")}\n\n测试数据、自动化策略和具体验证方法由后续 TDD Master 基于稳定 AC 另行定义，本 PRD 只定义产品可观察结果。\n\n### 10.1 通用验收口径`,
  );

const final = `# 趣然 AI 商品经营与利润决策助手 PRD

${section(pm, 0)}

${section(pm, 1)}

${section(pm, 2)}

${section(architect, 3)}

${section(architect, 4)}

${section(engineer, 5)}

${section(architect, 6)}

${section(engineer, 7)}

${section(pm, 8)}

## 9. 风险、依赖与架构建议

${body(architect, 9)}

${body(engineer, 9)}

${techAdvice}

${acceptance}

${section(pm, 11)}

${section(engineer, 12)}

## 13. 一致性自检

### 13.1 用户故事到功能映射

| 用户故事 | 功能 | 结果 |
| :--- | :--- | :--- |
| US-1 / US-F01-01 | FR-1 / F01 | PASS |
| US-2 / US-F02-01 | FR-2 / F02 | PASS |
| US-3 / US-F03-01 | FR-3 / F03 | PASS |
| US-4 / US-F04-01 | FR-4 / F04 | PASS |
| US-5 / US-F05-01 | FR-5 / F05 | PASS |
| US-6 / US-F06-01 | FR-6 / F06 | PASS |
| US-7 / US-F06-02 | FR-6 / F06 | PASS |
| US-8 / US-F07-01 | FR-7 / F07 | PASS |
| US-9 / US-F08-01 | FR-8 / F08 | PASS |

### 13.2 跨章节口径

| 主题 | 一致口径 | 结果 |
| :--- | :--- | :--- |
| 决策粒度 | 只处理 SPU/商品链接，不处理 SKU | PASS |
| 规则权威 | 固定规则决定类型与动作，AI 不覆盖且不阻塞 | PASS |
| 审核与执行 | 建议整体审核，经营动作与补货/禁补动作分别执行 | PASS |
| 禁补冲突 | 止损或清仓与禁补原子生成、同时激活 | PASS |
| 数据时间 | 上一个完整自然月；新品以批次业务截止日为基准 | PASS |
| 采购权限 | 只见补货/禁补及必要库存销量依据 | PASS |
| 历史追溯 | 新批次不覆盖旧快照，状态以追加事件保留 | PASS |

正式稳定行为及 ID 以 \`output/requirements.md\` 为机器契约；如本文、摘要版与开发版发生冲突，应停止实现并回到阶段 5 同步修订。
`;

writeFileSync(resolve(root, "output/PRD详细版.md"), final, "utf8");
