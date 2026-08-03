# Design System Inspired by 趣然 AI 商品经营与利润决策助手

> Category: E-Commerce & Retail
> 一套让利润风险、库存责任与执行进度在同一视野中保持清醒的浅色经营工作台。

## 1. 视觉主题与氛围

### 核心隐喻：清晨的经营控制室

这套界面像一间刚刚亮起晨光的经营控制室。

窗外不是霓虹和宇宙，而是每周一准时送达的经营事实：销售、利润、品退、库存和动作责任。

云白与浅蓝灰构成稳定的工作台面，像摊开的经营底稿；深海军蓝负责给结论定锚，让每个数字都知道自己属于哪个批次、哪个期间、哪条规则。

用户不需要被 AI 的光效包围。

他们需要在几十秒内判断：哪个 SPU 必须清仓，哪个推广应该止损，哪个库存需要补货，以及谁还没有完成动作。

因此界面把“结论”放在前，把“解释”放在后；把固定规则放在明处，把 AI 放在可折叠的辅助层。

设计的价值不是制造更多信息，而是让原本分散的信息形成可执行的秩序。

### 用户情绪

- 冷静：风险色明确，但不使用大面积警报红制造焦虑。
- 掌控：当前批次、业务截止日和角色始终可见，用户知道自己正在处理哪一份事实。
- 确信：规则证据展示实际值、周期、阈值和比较关系，不靠模糊的“AI 判断”。
- 协作：经营动作和库存动作并排出现，让跨部门断点无法藏在页面下方。
- 可恢复：网络失败、并发冲突和数据缺失都有明确下一步，不让用户陷入空白页。

### 为什么选择浅色

这是运营、主管和采购在办公时间长期使用的数据密集型工具。

浅色能够保持表格列、数字、小字号标签和输入控件的可读性，也能让动作语义色在必要时出现，而不是被深色背景迫使全屏高饱和。

浅色并不等于松散。

本系统用低饱和蓝灰、紧凑排版、细边界和克制阴影建立专业感，让页面更接近经营底稿与控制台的结合，而不是消费型商城。

### 风格定位

视觉语言借鉴 Linear 的信息纪律、Stripe Dashboard 的财务可信度和 Shopify Admin 的零售任务导向。

它不复制三者的品牌外观，而是提取共同原则：上下文稳定、状态清晰、表格紧凑、详情层次明确。

区别在于“双轨决策脊线”。

同一 SPU 的经营动作与库存动作不是两张孤立卡片，而是从同一组规则证据出发的两条责任轨。

这是本产品最重要的识别符，也直接回应“运营止损后采购仍补货”的真实损失案例。

### 设计签名：双轨决策脊线

详情页中，经营动作轨与库存动作轨平行展开。

两轨之间由规则证据节点连接：利润率、品退率、库存可售天数和优先级裁决依次成为脊线上的节点。

清仓或止损出现时，库存轨必须同步显示禁止补货；加投可以与补货并存，但责任人和状态分别呈现。

这条脊线不是装饰。

它是固定规则、跨部门责任和审计追溯的视觉压缩。

### 色彩速览

| 色彩 | Hex | 角色 |
| :--- | :--- | :--- |
| 云白背景 | `#F4F7FB` | 页面底色，承接长时间阅读 |
| 纯白表面 | `#FFFFFF` | 卡片、表格、浮层 |
| 深海军蓝 | `#123B66` | 品牌主色、主按钮、关键链接 |
| 墨蓝正文 | `#122033` | 主文本和关键数字 |
| 清仓红 | `#B42318` | 最高经营风险 |
| 止损橙 | `#C4510C` | 需要立即收缩投入 |
| 观察琥珀 | `#9A5B00` | 需要持续验证的数据风险 |
| 加投绿 | `#137A4A` | 已满足增长条件 |
| 补货蓝 | `#1769AA` | 采购计划动作 |
| AI 紫灰 | `#5B5F8A` | 辅助解释，不与规则争权 |

### 参考先例

| 先例 | 汲取内容 | 明确不复制 |
| :--- | :--- | :--- |
| Linear | 稳定侧栏、快捷任务定位、克制状态反馈 | 暗色科技氛围与高频命令式操作 |
| Stripe Dashboard | 财务数字层级、可信留白、审计语气 | 面向外部商户的增长营销表达 |
| Shopify Admin | 零售任务组织、状态标签、表格与详情衔接 | 商品装修和消费者电商视觉 |
| IBM Carbon | 数据密度、无障碍、语义反馈纪律 | 过强的企业组件库外观 |

