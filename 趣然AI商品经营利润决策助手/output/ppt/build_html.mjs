import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.dirname(fileURLToPath(import.meta.url));

const slides = [
  {
    type: "cover",
    eyebrow: "趣然电商 · 玩具事业部 · V0",
    title: "AI 商品经营<br>与利润决策助手",
    lead: "用一张行动清单，统一利润、推广与补货决策",
    tag: "10—20 个真实 SPU｜每周生成｜轻闭环",
  },
  {
    type: "cards3",
    eyebrow: "EXECUTIVE SUMMARY",
    title: "一张清单，统一利润、推广与补货动作",
    lead: "每周一导入 SPU 经营表：固定规则生成主动作，AI 解释和排序，人工审核后执行。",
    cards: [
      ["01", "统一利润标准", "分类、阈值和动作优先级都来自固定规则。"],
      ["02", "阻断继续补货", "止损或清仓强制同步“禁止补货”。"],
      ["03", "保留全程追溯", "批次、期间、规则、审核、执行和结果均留痕。"],
    ],
  },
  {
    type: "flow4",
    eyebrow: "CORE PAIN",
    title: "515 案例：止损晚了约 2 个月，补货却没有停",
    lead: "真正的损失来自发现滞后和跨部门动作断裂，而不只是一个利润指标没被看到。",
    steps: [
      ["01", "亏损推广", "忙碌屋前期以亏损方式推广"],
      ["02", "月报后发现", "财务月报到达后才看到亏损较大"],
      ["03", "运营止损", "减少推广费用，但未同步采购"],
      ["04", "采购仍补货", "继续按原销量补货，形成滞销"],
    ],
    alert: "断点：推广止损没有自动变成采购侧的禁止补货结论",
  },
  {
    type: "metrics",
    eyebrow: "VALUE EVIDENCE",
    title: "一次决策断点，已造成真实经营损失",
    lead: "首版价值先用已发生、可核验的事实表达，不推演尚未确认的年度收益。",
    metrics: [
      ["≈ 3,000", "件滞销", "库存动作未随推广止损同步"],
      ["≈ 10 万", "元库存占用", "资金被滞销库存持续占用"],
      ["≈ 6 万", "元利润损失", "问题发现延迟约 2 个月"],
    ],
  },
  {
    type: "split",
    eyebrow: "PRODUCT DESIGN 01",
    title: "固定规则先判动作，AI 只解释和排序",
    lead: "确定性经营结论与生成式表达分开，避免模型漂移改变业务规则。",
    left: {
      kicker: "RULE ENGINE",
      title: "固定规则决定什么",
      items: ["商品类型", "利润与品退阈值", "主动作优先级", "补货冲突规则"],
      footer: "清仓 > 止损 > 观察 > 加投 > 维持",
    },
    right: {
      kicker: "AI ASSIST",
      title: "AI 负责什么",
      items: ["解释发现的问题", "提取关键依据", "解释排序原因", "给出不覆盖主动作的优化提示"],
      footer: "不得修改规则，不得猜测缺失数据",
    },
  },
  {
    type: "flow4",
    eyebrow: "PRODUCT DESIGN 02",
    title: "四段轻闭环，让止损同步到采购",
    lead: "同一条建议从生成到结果均保留状态；止损或清仓时，采购侧同步看到“禁止补货”。",
    steps: [
      ["01", "导入与校验", "每周一导入 SPU 经营表"],
      ["02", "规则与解释", "固定规则判动作，AI 生成说明"],
      ["03", "审核与分派", "运营主管审核，按动作分配角色"],
      ["04", "执行与结果", "运营/采购更新执行和结果状态"],
    ],
    alert: "一批数据只生成一份清单；周内只更新状态，不重复生成建议",
  },
  {
    type: "grid4",
    eyebrow: "PRODUCT DESIGN 03",
    title: "每条建议都要写清对象、问题、依据和动作",
    lead: "行动建议必须可审核、可执行、可追溯，而不是只显示一个“风险”标签。",
    cards: [
      ["01", "具体对象", "链接/SPU ID、名称、店铺和责任运营"],
      ["02", "发现的问题", "明确需要处理的经营异常"],
      ["03", "关键依据", "数据周期、关键值、阈值与对比关系"],
      ["04", "推荐动作", "对应角色可以直接执行的动作"],
    ],
    example: "示例｜SPU 515：上月经营准利润率低于止损线 → 减少/停止整体推广，同时禁止补货",
  },
  {
    type: "split",
    eyebrow: "TECHNICAL SOLUTION 01",
    title: "SPU 是唯一决策粒度；数据不足就降级，不猜测",
    lead: "数据边界决定建议边界：缺少关键字段时宁可不生成，也不让 AI 补齐事实。",
    left: {
      kicker: "INPUT",
      title: "首版读取的数据",
      items: ["SPU 身份与上架日期", "净销售额与销量", "经营准利润率与推广费用", "品退；条件库存与近 14 天销量"],
      footer: "上一个完整自然月：2026-06-01 至 2026-06-30",
    },
    right: {
      kicker: "DEGRADE SAFELY",
      title: "数据异常如何处理",
      items: ["日期错误：不分类", "库存缺失：不生成补货", "品退周期未核验：不单独触发", "LiteLLM 不可用：保留规则结论"],
      footer: "不读取 SKU，不生成明细广告动作",
    },
  },
  {
    type: "cards3",
    eyebrow: "TECHNICAL SOLUTION 02",
    title: "权限、追溯与 LiteLLM 边界保证可控",
    lead: "首版把数据可见范围、规则证据和模型接入边界同时固定下来。",
    cards: [
      ["01", "角色权限", "运营和主管看完整信息；采购只看补货结论及必要依据。"],
      ["02", "规则与数据溯源", "建议保留批次、期间、规则、原始关键值和状态变化。"],
      ["03", "系统级模型配置", "LiteLLM 密钥由运维部署和轮换，普通用户不可见。"],
    ],
  },
  {
    type: "timeline3",
    eyebrow: "ROADMAP",
    title: "先跑通 10—20 个真实 SPU，再补数据扩能力",
    lead: "能力扩展由真实数据可得性决定；首版不提前承诺评价、广告明细或 SKU 能力。",
    stages: [
      ["NOW", "V0 试点", "周导入｜固定规则｜行动清单｜轻闭环"],
      ["NEXT", "补齐关键数据", "仓内/在途｜近 14 天销量｜可信近 7 天品退"],
      ["LATER", "候选扩展", "评价/退款原因｜广告明细｜系统写回｜SKU"],
    ],
  },
  {
    type: "checklist",
    eyebrow: "MVP ACCEPTANCE",
    title: "第一版完成标准：发现至少 3 个真实问题，并且建议可执行",
    lead: "V0 以真实业务评审通过为准，不以页面数量或模型文案数量为准。",
    items: [
      ["01", "真实范围", "玩具事业部 10—20 个真实 SPU"],
      ["02", "真实发现", "至少识别 3 个由数据触发的经营问题"],
      ["03", "可执行建议", "对象、问题、依据、动作完整，且能追溯固定规则"],
      ["04", "轻闭环走通", "审核、执行、结果和备注均可记录"],
    ],
    close: "完成，不等于“有一张看板”；完成，等于经营动作可以被一致地判断、审核和执行。",
  },
];

