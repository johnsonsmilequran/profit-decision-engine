# Design System Inspired by 趣然 AI 商品经营与利润决策助手

> Category: Professional & Corporate
> 一套把周度经营风险压缩成“风险、依据、行动”清晰路径的浅色企业数据设计系统。

## 1. 视觉主题与氛围

### 1.1 核心隐喻：晨间经营指挥室

想象每周一早晨，运营、主管与采购走进同一间安静的经营指挥室。
窗外不是科幻数据流，而是刚刚亮起的自然日光。
桌面铺着一张经过整理的白色经营地图。
每一个 SPU 都是地图上的坐标，每条风险都沿着一根细长色轨指向明确行动。
人不需要在散落表格之间来回拼接事实，也不需要猜测 AI 到底改了什么。
系统把喧闹的数据压低，把固定规则和待办动作抬到视线中央。
这种空间感不是“豪华驾驶舱”，而是有秩序的业务作战室。
它让数字保持锋利，让判断保持克制，让跨部门协作保持同一节拍。
浅灰背景像吸收杂音的桌面，白色表面像一页页可核对的工作纸。
深海军蓝文字提供确定感，铉蓝只在真正可操作的地方出现。
风险红、观察琥珀和完成绿只为业务含义服务，不承担装饰职责。

### 1.2 用户情绪

第一情绪是冷静掌控：运营能够迅速知道“现在最该处理什么”。
第二情绪是可信：主管能沿指标、阈值、规则版本复核结论，而非相信黑盒。
第三情绪是协同压力：待处理风险清楚存在，但不会用满屏红色制造恐慌。
第四情绪是闭环感：经营动作与采购动作并排展示，任何一条断点都不会被总状态遮住。
这些情绪对产品至关重要，因为真实损失来自发现滞后和部门动作不同步。
设计必须让用户愿意每天停留，也必须让风险在几秒内被看见。

### 1.3 为什么选择浅色

这是白天长时间使用的 PC 企业工具，不是夜间值守大屏。
用户需要持续读取中文名称、金额、百分比、日期、阈值和长表格。
浅色模式让细小数据拥有更稳定的边缘清晰度，也更接近原始经营表的阅读习惯。
白色表面与浅灰背景形成温和层级，避免依赖厚重边框切割每个信息块。
MVP 只提供浅色模式，减少一套未经业务验证的视觉维护面。

### 1.4 风格定位

骨架借鉴 Linear 的克制与即时反馈，但不采用面向开发者工具的暗色微光。
信息密度借鉴成熟企业数据后台，但避免“表格即全部”的陈旧感。
留白纪律借鉴 Dieter Rams 的少即是多，但不牺牲经营证据的完整呈现。
最终坐标是 Professional & Corporate：稳健、精确、可追溯、适合内部长期工作。
设计不试图把 AI 视觉化为魔法；AI 是次级解释层，固定规则始终拥有主视觉权威。

### 1.5 设计签名：行动罗盘

“行动罗盘”由优先级色轨、规则依据筹码、经营动作轨和采购动作轨组成。
色轨位于建议卡或表格首列，像地图方向标，先告诉用户风险方向。
依据筹码紧邻动作，不允许把触发阈值藏进深层弹窗。
双动作轨并排展示，使“运营已止损、采购仍待禁补”一眼可见。
截图离开产品标识后，仍能通过这组结构认出它是一款经营利润决策工具。

### 1.6 色彩速览

| 色彩 | Hex | 角色 |
| :--- | :--- | :--- |
| 雾白底 | `#F4F7FB` | 全局工作区，降低长时间阅读眩光 |
| 纸白面 | `#FFFFFF` | 卡片、表格、弹窗与输入区域 |
| 深海军 | `#132238` | 主标题、关键数字与固定规则结论 |
| 铉蓝 | `#075EAD` | 主操作、焦点与当前导航 |
| 稳定绿 | `#197343` | 成功、已完成与合法通过 |
| 证据琥珀 | `#8A4B08` | 数据降级、观察与待确认 |
| 风险红 | `#B42318` | 清仓、止损、错误与不可继续 |