## 2. 色彩美学

### 色彩哲学

深海军蓝不是“科技蓝”，而是经营结论的压舱石。

它在白色表面上保持足够对比，同时比纯黑更温和，适合长时间查看数字和状态。

动作色只在动作标签、关键脊线节点和必要的风险摘要中出现。

颜色必须和文字、图标共同表达，任何人都不应仅靠色觉区分清仓与止损。

### 强调色纪律

- 中性色占单屏面积的 70%—90%。
- `--accent` 占 5%—10%，每屏最多两处强可见使用：一个主行动入口与一个当前上下文锚点。
- 语义色占 0%—5%，只标记真实动作、异常或状态。
- 链接、悬停边框和焦点环都计入强调色用量。
- AI 紫灰不算品牌强调色，也不得作为主 CTA。

### Surface 色板

| Token | Hex/映射 | 用途 | 理由 |
| :--- | :--- | :--- | :--- |
| `--bg` | `#F4F7FB` | 页面底色 | 降低纯白大面积眩光 |
| `--surface` | `#FFFFFF` | 表格和卡片 | 建立清晰工作台面 |
| `--surface-warm` | `var(--surface)` | 无额外暖层 | 避免无业务意义的色温混用 |
| `--surface-raised` | `var(--surface)` | 下拉和抬升态 | 依靠阴影与边界区分层级 |
| `--surface-overlay` | `var(--surface)` | 模态最高层 | 保持文字对比一致 |
| `--surface-hover` | `#EDF3F9` | 行和卡片悬停 | 用色彩响应表达可操作性 |

### Data 与动作色板

| Token | Hex | 情感与功能 |
| :--- | :--- | :--- |
| `--accent` | `#123B66` | 稳定、可信、可执行 |
| `--success` | `#137A4A` | 成功与加投 |
| `--warn` | `#9A5B00` | 观察与待确认风险 |
| `--danger` | `#B42318` | 清仓、错误和阻断 |
| `--action-stop` | `#C4510C` | 止损，不与清仓同色 |
| `--action-replenish` | `#1769AA` | 补货与采购轨 |
| `--ai` | `#5B5F8A` | AI 辅助信息 |

### Text 色板与对比

| Token | Hex/映射 | 主要背景 | WCAG 结果 |
| :--- | :--- | :--- | :--- |
| `--fg` | `#122033` | `#FFFFFF` / `#F4F7FB` | 普通文本达到 AA |
| `--fg-2` | `var(--fg)` | 同上 | 与主文本一致 |
| `--muted` | `#53657A` | `#FFFFFF` | 普通文本达到 AA |
| `--meta` | `var(--muted)` | `#FFFFFF` | 普通文本达到 AA |
| `--accent-on` | `#FFFFFF` | `#123B66` | 普通按钮文字达到 AA |

所有关键配对在交付前使用 WCAG 2.2 对比度公式复核。

边框不是唯一分隔手段；表格同时使用行高、背景响应和分组标题维持结构。

## 3. 排版与字体

### 字体哲学

产品不依赖境外字体服务。

中文正文采用系统无衬线字体，让公司电脑在不同网络环境下都保持快速、稳定和熟悉。

数字、SPU ID、批次号和规则版本使用系统等宽字体，避免多位数字在表格中跳动。

大标题不追求品牌海报感，而强调批次上下文和任务优先级。

### 字体栈

Font labels for catalog extraction:

Display: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
Body: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
Mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace

### 字号梯度

| Token | 尺寸 | 使用场景 |
| :--- | :--- | :--- |
| `--text-xs` | 12px | 时间、周期、辅助元数据 |
| `--text-sm` | 13px | 标签、表头、次级说明 |
| `--text-base` | 14px | 表格、表单、正文 |
| `--text-lg` | 16px | 卡片标题、关键字段 |
| `--text-xl` | 18px | 区域标题 |
| `--text-2xl` | 22px | 页面标题 |
| `--text-3xl` | 28px | 工作台核心数字 |
| `--text-4xl` | 36px | 登录页品牌标题、展示页 Hero |

14px 是密集 PC 工作台的主字号，配合 1.6 行高保证中文阅读。

### Letter-spacing 硬规则

