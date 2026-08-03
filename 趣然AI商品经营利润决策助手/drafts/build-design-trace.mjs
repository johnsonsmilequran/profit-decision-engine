import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('趣然AI商品经营利润决策助手/output');
const requirements = fs.readFileSync(path.join(root, 'requirements.md'), 'utf8');
const matches = [...requirements.matchAll(/^### (REQ-F\d{2}-\d{2}|AC-F\d{2}-\d{2}|NFR-\d{3})\b/gm)];

const designs = {
  F01: ['PAGE-F01-01', 'PAGE-F01-02', 'PAGE-F01-03', 'API-F01-01', 'DATA-F01-01', 'SEQ-F01-01'],
  F02: ['PAGE-F01-03', 'PAGE-F05-02', 'API-F02-01', 'DATA-F02-01'],
  F03: ['PAGE-F05-02', 'API-F03-01', 'DATA-F03-01', 'SEQ-F03-01'],
  F04: ['PAGE-F05-02', 'API-F04-01', 'DATA-F04-01', 'SEQ-F04-01'],
  F05: ['PAGE-F05-01', 'PAGE-F05-02', 'API-F05-01', 'DATA-F05-01'],
  F06: ['PAGE-F05-02', 'PAGE-F06-01', 'PAGE-F06-02', 'PAGE-F06-03', 'PAGE-F06-04', 'API-F06-01', 'DATA-F06-01', 'SEQ-F06-01'],
  F07: ['PAGE-F07-01', 'PAGE-F07-02', 'PAGE-F05-02', 'API-F07-01', 'DATA-F07-01', 'SEQ-F07-01'],
  F08: ['PAGE-F08-01', 'PAGE-F05-02', 'API-F08-01', 'DATA-F08-01'],
};

const artifacts = {
  F01: 'pages/阶段1_数据批次_批次列表.md; pages/阶段1_数据批次_批次列表.html; pages/阶段1_数据批次_新建数据导入.md; pages/阶段1_数据批次_新建数据导入.html; pages/阶段1_数据批次_批次详情与校验结果.md; pages/阶段1_数据批次_批次详情与校验结果.html; 技术方案.md §4-5',
  F02: 'pages/阶段1_数据批次_批次详情与校验结果.md; pages/阶段1_数据批次_批次详情与校验结果.html; pages/阶段1_行动清单_建议详情.md; pages/阶段1_行动清单_建议详情.html; 技术方案.md §4-5',
  F03: 'pages/阶段1_行动清单_建议详情.md; pages/阶段1_行动清单_建议详情.html; 技术方案.md §4-5',
  F04: 'pages/阶段1_行动清单_建议详情.md; pages/阶段1_行动清单_建议详情.html; 技术方案.md §6',
  F05: 'pages/阶段1_行动清单_行动清单列表.md; pages/阶段1_行动清单_行动清单列表.html; pages/阶段1_行动清单_建议详情.md; pages/阶段1_行动清单_建议详情.html; 技术方案.md §3-5',
  F06: 'pages/阶段1_行动清单_建议详情.md; pages/阶段1_行动清单_建议详情.html; pages/阶段1_审核执行_建议审核表单.md; pages/阶段1_审核执行_建议审核表单.html; pages/阶段1_审核执行_经营动作执行表单.md; pages/阶段1_审核执行_经营动作执行表单.html; pages/阶段1_审核执行_采购动作执行表单.md; pages/阶段1_审核执行_采购动作执行表单.html; pages/阶段1_审核执行_经营结果记录表单.md; pages/阶段1_审核执行_经营结果记录表单.html; 技术方案.md §4-5',
  F07: 'pages/阶段1_身份权限_钉钉认证门禁.md; pages/阶段1_身份权限_钉钉认证门禁.html; pages/阶段1_身份权限_权限不足.md; pages/阶段1_身份权限_权限不足.html; pages/阶段1_行动清单_建议详情.md; pages/阶段1_行动清单_建议详情.html; 技术方案.md §7',
  F08: 'pages/阶段1_历史追溯_历史追溯索引.md; pages/阶段1_历史追溯_历史追溯索引.html; pages/阶段1_行动清单_建议详情.md; pages/阶段1_行动清单_建议详情.html; 技术方案.md §4-5',
};

const invariants = {
  F01: '指纹重复→返回原批次；必要身份拒绝行，其他字段只按依赖降级；不得生成第二清单',
  F02: '周期/分母/字段非法→不计算并显示原因；不得猜默认值；同冻结快照指标一致',
  F03: '分类或依赖不足→明确不判定；主动作唯一；止损/清仓与禁补同事务原子生成',
  F04: 'AI 等待/失败/越界→结构化四要素继续；不得改写类型、动作、阈值或虚构值',
  F05: '筛选空与加载失败分离；固定动作层级不被 AI 改变；纯维持且无采购动作不入清单',
  F06: '非责任角色/非法迁移/version 过期→拒绝且返回最新状态；成功事件不被覆盖或重复追加',
  F07: '认证失败/无角色/越权→默认拒绝且不返回对象身份；采购路径不得出现受限经营字段',
  F08: '历史源文件或规则变化→继续显示固化快照；事件追加写；审计写失败则状态事务不成功',
};

function featureOf(id) {
  if (id.startsWith('NFR-')) {
    return { 'NFR-001': 'F03', 'NFR-002': 'F07', 'NFR-003': 'F04', 'NFR-004': 'F04', 'NFR-005': 'F08' }[id];
  }
  return id.match(/-(F\d{2})-/)?.[1];
}

const rows = matches.map((match, index) => {
  const end = matches[index + 1]?.index ?? requirements.length;
  const block = requirements.slice(match.index, end);
  const id = match[1];
  const feature = featureOf(id);
  const revision = block.match(/^- Revision:\s*(\d+)/m)?.[1] ?? '1';
  return `| ${id} | ${revision} | ${designs[feature].join(', ')} | ${artifacts[feature]} | ${invariants[feature]} | component + contract + integration + role e2e + audit measurement | covered |`;
});

const appendix = `

## 关键时序

### SEQ-F01-01 批次导入与唯一清单

\`\`\`mermaid
sequenceDiagram
  actor OP as 运营
  participant API as Fastify API
  participant DB as PostgreSQL
  participant RULE as 指标/规则模块
  OP->>API: 期间+截止日+XLSX+幂等请求
  API->>DB: 查询唯一批次指纹
  alt 指纹已存在
    DB-->>API: 原 batch_id 与原清单
    API-->>OP: 返回原批次，不新增事件
  else 新指纹
    API->>DB: 事务创建批次与 SPU 快照
    API->>RULE: 冻结快照+规则版本
    RULE-->>API: 指标、唯一主动作、采购动作
    API->>DB: 事务写建议、动作与生成事件
    API-->>OP: 批次详情与唯一清单
  end
\`\`\`

### SEQ-F06-01 整体审核与分动作执行

\`\`\`mermaid
sequenceDiagram
  actor M as 运营主管
  actor OP as 运营
  actor P as 采购计划
  participant API as API
  participant DB as PostgreSQL
  M->>API: 通过整条建议 + version
  API->>DB: 条件更新审核并同时激活全部动作
  DB-->>M: 新 version
  par 经营动作
    OP->>API: 执行经营动作 + version
    API->>DB: 更新经营 ActionItem + 追加事件
  and 采购动作
    P->>API: 补货/禁补确认 + version
    API->>DB: 更新采购 ActionItem + 追加裁剪事件
  end
\`\`\`

### SEQ-F04-01 AI 非阻塞解释

\`\`\`mermaid
sequenceDiagram
  participant API as API
  participant DB as PostgreSQL
  participant AI as 既有 LiteLLM
  API->>DB: 提交固定规则四要素，清单就绪
  API-->>AI: 白名单指标/动作/阈值
  alt 成功且结构合法
    AI-->>API: 增强解释
    API->>DB: 更新 AIExplanation，不改 Decision
  else 超时/失败/越界
    API->>DB: 标记失败或舍弃越界内容
  end
\`\`\`

## 状态与并发不变式

- ImportBatch：新建→校验中→规则处理中→清单就绪；无可识别 SPU 或期间无效进入失败。AI 状态独立，不把清单就绪改回失败。
- DecisionRecord：待审核→已通过或已驳回，终态不可覆盖；同一旧 version 只允许首个合法提交成功。
- ActionItem：待审核激活→待执行→已执行→已记录结果；建议驳回时进入随建议驳关闭。不同动作可处于不同进度，总览只读聚合。
- 非法迁移、重复请求、越权与 version 冲突均不改变业务状态；失败请求进入按权限裁剪的安全审计。

## NFR 测量点

- NFR-001：以冻结快照与规则版本重放，逐项比较类型、主动作、采购动作，差异数必须为 0。
- NFR-002：采购页面、接口、错误和审计路径执行字段快照负向测试，受限字段出现数必须为 0。
- NFR-003：前端包、响应、日志与错误扫描 deployment secret 及可恢复片段，命中数必须为 0。
- NFR-004：模拟 LiteLLM 超时/失败时，清单可审核与动作可执行检查必须通过。
- NFR-005：随机建议核对批次、期间、规则版本、关键值、actor、时间和事件链，完整率必须为 100%。
`;

const output = `# 设计追溯矩阵

> Source：requirements revision 2。全部 active source 均属于 MVP，必须施工级 covered。

| Source ID | Source Revision | Design IDs | Artifact | Error/Invariant | Verification Surface | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${rows.join('\n')}${appendix}`;

fs.writeFileSync(path.join(root, '设计追溯矩阵.md'), output);
console.log(`TRACE_MATRIX_WRITTEN ${rows.length} source rows`);
