# Design System Inspired by 趣然 AI 商品经营与利润决策助手

> Category: E-Commerce & Retail
> 一套像经营作战桌一样冷静、可信，并让利润与库存责任始终并轨可见的企业级设计系统。

## 1. 视觉主题与氛围

### 核心隐喻：铺在晨光里的经营作战桌

每个周一清晨，经营数据像一摞刚从打印机送出的报表，被铺在一张温暖而洁净的桌面上。

暖白背景不是装饰性的米色，而是纸张在自然光中的质感：它让长时间阅读变得柔和，也提醒人们这里处理的是可复核的经营事实。

墨色文字如同耐水的档案墨水，任何结论都清晰、稳定、不含糊。

靛蓝像审核章，只落在真正需要拍板和行动的位置。

红、橙、琥珀不会铺满屏幕；它们是财务风险的批注，只在证据已成立时出现。

这张桌子上最醒目的不是一张漂亮图表，而是一条横向贯穿建议的“双轨决策带”。

左轨代表运营的经营主动作，右轨代表采购计划的补货或禁补动作。

两条轨道从同一个规则节点分出，又在状态节点处共同暴露跨部门卡点。

用户不必在多个系统间拼接事实，就能看见“为什么止损”和“为什么禁补”其实属于同一决策。

### 用户情绪

- 冷静：亏损和滞销值得警觉，但界面不使用警报墙制造恐慌。
- 清楚：每个数字都有期间、采用值、质量状态与来源。
- 可信：固定规则在视觉上高于 AI 解释，避免把概率语言误当裁决。
- 可行动：建议从发现问题自然落到审核、执行与结果记录。
- 有掌控感：运营主管能在一屏内理解整条建议，而非被碎片状态牵着走。

### 设计决策理由

选择浅色模式，是因为这是在白天办公环境中高频阅读表格、证据和备注的内部工具。

暖白减少纯白大面积发光的疲劳，也比深色 HUD 更接近经营档案的可信语境。

选择 Professional & Corporate 的秩序，但不使用传统 ERP 的厚重边框和拥挤控件。

选择现代零售仪表感，让风险、动作和库存状态可以被快速扫描。

选择色彩响应型交互：悬停改变边框或表面色，激活加深色阶；禁止用位移和大阴影制造漂浮玩具感。

### 风格定位

它位于“企业经营审计工具”与“现代 SaaS 工作台”的交点。

它借鉴 Linear 的信息克制，却放弃科技产品常见的冷黑背景。

它借鉴 Stripe Dashboard 的状态清晰，却用更适合中国零售团队的高密度中文表格。

它借鉴 Shopify Polaris 的零售语义，却不采用消费端促销色彩。

它借鉴 GOV.UK 的证据可读性，坚持错误与恢复路径必须可理解。

### 设计签名：利润—库存双轨决策带

双轨带必须出现在建议卡、建议详情摘要与关键工作台卡点中。

左轨标题固定为“经营动作”，右轨标题固定为“补货动作”。

规则节点置于两轨上游，显示规则版本和触发链入口。

动作未一致完成时，连接节点使用琥珀语义，不用闪烁。

止损或清仓与禁补必须同屏、同高度、同源节点呈现。

采购计划视图只显示右轨和最小必要的库存销量依据，不暴露被裁剪的左轨字段。

### 色彩速览

| 色彩 | Hex | 角色 |
|---|---:|---|
| 暖纸白 | `#F7F5F0` | 应用背景与阅读基底 |
| 纯净白 | `#FFFFFF` | 卡片、表格与表单表面 |
| 档案墨 | `#18202B` | 一级文字与关键数字 |
| 靛青印章 | `#3347A8` | 主动作、链接、焦点与品牌 |
| 青绿确认 | `#087A62` | 成功、补货与已完成 |
| 琥珀提醒 | `#9A5B00` | 观察、卡点与待补信息 |
| 审计红 | `#B42318` | 清仓、止损与阻断错误 |

### Prior Art

| 先例 | 汲取 | 明确不复制 |
|---|---|---|
| Linear | 紧凑层级、克制强调色 | 深色科技氛围与玻璃拟态 |
| Stripe Dashboard | 状态层次、数据对齐 | 面向开发者的英文密度 |
| Shopify Polaris | 零售后台语义、任务反馈 | 商家营销与促销感 |
| GOV.UK Design System | 错误可读性、恢复路径 | 公共服务的粗重视觉 |