| 文本类型 | 字距 |
| :--- | :--- |
| ALL CAPS | `0.08em` |
| 48px 以上 Display | `-0.025em` |
| 32px 以上标题 | `-0.015em` |
| 11—13px 小文本 | `0.015em` |
| UI 标签与按钮 | `0.02em` |
| 正文 | `0` |

### Line-height

- 正文和表单说明：`var(--leading-body)`，让中文段落保持稳定呼吸。
- 页面标题与核心数字：`var(--leading-tight)`，强化经营仪表感。
- 表格单元格：1.45；多行依据摘要最多三行，完整内容进入详情。
- 金额、百分比和天数启用 `font-variant-numeric: tabular-nums`。

## 4. 间距体系

### 间距哲学

4px 基准让密集表格、标签、按钮和 Bento 分区共享同一节奏。

它足够细，能表达 8px 的紧凑关系，也能通过 24px、32px 和 48px 建立页面级呼吸。

| Token | 值 | 典型用途 |
| :--- | :--- | :--- |
| `--space-1` | 4px | 图标与短标签内部 |
| `--space-2` | 8px | 同组控件、紧凑表格 |
| `--space-3` | 12px | 输入框内部、状态组 |
| `--space-4` | 16px | 卡片内容间距 |
| `--space-5` | 20px | 次级区域间距 |
| `--space-6` | 24px | 卡片与页面分组 |
| `--space-8` | 32px | 页面主区域 |
| `--space-12` | 48px | 登录和展示页大段落 |

Section rhythm：桌面 40px，窄 PC 28px，低于 1024px 的设备提示页使用 20px。

## 5. 布局与空间构成

### 布局哲学

Bento Grid 在这里不是潮流装饰，而是认知分仓。

每个格子承载一个稳定问题：当前批次是什么、风险在哪里、谁负责、下一步做什么。

工作台使用 12 列栅格；主任务占 7—8 列，摘要和限制占 4—5 列。

建议详情把四要素放在第一屏，证据与双轨脊线占主列，审核/执行栏固定在右侧或底部安全区。

### 容器与导航

- 最大内容宽度：`var(--container-max)`，覆盖 1440px 经营表格。
- 桌面边距：28px；窄 PC：20px。
- 左侧导航固定 224px，收起后 64px。
- 顶部上下文栏 56px，始终显示事业部、批次和角色。
- 表格区域允许横向滚动，但关键 SPU 和动作列固定。

### 深度与层级

- 页面底色是最低层。
- 普通卡片使用白色表面和软边界。
- 下拉、悬浮审核栏使用 `--elev-raised`。
- 模态使用 `--elev-float`，但不通过夸张位移制造层级。
- 当前操作区由轻微 accent 边框和焦点环突出。

### 响应式边界

- `≥1280px`：完整侧栏、双栏详情、12 列 Bento。
- `1024—1279px`：侧栏默认收起，详情改为主区加底部操作区。
- `<1024px`：显示受控电脑访问提示，不提供缩小版经营操作。

## 6. 组件设计

### 组件哲学

组件必须先说明任务，再表达品牌。

本系统选择“色彩响应型”交互：悬停时边框或背景轻微变化，不改变卡片位置，不制造数据表跳动。

### 主按钮

用于导入、通过审核、确认执行等单一主行动。

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: 0 var(--space-4);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-on);
  font: 600 var(--text-base)/1 var(--font-body);
  letter-spacing: 0.02em;
  transition: background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn-primary:active { background: var(--accent-active); border-color: var(--accent-active); }
.btn-primary:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.btn-primary:disabled { background: var(--border); border-color: var(--border); color: var(--muted); cursor: not-allowed; }
```

6px 圆角和 40px 高度兼顾办公密度与明确点击区域。

### 次按钮

用于返回、取消和非破坏性辅助动作。

```css
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: 0 var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  font: 600 var(--text-base)/1 var(--font-body);
  transition: background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.btn-secondary:hover { background: var(--surface-hover); border-color: var(--accent); }
.btn-secondary:active { background: var(--accent-soft); border-color: var(--accent); }
.btn-secondary:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.btn-secondary:disabled { color: var(--muted); background: var(--bg); cursor: not-allowed; }
```

### 数据卡片

```css
.data-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--elev-flat);
  padding: var(--space-5);
  color: var(--fg);
  transition: background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.data-card:hover { background: var(--surface-hover); border-color: var(--accent); }
.data-card:active { background: var(--accent-soft); }
.data-card:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