const css = `
:root {
  --bg:#FFFFFF;
  --ink:#000000;
  --muted:#5A6470;
  --panel:#EDEDED;
  --panel-soft:#F6F7F8;
  --rule:#B8BCC4;
  --accent:#6DCBF4;
  --accent-strong:#3D8DFF;
  --success:#169B62;
  --danger:#D64545;
  --warning:#D89A20;
  --font:"Helvetica Neue","PingFang SC","Microsoft YaHei",Arial,sans-serif;
  --radius-sm:8px;
  --radius-md:16px;
  --radius-lg:28px;
  --shadow:0 20px 60px rgba(0,0,0,.10);
}
*{box-sizing:border-box}
html,body{width:100%;height:100%;margin:0;background:var(--panel);overflow:hidden;font-family:var(--font);color:var(--ink)}
.viewport{position:fixed;inset:0;display:grid;place-items:center}
.stage{position:absolute;width:1920px;height:1080px;background:var(--bg);transform-origin:center center;overflow:hidden;box-shadow:var(--shadow)}
.inner{height:100%;padding:66px 72px 58px;display:flex;flex-direction:column}
.eyebrow{font-size:20px;letter-spacing:.16em;font-weight:700;color:var(--accent-strong);text-transform:uppercase}
h1{font-size:66px;line-height:1.08;letter-spacing:-.035em;margin:18px 0 14px;max-width:1700px}
.lead{font-size:27px;line-height:1.5;color:var(--muted);max-width:1500px;margin:0}
.content{flex:1;display:flex;align-items:stretch;margin-top:44px;min-height:0}
.footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--rule);padding-top:18px;margin-top:22px;font-size:18px;color:var(--muted)}
.footer strong{color:var(--ink)}
.page-no{font-variant-numeric:tabular-nums}
.nav{position:fixed;right:20px;bottom:18px;z-index:9;display:flex;gap:8px}
.nav a{width:44px;height:34px;border:1px solid var(--rule);border-radius:var(--radius-sm);display:grid;place-items:center;text-decoration:none;color:var(--ink);background:var(--bg);font-size:18px}
.cover .inner{padding-top:76px}
.cover h1{font-size:112px;line-height:1.02;max-width:1280px;margin-top:auto;margin-bottom:34px}
.cover .lead{font-size:34px;max-width:1050px;color:var(--ink)}
.cover-tag{margin-top:46px;width:max-content;background:var(--accent);padding:16px 22px;border-radius:var(--radius-sm);font-size:22px;font-weight:700}
.cover-grid{position:absolute;right:72px;top:74px;width:500px;height:250px;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(3,1fr);border-left:1px solid var(--rule);border-top:1px solid var(--rule)}
.cover-grid span{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.cover-grid .on{background:var(--accent)}
.cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;width:100%}
.card{background:var(--panel-soft);border-top:8px solid var(--accent);border-radius:0 0 var(--radius-md) var(--radius-md);padding:34px;display:flex;flex-direction:column;min-height:360px}
.card .num{font-size:19px;letter-spacing:.14em;color:var(--accent-strong);font-weight:800}
.card h2{font-size:38px;line-height:1.18;margin:58px 0 20px}
.card p{font-size:24px;line-height:1.5;margin:0;color:var(--muted)}
.flow{width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:22px;align-content:center}
.step{position:relative;border:1px solid var(--rule);border-radius:var(--radius-md);padding:28px;min-height:250px;background:var(--bg)}
.step:not(:last-child)::after{content:"→";position:absolute;right:-24px;top:96px;z-index:2;width:26px;height:44px;display:grid;place-items:center;background:var(--bg);font-size:28px;color:var(--accent-strong)}
.step .num{font-size:18px;color:var(--accent-strong);font-weight:800;letter-spacing:.12em}
.step h2{font-size:34px;margin:42px 0 16px}
.step p{font-size:21px;color:var(--muted);line-height:1.45;margin:0}
.alert{grid-column:1/-1;background:var(--accent);padding:18px 24px;border-radius:var(--radius-sm);font-size:22px;font-weight:700;margin-top:14px}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;width:100%;align-content:center}
.metric{background:var(--panel-soft);border-radius:var(--radius-md);padding:34px;min-height:330px;display:flex;flex-direction:column;justify-content:flex-end}
.metric .value{font-size:82px;font-weight:800;letter-spacing:-.05em;line-height:1;color:var(--accent-strong)}
.metric h2{font-size:34px;margin:18px 0 44px}
.metric p{font-size:21px;color:var(--muted);margin:0;line-height:1.45}
.split{display:grid;grid-template-columns:1fr 1fr;gap:28px;width:100%}
.pane{border:1px solid var(--rule);border-radius:var(--radius-md);padding:34px;display:flex;flex-direction:column;min-height:410px}
.pane:last-child{background:var(--panel-soft);border-color:var(--panel-soft)}
.kicker{font-size:18px;color:var(--accent-strong);font-weight:800;letter-spacing:.14em}
.pane h2{font-size:36px;margin:20px 0 24px}
.pane ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:15px}
.pane li{font-size:23px;border-top:1px solid var(--rule);padding:15px 0}
.pane .pane-foot{margin-top:auto;background:var(--accent);border-radius:var(--radius-sm);padding:16px 18px;font-size:20px;font-weight:700}
.grid4{display:grid;grid-template-columns:1fr 1fr;gap:20px;width:100%;align-content:center}
.mini{border:1px solid var(--rule);border-radius:var(--radius-md);padding:24px 28px;min-height:150px;display:grid;grid-template-columns:78px 1fr;gap:10px 18px;align-items:start}
.mini .num{grid-row:1/3;font-size:24px;color:var(--accent-strong);font-weight:800}
.mini h2{font-size:30px;margin:0}
.mini p{font-size:20px;color:var(--muted);margin:0;line-height:1.4}
.example{grid-column:1/-1;background:var(--accent);border-radius:var(--radius-sm);padding:18px 24px;font-size:21px;font-weight:700}
.timeline{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:0;align-content:center;position:relative}
.timeline::before{content:"";position:absolute;left:10%;right:10%;top:78px;height:2px;background:var(--ink)}
.phase{position:relative;padding:0 28px 0 0;min-height:380px}
.dot{width:18px;height:18px;border-radius:50%;background:var(--accent-strong);position:relative;z-index:1;margin:70px 0 58px}
.phase .num{font-size:18px;font-weight:800;color:var(--accent-strong);letter-spacing:.12em}
.phase h2{font-size:38px;margin:14px 0 20px}
.phase p{font-size:22px;line-height:1.55;color:var(--muted);max-width:430px}
.checklist{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:18px;align-content:center}
.check{background:var(--panel-soft);border-radius:var(--radius-md);padding:25px 28px;display:grid;grid-template-columns:58px 1fr;gap:4px 18px;min-height:142px}
.check .tick{grid-row:1/3;width:42px;height:42px;border-radius:50%;background:var(--accent);display:grid;place-items:center;font-weight:800;font-size:19px}
.check h2{font-size:29px;margin:0}
.check p{font-size:20px;color:var(--muted);line-height:1.4;margin:2px 0 0}
.close{grid-column:1/-1;border-left:8px solid var(--accent-strong);padding:16px 24px;font-size:23px;font-weight:700;background:var(--bg)}
`;