## 2. 色彩美学

### 色彩哲学

`#F7F5F0` 是带有纸张温度的背景，使周度报表和历史证据像被妥善归档，而不是漂浮在发光屏幕上。

`#18202B` 是略带蓝相的墨色，保持专业冷静，又避免纯黑造成的生硬对比。

`#3347A8` 不是电商促销蓝，而是一枚审核印章：只服务于主 CTA、链接、选中态和焦点。

`#087A62` 将库存补货与完成状态连接到稳健增长，而非霓虹式“成功”。

`#9A5B00` 表达需要跟进但尚未失败的状态，适合观察、数据缺口与跨部门卡点。

`#B42318` 只在业务风险或阻断错误已有证据时使用，避免用户对红色脱敏。

### 强调色纪律

每屏最多出现 2 处高权重 accent：一个标签或选中入口，加一个主 CTA。

链接、hover、focus ring 同样计入 accent 用量。

中性色占画面 70–90%，accent 占 5–10%，语义色占 0–5%。

图表不得为了“丰富”而扩展无语义彩虹色板。

### Surface 色板

| Token | Hex | 用途与理由 |
|---|---:|---|
| `--bg` | `#F7F5F0` | 长时阅读的暖纸背景 |
| `--surface` | `#FFFFFF` | 数据与操作的清洁承载面 |
| `--surface-warm` | alias | 保持层级克制，不伪造额外色面 |
| `--surface-raised` | alias | 浅色模式通过边框响应而非变亮 |
| `--surface-overlay` | alias | 模态层依靠遮罩与层级投影 |
| `--border` | `#C8CDD3` | 清晰划分表格与输入边界 |

### Accent 与语义色板

| Token | Hex | 情感使命 |
|---|---:|---|
| `--accent` | `#3347A8` | 可信拍板与可行动入口 |
| `--accent-on` | `#FFFFFF` | 强调面上的清晰文字 |
| `--success` | `#087A62` | 已完成、补货确认、数据有效 |
| `--warn` | `#9A5B00` | 观察、待处理、数据降级 |
| `--danger` | `#B42318` | 清仓、止损、错误阻断 |

### Text 色板与可读性

| Token | Hex | 配对 | WCAG 对比度 |
|---|---:|---|---:|
| `--fg` | `#18202B` | `#F7F5F0` | 约 14.7:1 |
| `--fg-2` | alias | `#FFFFFF` | 约 16.5:1 |
| `--muted` | `#536170` | `#FFFFFF` | 约 6.4:1 |
| `--meta` | alias | `#F7F5F0` | 约 5.8:1 |
| `--accent-on` | `#FFFFFF` | `#3347A8` | 约 7.6:1 |

所有正文配对均满足 WCAG 2.2 AA 普通文本 4.5:1。

语义色作为文字时只在白色或暖白表面上使用；浅色语义底通过 `color-mix()` 从语义色与表面生成。

组件 CSS 不允许硬编码颜色，必须引用 token。

### 可执行颜色契约

```css
:root {
  --bg: #F7F5F0;
  --surface: #FFFFFF;
  --fg: #18202B;
  --muted: #536170;
  --border: #C8CDD3;
  --accent: #3347A8;
  --accent-on: #FFFFFF;
  --success: #087A62;
  --warn: #9A5B00;
  --danger: #B42318;
}
```

## 3. 排版与字体

### 字体哲学

中文界面采用 Noto Sans SC 与系统无衬线回退，字面稳定、识别清晰，适合密集表格与跨平台部署。

Display 与 Body 使用同一骨架，使标题不是宣传口号，而是经营结构的一部分。

Roboto Mono 服务于 SPU ID、规则版本、百分比、日期和审计 version；等宽数字让纵向比较像尺规一样准确。

### 字体栈

Font labels for catalog extraction:

Display: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif
Body: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif
Mono: "Roboto Mono", "SFMono-Regular", Consolas, monospace

### 字号梯度

| Token | 值 | 典型用途 |
|---|---:|---|
| `--text-xs` | 12px | 元数据、期间、版本 |
| `--text-sm` | 14px | 表格、标签、辅助说明 |
| `--text-base` | 16px | 正文、表单输入 |
| `--text-lg` | 18px | 卡片标题 |
| `--text-xl` | 20px | 区块标题 |
| `--text-2xl` | 24px | 页面标题 |
| `--text-3xl` | 32px | 工作台关键结论 |
| `--text-4xl` | 48px | 展示页和空状态大字 |