卡片不位移，避免工作台数据在鼠标移动时产生视觉抖动。

### 输入框

```css
.field {
  width: 100%;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  font: 400 var(--text-base)/1.4 var(--font-body);
  transition: background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.field:hover { border-color: var(--accent); }
.field:active { background: var(--surface-hover); }
.field:focus-visible { outline: none; border-color: var(--accent); box-shadow: var(--focus-ring); }
.field[aria-invalid="true"] { border-color: var(--danger); }
.field:disabled { background: var(--bg); color: var(--muted); cursor: not-allowed; }
```

### 动作徽章

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 24px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--fg);
  font: 600 var(--text-xs)/1 var(--font-body);
  letter-spacing: 0.02em;
  transition: background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.badge:hover { background: var(--surface-hover); border-color: var(--accent); }
.badge:active { background: var(--accent-soft); }
.badge:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.badge-clear { color: var(--action-clear); background: var(--danger-soft); border-color: var(--action-clear); }
.badge-stop { color: var(--action-stop); background: var(--warn-soft); border-color: var(--action-stop); }
.badge-watch { color: var(--action-watch); background: var(--warn-soft); border-color: var(--action-watch); }
.badge-invest { color: var(--action-invest); background: var(--success-soft); border-color: var(--action-invest); }
.badge-replenish { color: var(--action-replenish); background: var(--accent-soft); border-color: var(--action-replenish); }
```

### 表格行

```css
.table-row {
  background: var(--surface);
  border-bottom: 1px solid var(--border-soft);
  color: var(--fg);
  transition: background var(--motion-fast) var(--ease-standard);
}
.table-row:hover { background: var(--surface-hover); }
.table-row:active { background: var(--accent-soft); }
.table-row:focus-visible { outline: none; box-shadow: inset var(--focus-ring); }
```

### 双轨决策脊线

```css
.decision-spine {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr);
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  transition: background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.decision-spine:hover { border-color: var(--accent); background: var(--surface-hover); }
.decision-spine:active { background: var(--accent-soft); }
.decision-spine:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.spine-node { border-radius: var(--radius-pill); background: var(--accent); color: var(--accent-on); }
```

中间 56px 脊线固定承载证据节点，左右两轨不会因文本长度失去关联。

## 7. 动效与交互物理

### 动效哲学

动效只负责确认状态变化，不承担品牌表演。

用户在审核、执行和结果记录时需要知道系统已经收到动作，也需要在并发冲突时立即停止错误预期。

因此大多数反馈在 150—200ms 内完成。

页面进入只做一次低幅度淡入，不使用位移超过 8px 的动画。

### 微反馈

```css
.interactive {
  transition: background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);
}
.interactive:hover { border-color: var(--accent); background: var(--surface-hover); }
.interactive:active { background: var(--accent-soft); }
.interactive:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

### 进场编排

```css
@keyframes enter-calm {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-enter { animation: enter-calm var(--motion-base) var(--ease-standard) both; }
.page-enter:nth-child(2) { animation-delay: 40ms; }
.page-enter:nth-child(3) { animation-delay: 80ms; }
```

### 状态切换

```css
.tab-panel { opacity: 1; transition: opacity var(--motion-fast) var(--ease-standard); }
.tab-panel[hidden] { display: none; opacity: 0; }
.drawer { opacity: 1; visibility: visible; transition: opacity var(--motion-base) var(--ease-standard), visibility var(--motion-base) var(--ease-standard); }
.drawer[aria-hidden="true"] { opacity: 0; visibility: hidden; }
.menu { opacity: 1; transition: opacity var(--motion-fast) var(--ease-standard); }
.menu[hidden] { display: none; opacity: 0; }
```

### 高保真跨页导航

- 已在《页面清单》和页面文档中定义目标的入口，必须使用同目录真实 `.html` 地址完成跳转；不得被通用原型提示脚本 `preventDefault()` 阻断。
- 仅尚无目标页面的演示控件可以停留当前页并显示反馈提示；带显式 `location.href` 的按钮同样不得被通用提示脚本覆盖。
- 联调以用户真实点击后的 URL、页面标题和目标页关键内容为准，不能只用静态链接存在性代替。

### 减少动态效果

```css
@media (prefers-reduced-motion: reduce) {
  .page-enter { animation: none; }
  .interactive, .tab-panel, .drawer, .menu { transition: none; }
}
```

不使用全局 `*` 关闭动画，避免误伤浏览器和辅助技术的必要行为。