const e = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function body(slide) {
  if (slide.type === "cover") {
    return `<div class="cover-grid">${Array.from({length:15},(_,i)=>`<span class="${[4,7,8,9,13].includes(i)?"on":""}"></span>`).join("")}</div><div class="inner"><div class="eyebrow">${slide.eyebrow}</div><h1>${slide.title}</h1><p class="lead">${slide.lead}</p><div class="cover-tag">${slide.tag}</div><div class="footer"><strong>AI 商品经营与利润决策助手</strong><span>方案说明 · 2026</span></div></div>`;
  }
  let content = "";
  if (slide.type === "cards3") content = `<div class="cards3">${slide.cards.map(c=>`<article class="card"><div class="num">${c[0]}</div><h2>${c[1]}</h2><p>${c[2]}</p></article>`).join("")}</div>`;
  if (slide.type === "flow4") content = `<div class="flow">${slide.steps.map(s=>`<article class="step"><div class="num">${s[0]}</div><h2>${s[1]}</h2><p>${s[2]}</p></article>`).join("")}<div class="alert">${slide.alert}</div></div>`;
  if (slide.type === "metrics") content = `<div class="metrics">${slide.metrics.map(m=>`<article class="metric"><div class="value">${m[0]}</div><h2>${m[1]}</h2><p>${m[2]}</p></article>`).join("")}</div>`;
  if (slide.type === "split") content = `<div class="split">${[slide.left,slide.right].map(p=>`<article class="pane"><div class="kicker">${p.kicker}</div><h2>${p.title}</h2><ul>${p.items.map(x=>`<li>${x}</li>`).join("")}</ul><div class="pane-foot">${p.footer}</div></article>`).join("")}</div>`;
  if (slide.type === "grid4") content = `<div class="grid4">${slide.cards.map(c=>`<article class="mini"><div class="num">${c[0]}</div><h2>${c[1]}</h2><p>${c[2]}</p></article>`).join("")}<div class="example">${slide.example}</div></div>`;
  if (slide.type === "timeline3") content = `<div class="timeline">${slide.stages.map(s=>`<article class="phase"><div class="dot"></div><div class="num">${s[0]}</div><h2>${s[1]}</h2><p>${s[2]}</p></article>`).join("")}</div>`;
  if (slide.type === "checklist") content = `<div class="checklist">${slide.items.map(i=>`<article class="check"><div class="tick">${i[0]}</div><h2>${i[1]}</h2><p>${i[2]}</p></article>`).join("")}<div class="close">${slide.close}</div></div>`;
  return `<div class="inner"><div class="eyebrow">${slide.eyebrow}</div><h1>${slide.title}</h1><p class="lead">${slide.lead}</p><main class="content">${content}</main><div class="footer"><strong>AI 商品经营与利润决策助手</strong><span class="page-no"></span></div></div>`;
}