梯度在小字号区域更紧密，保证高密度数据有足够层次；24px 以上拉开步幅，形成明确页面锚点。

### Letter-spacing 硬规则

| 类型 | 精确值 |
|---|---:|
| ALL CAPS | `0.08em` |
| Display 48px+ | `-0.025em` |
| 标题 32px+ | `-0.015em` |
| 小文本 11–13px | `0.015em` |
| UI 标签 / 按钮 | `0.02em` |
| 正文 | `0` |

### Line-height

正文使用 `1.65`，让长备注、错误恢复和 AI 解释易于逐行阅读。

标题使用 `1.25`，保持紧凑、坚定的仪表感。

表格单行数据使用 `1.4`，行高由垂直 padding 提供，不挤压中文笔画。

金额、百分比、日期与 ID 必须启用 `font-variant-numeric: tabular-nums`。

标题不使用全大写英文模拟“科技感”；仅短 eyebrow 可用 ALL CAPS 规则。

## 4. 间距体系

### 间距哲学

4px 是这套经营界面的最小节拍，像报表网格中的基本刻度。

8px 用于图标与文字，12px 用于紧凑单元，16px 构成默认控件和卡片内距。

24px 分隔同一任务中的认知组，32px 分隔页面区块，48px 留给重大结构切换。

| Token | 值 | 节奏角色 |
|---|---:|---|
| `--space-1` | 4px | 细微对齐 |
| `--space-2` | 8px | 图文间距 |
| `--space-3` | 12px | 紧凑控件 |
| `--space-4` | 16px | 默认内距 |
| `--space-5` | 20px | 表单组 |
| `--space-6` | 24px | 认知组 |
| `--space-8` | 32px | 区块 |
| `--space-12` | 48px | 章节 |

Section rhythm：desktop 80px、tablet 64px、phone 48px。

产品 MVP 最小宽度 1024px；phone 值仅供设计系统展示与未来兼容，不代表建设移动业务端。

页面不得使用 18px、22px 等脱离节拍的随意间距。

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
}
```

## 5. 布局与空间构成

### 布局哲学

Bento Grid 不是把卡片摆得好看，而是把批次、风险、审核和跨部门卡点拆成独立认知单元。

用户可以先扫描格子的标题与关键数字，再决定是否进入详情，不必把整张页面从头读到尾。

固定左侧栏稳定全站方位，面包屑回答当前对象位于哪一批数据和哪条建议。

### Bento Grid 策略

- 1440px 主设计宽度使用 12 列网格，列间距 24px。
- 工作台风险概览可占 3 列，最新批次占 6 列，跨部门卡点占 6–12 列。
- 建议详情的双轨决策带横跨 12 列，不可挤入窄侧栏。
- 1024–1279px 使用 8 列网格，次要卡片下移，不压缩表格必要字段。
- 低于 1024px 显示桌面使用提示，不承诺业务流程可操作。

### Container

`--container-max: 1320px` 为 1440px 画布保留导航与呼吸空间，同时容纳高密度数据表。

桌面 gutter 32px，平板 24px，展示页手机 16px。

列表表头和正文共享同一列线，筛选区不建立另一套对齐基准。

### 深度与层级

默认数据卡保持 flat，依靠暖背景与白色表面形成第一层深度。

可交互卡使用 ring 作为明确边界，hover 只响应边框或表面色。

下拉、抽屉和模态使用 raised 或 float 投影，表示暂时覆盖当前任务。

禁止给所有卡片添加阴影；那会让每个信息单元都争夺注意力。

### 响应式行为

桌面：左侧栏固定，内容区域独立滚动，关键表头可粘滞。

窄桌面：侧栏保持图标与标题，不用汉堡菜单隐藏全站结构。

表格：优先冻结 SPU 与动作列，必要时允许内容区水平滚动。

抽屉式表单：桌面占 520–640px，摘要和确认保持在视口内。

错误、空和权限不足状态始终留在应用壳中，保留导航上下文。

### 空间优先级

第一优先：唯一主动作和补货结论。

第二优先：规则证据、指标质量与审核状态。

第三优先：AI 解释、辅助元数据和历史展开项。

空间不足时按此顺序折叠，绝不能反向隐藏固定规则而保留 AI 文案。

## 6. 组件设计

### 组件哲学

组件不是装饰零件，而是责任和证据的容器。

按钮必须表达动作层级；卡片必须表达信息边界；输入必须表达当前可否提交；徽章必须表达状态而非品牌。

交互统一采用色彩响应型：hover 改变边框或背景，active 加深色阶，不使用 transform，不通过阴影提升表达 hover。

### 按钮

主按钮只用于当前任务唯一主要提交，例如“确认通过”或“开始导入”。

次按钮用于返回、取消和次级查看。

危险按钮引用 danger，但仍需摘要确认，不以红色替代风险说明。

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font: 600 var(--text-sm)/1 var(--font-body);
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);
}
.btn--primary { background: var(--accent); color: var(--accent-on); }
.btn--primary:hover { background: var(--accent-hover); }
.btn--primary:active { background: var(--accent-active); }
.btn--secondary { background: var(--surface); color: var(--fg); border-color: var(--border); }
.btn--secondary:hover { border-color: var(--accent); background: color-mix(in oklab, var(--accent), var(--surface) 96%); }
.btn--secondary:active { background: color-mix(in oklab, var(--accent), var(--surface) 91%); }
.btn--danger { background: var(--danger); color: var(--accent-on); }
.btn--danger:hover { background: color-mix(in oklab, var(--danger), black 8%); }
.btn--danger:active { background: color-mix(in oklab, var(--danger), black 14%); }
.btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.btn:disabled { cursor: not-allowed; opacity: .48; }
```