### 1.7 参考先例

- Linear：汲取低噪声导航、紧凑信息和色彩响应，不复制暗色主题。
- IBM Carbon：汲取企业数据语义、状态一致性和可访问性纪律。
- Ant Design：汲取中文企业表单与密集表格的成熟交互经验。
- Stripe Dashboard：汲取指标证据、状态与操作之间的视觉层级。

## 2. 色彩美学

### 2.1 色彩哲学

中性色负责承载事实，铉蓝负责指向操作，语义色负责指出业务后果。

`#075EAD` 不是装饰性科技蓝，而是指挥室中的唯一交互信号。
它在白色上足够清晰，又不会像高饱和电光蓝那样抢走风险结论的注意力。

`#132238` 带有轻微蓝相，比纯黑更适合冷静的企业数据环境。

`#465870` 保持次级信息可读，避免用浅灰把口径、周期和来源降成不可见脚注。
三种语义色均选择较深色阶，因此既可作图标和轨道，也可直接承载小号文本。

### 2.2 强调色纪律

每屏最多出现 2 处高显著度 `--accent`：通常是一处当前上下文和一处主 CTA。
链接、悬停边框和焦点环都计入强调色使用量。
中性色占画面 70%—90%，强调色占 5%—10%，语义色占 0%—5%。
同一区域存在风险色时，主操作蓝必须退到按钮或焦点，不与风险轨争夺面积。
禁止把所有可点击文字染蓝；次级操作使用主文字或描边样式。

### 2.3 Surface 色板

| Token | Hex/值 | 设计理由 |
| :--- | :--- | :--- |
| `--bg` | `#F4F7FB` | 形成低眩光工作台底面 |
| `--surface` | `#FFFFFF` | 保持数据内容像工作纸一样清晰 |
| `--surface-warm` | alias `--surface` | MVP 不制造无业务含义的暖色分层 |
| `--surface-raised` | alias `--surface` | 抬升态依靠色彩响应与轻投影，不换色 |
| `--surface-overlay` | alias `--surface` | 弹窗仍保持同一纸白语言 |
| 交互 Surface hover | `#F1F7FD` | 仅作色彩响应的计算结果，不新增 Token |
| `--border` | `#CBD5E1` | 提供克制的结构边界 |
| `--border-soft` | alias `--border` | 避免相近灰色无止境扩张 |

### 2.4 Data 与语义色板

| Token | Hex/计算值 | 情感与使命 |
| :--- | :--- | :--- |
| `--accent` | `#075EAD` | 明确“可以行动” |
| `--accent-hover` | 约 `#06569F` | 悬停时加深，保持色彩响应 |
| `--accent-active` | 约 `#055092` | 按下时进一步收紧 |
| `--success` | `#197343` | 表示真实完成，而非一般推荐 |
| `--warn` | `#8A4B08` | 表示观察、降级与需核对证据 |
| `--danger` | `#B42318` | 表示止损、清仓和阻断性错误 |

### 2.5 Text 色板与对比度

| 文本 | 前景 | 主要背景 | 对比度 |
| :--- | :--- | :--- | :--- |
| 主文字 `--fg` | `#132238` | `#FFFFFF` | `15.99:1` |
| 主文字 `--fg` | `#132238` | `#F4F7FB` | `14.88:1` |
| 次级 `--muted` | `#465870` | `#FFFFFF` | `7.27:1` |
| 次级 `--muted` | `#465870` | `#F4F7FB` | `6.76:1` |
| 按钮 `--accent-on` | `#FFFFFF` | `#075EAD` | `6.53:1` |

`--fg-2` alias 到 `--fg`，`--meta` alias 到 `--muted`，因此对应配对同样满足 WCAG 2.2 AA。
成功、警告、危险文本在白底上的对比度分别为 `5.87:1`、`6.79:1`、`6.57:1`。
所有普通字号文本配对均不低于 `4.5:1`。
状态浅底使用 `color-mix()` 生成，文字仍使用原深色语义 token。
MVP 不提供暗色主题，因此不存在暗色 elevation 覆盖块。