## 8. 品牌情感与声音

### 品牌人格

- 冷静：先给事实，再给建议。
- 负责：任何动作都说清对象、依据、责任人和状态。
- 克制：AI 不使用夸张语气，不暗示它替代主管拍板。
- 直接：错误说明原因和恢复动作，不写“发生未知错误”。
- 可追溯：重要文案带批次、期间或规则版本上下文。

### 文案声音

推荐使用“已识别”“待审核”“数据不足”“状态已变化”等可验证表达。

禁止使用“AI 认为这是最佳方案”“绝对应该”“智能预测”等超出固定规则的权威语气。

按钮使用动词加对象，例如“查看建议”“确认禁补”“记录经营结果”。

### 情感化边缘时刻

- 空状态：说明当前批次确无待办，给出返回工作台或切换批次的动作，不使用庆祝插画掩盖事实。
- Loading：优先显示批次和页面骨架，让用户确认加载对象。
- 404/无权限：不泄露目标对象，仅提供返回本人工作台。
- AI 失败：显示固定规则四要素仍可用，不把页面染成错误红色。
- 并发冲突：展示最新操作者、时间和状态，保留用户未提交文字。

### 插画与图形

首版不使用写实 3D 或商品营销插画。

可使用抽象的双轨线、批次节点和轻量数据网格作为背景纹理。

所有功能图标使用统一矢量线性图标，禁止 emoji 充当图标。

### Agent 设计指令

1. 第一屏优先呈现当前批次、待办和固定规则结论。
2. 所有颜色引用 token，并同时用文字或图标表达动作语义。
3. 表格保持紧凑，详情使用 Bento 分区与双轨脊线。
4. AI 区视觉弱于规则区，采购视图不出现敏感经营字段。
5. 低于 1024px 显示电脑访问提示，不压缩成可操作手机页面。

## 9. 设计禁忌

### 高保真统一示例快照

跨页面原型引用同一个“当前批次”或同一个 SPU 时，必须复用以下冻结示例，不得为单页另造一套数值或状态：

| 对象 | 统一示例值 |
| :--- | :--- |
| 当前批次 | `BATCH-20260630-01`；玩具事业部；数据期间 `2026-06-01—2026-06-30`；业务截止日 `2026-06-30`；规则版本 `RULE-V1.0` |
| SPU 515 身份 | 布乐迪忙碌屋益智玩具；趣然天猫旗舰店 / 天猫；责任运营陈雨欣 |
| SPU 515 冻结指标 | 上月净销售额 `86,240 元`；经营准利润率 `-12.8%`；近 7 天品退率未校验；仓内 `3,000 件`、在途 `260 件`、近 14 天销量 `112 件`、日均 `8.0 件`、库存可售 `407.5 天` |
| SPU 515 规则结论 | 小爆款；经营动作清仓；库存动作禁止补货；固定规则依据先于 AI 解释 |
| SPU 515 闭环状态 | 主管已通过；经营动作待执行；采购待确认禁补；AI 已生成 |

主管工作台的“待审核”列表不得把已通过的 SPU 515 继续显示为待审核；如需展示该对象，只能进入最近审核或只读记录。历史追溯页可以展示同一 SPU 的旧批次，但批次 ID、期间和状态必须明确区分，不能冒充当前冻结快照。

- 禁止把 AI 解释做成页面主视觉；固定规则才是决策权威。
- 禁止用单一颜色表达清仓、止损、观察、加投和补货；必须同时有文字与图标。
- 禁止卡片悬停位移；数据密集页面的物理跳动会破坏扫描效率。
- 禁止使用境外字体服务；内网和国内云环境必须保持可用。
- 禁止把缺失指标显示为 0；这会让数据不足看起来像真实经营结果。
- 禁止隐藏批次、业务期间和截止日；旧数据被误当成当前任务会直接导致错误动作。
- 禁止在采购视图出现利润、推广、品退、售后或完整 AI 文本。
- 禁止把审核、经营执行和采购执行压成一个状态；双轨进度必须分别可见。
- 禁止大面积使用动作色；语义色只服务真实状态，不制造营销氛围。
- 禁止使用超过 14px 的常规卡片圆角；过度圆润会削弱经营工具的精密感。
- 禁止使用未经需求确认的趋势图、SKU 视图、广告明细或自动执行入口。
- 禁止用通用“操作失败”替代可恢复反馈；必须说明错误来源和下一步。