8px 圆角在企业工具中足够友好，又不会让按钮像消费端胶囊。

### 数据卡片

卡片默认无阴影，让内容依靠背景层级而非漂浮感分组。

```css
.card {
  padding: var(--space-6);
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--elev-flat);
  transition: background-color var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard);
}
.card:hover { border-color: var(--accent); background: color-mix(in oklab, var(--accent), var(--surface) 98%); }
.card:active { background: color-mix(in oklab, var(--accent), var(--surface) 94%); }
.card:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

卡片若不可点击，不绑定 hover，避免制造虚假可操作性。

### 输入框

输入框默认提供清晰边界，错误态同时显示文字，不仅变色。

```css
.field {
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font: var(--text-base)/var(--leading-body) var(--font-body);
  transition: border-color var(--motion-fast) var(--ease-standard), background-color var(--motion-fast) var(--ease-standard);
}
.field:hover { border-color: var(--accent); }
.field:active { background: color-mix(in oklab, var(--accent), var(--surface) 98%); }
.field:focus-visible { outline: none; border-color: var(--accent); box-shadow: var(--focus-ring); }
.field[aria-invalid="true"] { border-color: var(--danger); }
.field:disabled { color: var(--muted); background: var(--bg); cursor: not-allowed; }
```

### 徽章

徽章用于状态和分类，默认紧凑但保持 24px 最小高度。

```css
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-pill);
  color: var(--fg);
  background: var(--surface);
  font: 600 var(--text-xs)/1 var(--font-body);
  letter-spacing: 0.02em;
  transition: border-color var(--motion-fast) var(--ease-standard), background-color var(--motion-fast) var(--ease-standard);
}
.badge--success { color: var(--success); background: color-mix(in oklab, var(--success), var(--surface) 94%); }
.badge--warn { color: var(--warn); background: color-mix(in oklab, var(--warn), var(--surface) 94%); }
.badge--danger { color: var(--danger); background: color-mix(in oklab, var(--danger), var(--surface) 94%); }
.badge:hover { border-color: var(--accent); }
.badge:active { background: color-mix(in oklab, var(--accent), var(--surface) 92%); }
.badge:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

### 双轨决策带

这是签名组件，不得退化为两个无关联徽章。

```css
.decision-band {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--space-3);
  align-items: stretch;
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: border-color var(--motion-base) var(--ease-standard), background-color var(--motion-base) var(--ease-standard);
}
.decision-band:hover { border-color: var(--accent); background: color-mix(in oklab, var(--accent), var(--surface) 98%); }
.decision-band:active { background: color-mix(in oklab, var(--accent), var(--surface) 94%); }
.decision-band:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.decision-track { padding: var(--space-3); border-radius: var(--radius-md); background: var(--bg); }
.decision-node { align-self: center; color: var(--accent); font-family: var(--font-mono); }
.decision-track--blocked { color: var(--warn); border: 1px solid var(--warn); }
```