## 3. 排版与字体

### 3.1 字体哲学

字体系统完全依赖本地系统栈，确保中国大陆网络环境和企业内网稳定可达。
中文正文优先苹方、微软雅黑和 Noto Sans CJK SC；不同系统都保持中性、清楚的无衬线气质。
Display 与 Body 使用同一栈，层级来自字号、字重和间距，而非额外字体下载。
数字与批次 ID 使用系统等宽栈，并启用 `font-variant-numeric: tabular-nums`。
等宽数字让金额、利润率与库存天数纵向对齐，减少扫表误读。

### 3.2 字体栈

Font labels for catalog extraction:

Display: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif
Body: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif
Mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace

### 3.3 字号梯度

| Token | 大小 | 用途 |
| :--- | :--- | :--- |
| `--text-xs` | `12px` | 元信息、周期、表格辅助标记 |
| `--text-sm` | `13px` | 标签、按钮、密集表格正文 |
| `--text-base` | `14px` | 通用正文与表单输入 |
| `--text-lg` | `16px` | 卡片标题与关键段落 |
| `--text-xl` | `20px` | 区块标题 |
| `--text-2xl` | `24px` | 页面标题 |
| `--text-3xl` | `32px` | 工作台关键指标 |
| `--text-4xl` | `40px` | 登录页品牌标题或单一主指标 |

这组紧凑梯度适合 1440px 企业工作台，不通过超大标题浪费首屏信息空间。

### 3.4 Letter-spacing 硬规则

| 文本类型 | 精确规则 |
| :--- | :--- |
| ALL CAPS | `letter-spacing: 0.06em`，无例外 |
| Display 48px+ | `letter-spacing: -0.025em` |
| 标题 32px+ | `letter-spacing: -0.015em` |
| 小文本 11—13px | `letter-spacing: 0.015em` |
| UI 标签/按钮 | `letter-spacing: 0.02em` |
| 正文 | `letter-spacing: 0` |

### 3.5 行高与数字

正文行高 `1.6`，保障中文解释和审核备注不拥挤。
标题行高 `1.25`，让页面层级紧凑而不压迫。
表格单行使用 `1.4`，多行证据单元格使用正文行高。
金额、比率、日期和版本号必须使用等宽数字特性，负号与小数点不得视觉漂移。

## 4. 间距体系

### 4.1 间距哲学

4px 是本系统的最小节拍，像规则引擎稳定重复的拍点。
小间距用于标签与图标，中间距用于控件，较大间距用于认知分组。
任何间距都必须能解释为 4px 的倍数，避免页面之间出现不受控的“差不多”。

### 4.2 基准间距

| Token | 值 | 使用场景 |
| :--- | :--- | :--- |
| `--space-1` | `4px` | 图标微距、状态点 |
| `--space-2` | `8px` | 标签内距、紧密元素 |
| `--space-3` | `12px` | 控件横向间距 |
| `--space-4` | `16px` | 卡片基础内距 |
| `--space-5` | `20px` | 表单组间距 |
| `--space-6` | `24px` | 卡片舒展内距 |
| `--space-8` | `32px` | 页面区块间距 |
| `--space-12` | `48px` | 大区块分隔 |

### 4.3 Section rhythm

Desktop 使用 `48px`，适合 1440px 主画布的工作台呼吸。
Tablet 使用 `32px`，在受限宽度下保持任务连续。
Phone 使用 `24px`，仅支持登录与阅读提示，不承诺业务操作布局。

## 5. 布局与空间构成

### 5.1 布局哲学

Bento Grid 不是装饰性的卡片拼贴，而是经营信息的认知分仓。
批次、风险、待办和动态各自进入独立单元，用户无需在不同页面拼接第一判断。
每个格子只回答一个问题：发生了什么、为什么、谁要做、做到哪一步。
复杂详情则从总览格子进入独立页面，防止工作台变成无限堆叠的信息墙。

### 5.2 全站框架