function html(slide, index) {
  const prev = index > 0 ? `p${String(index).padStart(2,"0")}.html` : "p01.html";
  const next = index < slides.length - 1 ? `p${String(index + 2).padStart(2,"0")}.html` : `p${String(slides.length).padStart(2,"0")}.html`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(slide.title.replaceAll("<br>",""))}</title><style>${css}</style></head>
<body><div class="viewport"><section class="stage ${slide.type === "cover" ? "cover" : ""}">${body(slide)}</section></div>
<nav class="nav" aria-label="幻灯片导航"><a href="${prev}" aria-label="上一页">←</a><a href="${next}" aria-label="下一页">→</a></nav>
<script>
const PAGE=${index + 1}, TOTAL=${slides.length};
document.querySelectorAll('.page-no').forEach(el=>el.textContent=String(PAGE).padStart(2,'0')+' / '+String(TOTAL).padStart(2,'0'));
function fit(){const s=document.querySelector('.stage');const scale=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform='scale('+scale+')';}
addEventListener('resize',fit);fit();
addEventListener('keydown',e=>{if(e.key==='ArrowLeft')location.href='${prev}';if(e.key==='ArrowRight'||e.key===' ')location.href='${next}';});
</script></body></html>`;
}

slides.forEach((slide,index)=>{
  const file = path.join(outDir, `p${String(index+1).padStart(2,"0")}.html`);
  fs.writeFileSync(file, html(slide,index), "utf8");
});

console.log(`Generated ${slides.length} slides in ${outDir}`);