在 1024px 以上双轨始终并排；打印或窄展示环境可纵向排列，但保留规则节点连接关系。

### 页内提示

权限、并发冲突和网络失败必须提供恢复动作。

```css
.notice {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-3);
  padding: var(--space-4);
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-md);
  transition: border-color var(--motion-fast) var(--ease-standard), background-color var(--motion-fast) var(--ease-standard);
}
.notice--warning { border-left-color: var(--warn); }
.notice--error { border-left-color: var(--danger); }
.notice:hover { background: color-mix(in oklab, var(--accent), var(--surface) 98%); }
.notice:active { background: color-mix(in oklab, var(--accent), var(--surface) 94%); }
.notice:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

### 表格行

表格承载扫描，不使用斑马纹掩盖列对齐。

```css
.data-row {
  color: var(--fg);
  background: var(--surface);
  border-bottom: 1px solid var(--border-soft);
  transition: background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.data-row:hover { background: color-mix(in oklab, var(--accent), var(--surface) 97%); }
.data-row:active { background: color-mix(in oklab, var(--accent), var(--surface) 93%); }
.data-row:focus-visible { outline: none; box-shadow: inset var(--focus-ring); }
.data-cell--number { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }
```

### 组件状态总则

所有可交互组件必须具备 hover、active、focus-visible 和 disabled（适用时）。

焦点状态不得只依赖颜色差异，必须使用三像素 focus ring。

加载态不替换标题，避免页面布局跳动和用户失去上下文。

无权限状态不显示对象身份、状态或被裁剪字段的占位轮廓。

Toast 只承载轻量成功；错误、权限和冲突必须留在页内。

## 7. 动效与交互物理

### 动效哲学

动效是状态变化的语法，不是庆祝经营风险的舞台效果。

150ms 用于按钮、输入和短距离色彩反馈；200ms 用于卡片、菜单、抽屉和信息层级切换。

标准曲线 `cubic-bezier(0.2, 0, 0, 1)` 快速响应起点，再平稳落定，像审核人落下一枚稳健的章。

### 微反馈

```css
.motion-button {
  transition: background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.motion-button:hover { background: var(--accent-hover); }
.motion-button:active { background: var(--accent-active); }
.motion-button:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.motion-field { transition: border-color var(--motion-fast) var(--ease-standard); }
.motion-field:hover { border-color: var(--accent); }
.motion-field:active { border-color: var(--accent-active); }
.motion-field:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.motion-card { transition: background-color var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard); }
.motion-card:hover { border-color: var(--accent); }
.motion-card:active { background: color-mix(in oklab, var(--accent), var(--surface) 94%); }
.motion-card:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

### 进场编排

```css
@keyframes evidence-enter {
  from { opacity: 0; clip-path: inset(0 8% 0 0); }
  to { opacity: 1; clip-path: inset(0 0 0 0); }
}
.enter-item { animation: evidence-enter var(--motion-base) var(--ease-standard) both; }
.enter-item:nth-child(2) { animation-delay: calc(var(--motion-fast) / 2); }
.enter-item:nth-child(3) { animation-delay: var(--motion-fast); }
.enter-item:nth-child(4) { animation-delay: calc(var(--motion-fast) + var(--motion-fast) / 2); }
```

进场顺序遵循：页面标题 → 固定规则结论 → 证据 → AI 解释。

不得让 AI 解释先于固定规则出现。

### 状态切换

```css
.tab-panel { opacity: 0; transition: opacity var(--motion-fast) var(--ease-standard); }
.tab-panel[data-active="true"] { opacity: 1; }
.drawer { opacity: 0; visibility: hidden; transition: opacity var(--motion-base) var(--ease-standard), visibility var(--motion-base) var(--ease-standard); }
.drawer[data-open="true"] { opacity: 1; visibility: visible; }
.menu { opacity: 0; clip-path: inset(0 0 12% 0); transition: opacity var(--motion-fast) var(--ease-standard), clip-path var(--motion-fast) var(--ease-standard); }
.menu[data-open="true"] { opacity: 1; clip-path: inset(0 0 0 0); }
.tab-panel:focus-visible, .drawer:focus-visible, .menu:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .enter-item { animation: none; }
  .motion-button, .motion-field, .motion-card, .tab-panel, .drawer, .menu { transition-duration: 0ms; }
}
```

只关闭具体元素的动画，禁止使用全局 `*` 覆盖用户代理与关键可用性反馈。

加载使用静态骨架色面与简短状态文字，不采用无限旋转的品牌动画。

审核和执行成功不放烟花，只以 Toast、状态文字和时间线事件平稳确认。

## 8. 品牌情感与声音

### 品牌灵魂

- 冷静：面对亏损先给事实，不用夸张感叹号。
- 严谨：每个结论都能回到批次、规则版本和原始关键值。
- 协作：明确运营与采购计划各自责任，同时显示两者是否并轨。
- 克制：AI 是解释员，不抢夺固定规则的权威。
- 可行动：错误文案总要告诉用户下一步能做什么。

### 情感化细节

空状态像一张尚未写入的经营记录：使用细线档案图标、明确标题和唯一下一步，不使用庆祝插画。

Loading 保留页面骨架与当前批次标题，文案说明“正在校验字段”或“正在生成固定规则结论”，不用笼统“加载中”。

404 留在应用壳中，标题为“这个位置没有经营记录”，提供返回工作台或上一页。

500 使用“本次请求未完成，已保存的批次和状态不会被覆盖”，强调数据安全并提供重试。

权限不足不泄露对象名称；只说明当前角色没有访问此位置的权限，并提供返回角色工作台。

### 插画与视觉装饰

只使用二维档案线、规则节点和双轨线，不使用拟人卡通、3D 金币、火箭或促销礼盒。

装饰线条必须帮助解释数据来源、规则流向或动作责任。

如果线条没有信息使命，就不应出现。

### Agent 设计指令

1. 始终先渲染固定规则结论，再渲染 AI 解释；两者视觉权重至少相差一级。
2. 所有建议关键摘要必须使用利润—库存双轨决策带，不得拆成无关联卡片。
3. 使用暖白背景、白色表面和克制靛蓝；每屏最多两个高权重 accent。
4. 所有可交互组件采用色彩响应型反馈，禁止 transform 位移和 hover 阴影抬升。
5. 权限、错误和并发冲突必须提供页内恢复路径，不得只发 Toast。

### 声音范例

推荐：“品退期间尚未校验，本批次未使用该指标判断观察或加投。”

禁止：“AI 认为这个商品可能不太好，请谨慎处理！”

推荐：“检测到其他人已更新状态。你填写的备注仍在，请刷新后确认最新状态。”

禁止：“提交失败，请重试。”

## 9. 设计禁忌

- 禁止把 AI 解释放在固定规则结论之前——概率语言不能覆盖确定性经营裁决。
- 禁止使用科幻 HUD、霓虹描边或玻璃拟态——白天高频经营工作需要清晰而非沉浸式炫技。
- 禁止用大面积红色背景表达风险——红色只标记已证实的清仓、止损或阻断错误，避免警报疲劳。
- 禁止让止损/清仓与禁补分散在不同页面——跨部门断点正是产品要解决的核心问题。
- 禁止混用位移、阴影提升和色彩响应 hover——统一交互语法才能形成稳定预期。
- 禁止给所有卡片加阴影——过多浮层会破坏证据主次并增加视觉噪声。
- 禁止使用超过 12px 的常规卡片圆角——消费端软萌感会削弱审计与经营工具的精密度。
- 禁止以颜色作为错误或状态的唯一载体——必须同时提供图标、文字和恢复动作。
- 禁止在权限不足状态显示业务对象身份或裁剪字段骨架——任何暗示都可能形成信息泄露。
- 禁止用无限滚动承载行动清单——服务端分页与 URL 筛选才支持可复查的周度工作。
- 禁止使用彩虹数据图表——颜色必须保持动作与风险语义，不能只为丰富画面。
- 禁止使用消费促销文案、感叹号或庆祝动画——经营风险需要尊重、克制和事实语言。
- 禁止隐藏指标的期间、质量状态和降级原因——没有口径的数据不具备决策资格。
- 禁止在组件 CSS 中硬编码颜色——token 是页面与权限状态一致性的机器契约。
- 禁止为窄屏压缩掉 SPU、唯一主动作或补货结论——这些是最低不可失真的信息。