左侧导航固定宽度建议 `232px`，为四个一级入口保留稳定位置。
顶部上下文栏建议高度 `56px`，持续显示角色、批次和钉钉身份。
主内容容器最大宽度为 `1440px`，同时允许密集表格在内容区内横向滚动。
桌面 gutter 为 `32px`，在最低 1280px 宽度下收敛为 `24px`。
主内容不使用居中窄文章布局；经营表格必须拥有足够横向空间。

### 5.3 Bento Grid

1440px 主画布采用 12 列网格，列间距 `16px`。
工作台 KPI 通常占 3 列，高优先级列表占 8 列，最近动态占 4 列。
批次摘要可占 12 列，避免日期和规则版本被压缩。
建议详情首屏采用 8+4 分栏：规则证据为主，角色操作为辅。
每个格子圆角统一使用 `--radius-lg`，不通过不同圆角制造层级。

### 5.4 深度与层级

全局底面不加阴影，内容表面使用纸白和柔和边界区分。
抬升卡片只使用 `--elev-raised`，弹窗使用 `--elev-float`。
重要性主要由位置、尺寸、字重和色轨表达，不靠厚重阴影。
悬停采用边框和背景色响应，不使用 `translateY` 制造漂浮。

### 5.5 响应式行为

`>=1280px`：完整左侧导航、12 列网格、密集表格与固定操作区。

`1024px—1279px`：可阅读但显示“建议使用更宽屏幕”，表格保留横向滚动。

`<1024px`：登录页和无权限页正常呈现；业务页只给出设备提示，不提供状态变更操作。
窄屏绝不通过缩小到 11px 以下来容纳金额和阈值。
表格关键列包括色轨、SPU、主动作和状态，应固定在水平滚动起点。

### 5.6 空间中的行动罗盘

优先级色轨固定为 `4px`，既醒目又不吞噬数据宽度。
依据筹码可换行，但经营动作与采购动作状态必须保持同一视觉组。
双动作不同步时，空白不应被总览“完成”状态填平，而要明确暴露待办。

## 6. 组件设计

### 6.1 组件哲学与统一交互语言

组件首先是业务语义容器，其次才是视觉对象。
按钮表示会发生什么，卡片表示一组完整认知，输入框表示当前需要用户补足的事实。
徽章不能只靠颜色传达状态，必须同时有文字。
行动罗盘必须把风险、依据和两条动作轨放在一个可扫读结构里。
全站统一采用“色彩响应型”交互。
Hover 只改变边框、背景或文字色，不增加阴影，不发生物理位移。
Active 通过更深颜色和更收紧的背景表达按下状态。
Focus-visible 使用同一 `--focus-ring`，为键盘用户保留清晰导航证据。
Disabled 保持可读，并在相邻帮助文本中解释状态或权限原因。

### 6.2 按钮 Button

主按钮只用于每个任务区唯一的推进动作，例如“导入并处理”或“确认通过”。

8px 圆角兼顾企业克制和触控可达性，按钮高度至少 36px。

```css
.button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-on);
  font: 600 var(--text-sm) / var(--leading-tight) var(--font-body);
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);
}
.button:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
.button:active {
  background: var(--accent-active);
  border-color: var(--accent-active);
}
.button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.button:disabled {
  background: var(--surface);
  border-color: var(--border);
  color: var(--muted);
  cursor: not-allowed;
}
.button--secondary {
  background: var(--surface);
  color: var(--fg);
  border-color: var(--border);
}
.button--secondary:hover {
  background: var(--bg);
  border-color: var(--accent);
  color: var(--accent);
}
.button--secondary:active {
  background: color-mix(in oklab, var(--accent), transparent 92%);
  border-color: var(--accent-active);
  color: var(--accent-active);
}
.button--secondary:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

### 6.3 数据卡片 Data Card

卡片用于批次摘要、KPI 和规则证据，不作为每个小字段的外框。
色彩响应只在可点击卡片启用；纯展示卡没有虚假的悬停暗示。

```css
.data-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--elev-flat);
  transition: background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);
}
.data-card[tabindex]:hover {
  background: color-mix(in oklab, var(--accent), var(--surface) 97%);
  border-color: var(--accent);
}
.data-card[tabindex]:active {
  background: color-mix(in oklab, var(--accent), var(--surface) 93%);
  border-color: var(--accent-active);
}
.data-card[tabindex]:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.data-card__label {
  color: var(--muted);
  font-size: var(--text-sm);
}
.data-card__value {
  color: var(--fg);
  font: 650 var(--text-3xl) / var(--leading-tight) var(--font-display);
  font-variant-numeric: tabular-nums;
}
```

### 6.4 输入框 Field

输入框在静态态保持中性，聚焦后才使用铉蓝，避免整页蓝色边框。
错误态使用危险色并配文字原因，不能只靠红框。

```css
.field {
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--fg);
  font: 400 var(--text-base) / var(--leading-body) var(--font-body);
  transition: background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);
}
.field:hover {
  border-color: var(--accent);
}
.field:active {
  border-color: var(--accent-active);
}
.field:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}
.field[aria-invalid="true"] {
  border-color: var(--danger);
}
.field[aria-invalid="true"]:hover {
  background: color-mix(in oklab, var(--danger), var(--surface) 97%);
  border-color: var(--danger);
}
.field[aria-invalid="true"]:active {
  background: color-mix(in oklab, var(--danger), var(--surface) 93%);
  border-color: var(--danger);
}
.field[aria-invalid="true"]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--danger), transparent 70%);
}
.field:disabled {
  background: var(--bg);
  color: var(--muted);
  cursor: not-allowed;
}
```

### 6.5 状态徽章 Badge

徽章由文字和浅底共同表达状态，不允许只有一个彩色圆点。
可交互筛选徽章使用 `role="button"`，只读状态不制造点击暗示。

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 24px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-pill);
  background: var(--bg);
  color: var(--fg);
  font: 600 var(--text-xs) / var(--leading-tight) var(--font-body);
  letter-spacing: 0.015em;
  transition: background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);
}
.badge--success {
  background: color-mix(in oklab, var(--success), var(--surface) 92%);
  border-color: color-mix(in oklab, var(--success), var(--surface) 68%);
  color: var(--success);
}
.badge--warn {
  background: color-mix(in oklab, var(--warn), var(--surface) 92%);
  border-color: color-mix(in oklab, var(--warn), var(--surface) 68%);
  color: var(--warn);
}
.badge--danger {
  background: color-mix(in oklab, var(--danger), var(--surface) 92%);
  border-color: color-mix(in oklab, var(--danger), var(--surface) 68%);
  color: var(--danger);
}
.badge[role="button"]:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.badge[role="button"]:active {
  background: color-mix(in oklab, var(--accent), var(--surface) 90%);
  border-color: var(--accent-active);
  color: var(--accent-active);
}
.badge[role="button"]:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

### 6.6 行动罗盘 Action Compass

行动罗盘是产品签名组件，也是建议列表和详情首屏的共同语法。
色轨表达业务优先级，内容区表达证据，双轨区表达跨部门闭环。
组件不允许 AI 文案占据第一视觉层级。

```css
.action-compass {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.42fr);
  gap: var(--space-4);
  padding: var(--space-5);
  padding-inline-start: var(--space-6);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--fg);
  overflow: hidden;
  transition: background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);
}
.action-compass::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: var(--space-1);
  background: var(--danger);
}
.action-compass:hover {
  background: color-mix(in oklab, var(--accent), var(--surface) 97%);
  border-color: var(--accent);
}
.action-compass:active {
  background: color-mix(in oklab, var(--accent), var(--surface) 93%);
  border-color: var(--accent-active);
}
.action-compass:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.action-compass--observe::before {
  background: var(--warn);
}
.action-compass--invest::before {
  background: var(--accent);
}
.action-compass--complete::before {
  background: var(--success);
}
.action-compass__evidence {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.action-compass__tracks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  align-content: start;
}
.action-compass__track {
  padding: var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg);
}
```

### 6.7 表格与密集数据

表头固定，关键列固定，行高建议 48px；多行依据可扩展到 64px。
数字列右对齐并启用 tabular numbers，状态列左对齐以便扫读文字。
表格行 hover 只改变底色，不能让行抬升或改变高度。
拒绝行、降级字段与普通警告必须分区，不只用不同颜色混在一张表。
空状态、加载失败和筛选无结果必须使用不同标题与恢复动作。

### 6.8 弹窗与固定操作区

审核弹窗必须复述 SPU、主动作和补货/禁补影响，避免用户只看按钮颜色确认。
驳回输入为空时，提交按钮禁用并就地说明必填原因。
固定操作区使用纸白背景和顶边轻投影，不遮挡时间线与表格最后一行。
版本冲突使用页内强提示，不允许用短暂 Toast 替代刷新入口。

## 7. 动效与交互物理

### 7.1 动效哲学

动效是状态变化的证据，不是娱乐性的装饰。
系统面对的是审核、执行、数据降级和并发冲突，每次变化都应短、稳、可解释。
统一色彩响应意味着元素不跳动、不浮起，只在原位改变色与边界。
快速反馈使用 `--motion-fast`，层级切换使用 `--motion-base`。
所有缓动使用 `--ease-standard`，禁止页面自行发明弹簧或回弹。

### 7.2 微反馈

```css
.button,
.field,
.data-card[tabindex],
.badge[role="button"],
.action-compass {
  transition-duration: var(--motion-fast);
  transition-timing-function: var(--ease-standard);
}
.button:active {
  background-color: var(--accent-active);
}
.field:focus-visible {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}
.data-card[tabindex]:hover,
.action-compass:hover {
  border-color: var(--accent);
}
```

### 7.3 页面进场

页面进场只用于建立阅读顺序：标题、摘要、主体依次显现。
stagger 最多三层，避免长列表逐行动画拖慢信息到达。

```css
@keyframes content-enter {
  from {
    opacity: 0;
    filter: blur(2px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}
.page-enter {
  animation: content-enter var(--motion-base) var(--ease-standard) both;
}
.page-enter--summary {
  animation-delay: var(--motion-fast);
}
.page-enter--content {
  animation-delay: var(--motion-base);
}
```

### 7.4 状态切换

Tab 通过文字色、底边和内容透明度变化表达当前上下文。
弹窗通过透明度和轻微模糊展开，不使用大幅缩放。
下拉菜单使用透明度和可见性切换，不改变周围布局。

```css
.tab-panel {
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--motion-base) var(--ease-standard), visibility var(--motion-base) var(--ease-standard);
}
.tab-panel[data-active="true"] {
  opacity: 1;
  visibility: visible;
}
.dialog-surface,
.dropdown-menu {
  opacity: 0;
  visibility: hidden;
  filter: blur(2px);
  transition: opacity var(--motion-base) var(--ease-standard), visibility var(--motion-base) var(--ease-standard), filter var(--motion-base) var(--ease-standard);
}
.dialog-surface[data-open="true"],
.dropdown-menu[data-open="true"] {
  opacity: 1;
  visibility: visible;
  filter: blur(0);
}
```

### 7.5 Reduced motion

降低动效偏好下保留颜色和焦点反馈，只移除进场与模糊过渡。
禁止使用全局 `*` 覆盖，因为它会意外破坏组件库的必要状态反馈。

```css
@media (prefers-reduced-motion: reduce) {
  .page-enter,
  .page-enter--summary,
  .page-enter--content {
    animation: none;
  }
  .dialog-surface,
  .dropdown-menu,
  .tab-panel {
    transition-duration: 0ms;
    filter: none;
  }
  .button,
  .field,
  .data-card[tabindex],
  .badge[role="button"],
  .action-compass {
    transition-duration: 0ms;
  }
}
```

## 8. 品牌情感与声音

### 8.1 品牌灵魂

**冷静**：先给事实和规则，不用夸张语言放大风险。
**可信**：每个结论都能回到批次、周期、阈值和版本。
**果断**：动作标签用动词，明确谁做、何时做、做到哪一步。
**协同**：经营与采购动作并列，不把任一角色藏在总览之后。
**克制**：AI 解释只增强理解，不冒充规则裁判。

### 8.2 文案声音

使用“发现—依据—行动”句式，例如“利润率低于 0%，建议清仓并禁止补货”。
错误说明必须告诉用户影响范围，例如“品退周期未校验，本次不用于观察或加投判断”。
避免“智能赋能”“一键洞察”等无法验证的空洞表达。
成功反馈说明真实结果，例如“审核已通过，两条动作已分别进入待执行”。
人工确认不能写成外部系统回执，例如必须写“已确认禁补”而非“采购系统已停单”。

### 8.3 边缘时刻

空状态：用简洁线性经营坐标图形，说明当前没有批次、没有待办或筛选无结果。
Loading：使用灰阶骨架和明确处理阶段，不显示无意义旋转超过必要时间。
失败：说明是文件、批次、AI 还是网络失败，并给出唯一可恢复动作。

404/无权限：使用中性门禁图形，不展示受限对象名称、数量或摘要。
AI 失败：结构化四要素保持完整，仅用次级警告说明增强解释不可用。

### 8.4 插画与装饰

只使用扁平、线性、低饱和的坐标、轨道、表格纸张和方向标元素。
禁止人物 3D 卡通、机器人头像和漂浮币图，因为它们削弱内部决策工具的可信度。
装饰图形不得占据经营数据首屏的主要面积。

### 8.5 Agent 设计指令

1. 先呈现固定规则结论，再呈现 AI 增强解释。
2. 每个建议必须保留行动罗盘：优先级色轨、依据筹码和双动作轨。
3. 只使用 `tokens.css` 中的变量，不在组件内硬编码颜色、阴影、动效或字体。
4. 所有可交互元素实现 hover、active、focus-visible 和明确 disabled 原因。
5. 为数据空、筛选空、加载、失败、无权限和 version 冲突分别设计状态。

## 9. 设计禁忌

- 禁止使用暗色、霓虹、HUD 网格或粒子背景，因为本产品是白天长时间使用的企业工作台。
- 禁止把 AI 文案放在固定规则结论之前，因为 AI 不拥有动作裁决权。
- 禁止用红色装饰导航、品牌或普通按钮，因为风险红只服务于清仓、止损和错误。
- 禁止在同一交互中混用阴影提升和物理位移，因为全站已选择色彩响应语言。
- 禁止使用超过 `12px` 的普通卡片圆角，因为过度柔软会削弱密集经营数据的精确感。
- 禁止仅用颜色表达审核或动作状态，因为色觉差异用户仍需读取文字标签。
- 禁止把次级文字降到低于 WCAG 2.2 AA 的对比度，因为口径、周期和来源都是决策证据。
- 禁止从境外 CDN 加载字体、图标或运行依赖，因为企业内网和中国大陆可达性必须稳定。
- 禁止用无限滚动承载行动清单和追溯记录，因为用户需要稳定页码和可恢复上下文。
- 禁止让表格横向压缩字号到 `11px` 以下，因为金额、阈值与状态语义不能被牺牲。
- 禁止把驳回、执行或结果提交只反馈为 Toast，因为这些状态变化需要持久、可追溯的页面证据。
- 禁止在采购视图中用模糊或遮挡代替字段移除，因为受限数据应由服务端完全不返回。

## 10. 生产实现同步（2026-08-04）

- 全站采用 `border-box` 盒模型；固定 232px 侧栏后，主布局宽度严格使用 `calc(100% - 232px)` 并允许收缩，确保 1280px 最低支持宽度与 1440px 主画布下，内容区内边距、四列指标卡和页头操作不会造成横向溢出或右侧裁切。
- 生产壳层同步为 MVP 浅色模式：白色固定侧栏、浅灰内容背景、56px 身份上下文顶栏、底部“同源状态”说明；顶栏从真实工作台读模型显示当前批次编号与清单可用状态，保留服务端角色裁剪后的菜单与真实退出流程。
- 登录与无权限页同步高保真双栏信息架构，统一使用浅蓝安全视觉、白色操作卡与克制阴影；认证和权限接口、路由及数据最小化边界不变。
