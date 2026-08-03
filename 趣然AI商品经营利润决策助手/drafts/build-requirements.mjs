import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const features = [
  {
    id: "F01",
    name: "数据导入与校验",
    stories: [{ id: "US-F01-01", title: "导入每周经营数据", role: "运营", goal: "导入数据支持部门提供的 SPU 经营表格并看到校验结果", value: "在同一批次内形成可追溯、可重复处理的数据入口" }],
    requirements: [
      { id: "REQ-F01-01", story: "US-F01-01", title: "接收经营表并保证请求幂等", body: "系统接收 XLSX 经营表格，按商品链接识别 SPU；重复点击、网络重试或并发提交必须返回第一次成功建立的批次。" },
      { id: "REQ-F01-02", story: "US-F01-01", title: "校验期间与字段并按影响降级", body: "系统校验业务期间、必要身份和经营字段；必要身份异常拒绝对应行，其他字段按依赖降级，表内汇总行不得参与 SPU 决策。" },
    ],
    acceptance: [
      { id: "AC-F01-01", parent: "REQ-F01-01", p: "P0", title: "有效表格创建批次", when: "运营导入包含可识别商品链接和业务期间的 XLSX 经营表格", shall: "创建一个待处理导入批次，并显示有效 SPU 行数、业务期间和数据来源" },
      { id: "AC-F01-02", parent: "REQ-F01-01", p: "P0", title: "必要身份字段异常可观察", when: "某一数据行缺少商品链接等必要身份字段，同时其他行满足导入条件", shall: "拒绝该异常行、继续处理其余有效行，并返回行号、异常字段和原因" },
      { id: "AC-F01-03", parent: "REQ-F01-02", p: "P0", title: "重复导入不产生新清单", when: "导入内容指纹与业务期间均命中一个已完成批次", shall: "返回原批次及原行动清单，不创建新的业务批次、决策记录或行动项" },
      { id: "AC-F01-04", parent: "REQ-F01-02", p: "P1", title: "汇总行不参与决策", when: "导入表包含合计或汇总行，或汇总值与明细计算不一致", shall: "仅使用 SPU 明细行生成决策，并在导入报告中提示汇总差异" },
    ],
  },
  {
    id: "F02",
    name: "SPU 经营指标计算",
    stories: [{ id: "US-F02-01", title: "获得统一经营口径", role: "运营", goal: "查看每个 SPU 的统一销售、利润、品退与库存指标", value: "让后续固定规则使用同一数据口径" }],
    requirements: [
      { id: "REQ-F02-01", story: "US-F02-01", title: "读取月度销售额与经营准利润率", body: "系统读取数据批次所对应的上一个完整自然月净销售额，并直接采用表内经营准利润率，不按旧公式重算。" },
      { id: "REQ-F02-02", story: "US-F02-01", title: "计算最近一周品退率", body: "系统按品退件数除以已销售件数计算最近一周滚动品退率，并保留统计期间。" },
      { id: "REQ-F02-03", story: "US-F02-01", title: "计算库存可售天数", body: "系统按仓内库存与在途库存之和除以最近十四天平均日销量计算库存可售天数。" },
    ],
    acceptance: [
      { id: "AC-F02-01", parent: "REQ-F02-01", p: "P0", title: "月度口径一致", when: "批次包含上一个完整自然月的净销售额和表内经营准利润率", shall: "把两项数值及自然月起止日期记录为该 SPU 的规则输入" },
      { id: "AC-F02-02", parent: "REQ-F02-01", p: "P0", title: "字段缺失按字段降级", when: "SPU 的销售额或经营准利润率任一字段缺失或不可解析", shall: "保留该 SPU 的其他可用字段，仅跳过依赖缺失字段的判断，并显示缺失原因" },
      { id: "AC-F02-03", parent: "REQ-F02-02", p: "P0", title: "品退率公式可追溯", when: "最近一周品退件数与已销售件数均有效且已销售件数大于零", shall: "按品退件数除以已销售件数生成品退率，并记录分子、分母和滚动期间" },
      { id: "AC-F02-04", parent: "REQ-F02-02", p: "P0", title: "品退数据不足不误判", when: "最近一周品退率期间未核验、分母无效或所需字段缺失", shall: "标记品退率不可用，且不得仅依据该品退字段触发观察结论" },
      { id: "AC-F02-05", parent: "REQ-F02-03", p: "P0", title: "库存周转公式可追溯", when: "仓内库存、在途库存和最近十四天平均日销量均有效且平均日销量大于零", shall: "按仓内库存与在途库存之和除以最近十四天平均日销量生成库存周转天数，并保留三个输入值" },
      { id: "AC-F02-06", parent: "REQ-F02-03", p: "P0", title: "库存数据不足不生成补货", when: "库存数量或最近十四天平均日销量缺失、不可解析或平均日销量不大于零", shall: "标记库存周转天数不可用，并不生成补货建议" },
    ],
  },
  {
    id: "F03",
    name: "固定规则决策",
    stories: [{ id: "US-F03-01", title: "获得确定性经营结论", role: "运营主管", goal: "按统一规则查看商品类型、经营动作与库存动作", value: "用同一利润标准拍板并避免经营动作与采购动作冲突" }],
    requirements: [
      { id: "REQ-F03-01", story: "US-F03-01", title: "判定 SPU 商品类型", body: "系统以批次业务截止日和上架日判定新品，再按上一个完整自然月净销售额判定大爆款、小爆款或淘汰品。" },
      { id: "REQ-F03-02", story: "US-F03-01", title: "判定经营主动作", body: "系统按商品类型、经营准利润率和最近一周品退率，用固定阈值及清仓、止损、观察、加投、维持的优先级生成唯一经营主动作。" },
      { id: "REQ-F03-03", story: "US-F03-01", title: "判定补货或禁补动作", body: "系统仅对非新品且未触发止损或清仓的 SPU 评估补货；止损或清仓必须同步生成禁补动作。" },
    ],
    acceptance: [
      { id: "AC-F03-01", parent: "REQ-F03-01", p: "P0", title: "新品边界确定", when: "SPU 上架日距批次业务截止日未满两个自然月", shall: "把该 SPU 判定为新品，并保留上架日、业务截止日和规则版本" },
      { id: "AC-F03-02", parent: "REQ-F03-01", p: "P0", title: "成熟商品按销售额分型", when: "SPU 不属于新品且上一个完整自然月净销售额可用", shall: "按销售额大于等于十万元判定大爆款、大于等于两万元且小于十万元判定小爆款、低于两万元判定淘汰品" },
      { id: "AC-F03-03", parent: "REQ-F03-02", p: "P0", title: "大爆款动作阈值", when: "SPU 被判定为大爆款且所需利润与品退数据可用", shall: "依次按利润率小于零清仓、零至小于百分之五止损、品退率大于百分之一点五观察、利润率大于等于百分之十且品退率不大于百分之一点五加投，否则维持生成唯一经营主动作" },
      { id: "AC-F03-04", parent: "REQ-F03-02", p: "P0", title: "小爆款与新品动作阈值", when: "SPU 被判定为小爆款或新品且所需利润与品退数据可用", shall: "对小爆款依次按利润率小于百分之五清仓、百分之五至小于百分之十止损、品退率大于百分之一点五观察、利润率大于等于百分之十五且品退率不大于百分之一点五加投、否则维持；对新品按利润率大于等于负百分之二十加投、低于负百分之二十观察" },
      { id: "AC-F03-05", parent: "REQ-F03-03", p: "P0", title: "成熟商品补货规则", when: "非新品 SPU 未触发止损或清仓且库存周转天数可用", shall: "在库存周转天数小于三十天时生成补货动作，否则生成不补货结论" },
      { id: "AC-F03-06", parent: "REQ-F03-03", p: "P0", title: "禁补与新品补货边界", when: "SPU 触发止损或清仓，或 SPU 属于新品，或库存周转天数不可用", shall: "对止损或清仓原子生成禁补动作；对新品或库存数据不足不生成补货建议，并显示原因" },
    ],
  },
  {
    id: "F04",
    name: "AI 建议解释",
    stories: [{ id: "US-F04-01", title: "获得基于规则的可读建议", role: "运营", goal: "快速理解每条规则结论的对象、问题、依据和动作", value: "缩短从发现问题到准备执行的解释成本，同时不改变固定规则结论" }],
    requirements: [
      { id: "REQ-F04-01", story: "US-F04-01", title: "生成四要素建议与关键依据", body: "系统基于结构化规则结论生成具体对象、发现问题、关键依据和推荐动作，并显示触发指标、周期、阈值和数据限制。" },
      { id: "REQ-F04-02", story: "US-F04-01", title: "阻止 AI 越界改写规则", body: "系统舍弃 AI 生成的冲突动作、输入中不存在的数值，以及当前数据粒度不支持的广告明细、评价/差评主题、退款/退货原因归因或 SKU 结论。" },
      { id: "REQ-F04-03", story: "US-F04-01", title: "AI 失败不阻塞并保护网关凭据", body: "LiteLLM 不可用时系统保留结构化四要素并开放审核执行；网关密钥由运维人员通过系统级部署密钥配置，普通用户不可见。" },
    ],
    acceptance: [
      { id: "AC-F04-01", parent: "REQ-F04-01", p: "P0", title: "四要素齐全且不改规则", when: "固定规则已生成 SPU 的经营主动作及适用的库存动作", shall: "生成包含具体对象、发现问题、关键依据和推荐动作的说明，且动作名称与固定规则结论一致" },
      { id: "AC-F04-02", parent: "REQ-F04-01", p: "P0", title: "无依据内容不展示", when: "AI 返回的描述包含结构化输入中不存在的数值、原因或动作", shall: "不展示该无依据内容，并回退到结构化规则说明" },
      { id: "AC-F04-03", parent: "REQ-F04-02", p: "P0", title: "AI 不可用不阻塞", when: "LiteLLM 网关超时、报错或返回不可用内容", shall: "继续生成并开放固定规则行动清单、审核和执行，同时显示 AI 解释已降级" },
      { id: "AC-F04-04", parent: "REQ-F04-03", p: "P0", title: "密钥对普通用户不可见", when: "普通业务用户访问页面、导出、日志或错误详情", shall: "不返回 LiteLLM 部署密钥明文或可恢复内容" },
    ],
  },
  {
    id: "F05",
    name: "行动清单",
    stories: [{ id: "US-F05-01", title: "按优先级处理经营问题", role: "运营", goal: "在每周清单中筛选并查看可执行建议", value: "把分散数据转成同一利润标准下的行动入口" }],
    requirements: [
      { id: "REQ-F05-01", story: "US-F05-01", title: "每批次一份清单并保留历史", body: "系统为每个新的有效业务批次生成且仅生成一份行动清单；后续批次不得覆盖历史清单和状态。" },
      { id: "REQ-F05-02", story: "US-F05-01", title: "固定排序并提供筛选", body: "清单按固定动作优先级和稳定次序排列，并允许按动作、店铺、责任运营、审核状态和执行状态筛选。" },
      { id: "REQ-F05-03", story: "US-F05-01", title: "控制行动清单收录范围", body: "只有需处理的经营动作、补货或禁补进入行动清单；纯维持且无补货或禁补的 SPU 默认不进入清单。" },
    ],
    acceptance: [
      { id: "AC-F05-01", parent: "REQ-F05-01", p: "P0", title: "新批次只生成一份清单", when: "一个新的有效导入批次完成指标计算和固定规则判定", shall: "为该批次生成且仅生成一份行动清单，并关联全部可形成结论的 SPU" },
      { id: "AC-F05-02", parent: "REQ-F05-01", p: "P0", title: "试点问题数量可验收", when: "十至二十个真实 SPU 的试点批次中至少三个 SPU 命中非维持经营动作或库存风险", shall: "在行动清单中展示至少三个对应的真实经营问题和可执行建议" },
      { id: "AC-F05-03", parent: "REQ-F05-02", p: "P0", title: "主动作排序固定", when: "同一清单同时包含多种经营主动作", shall: "按清仓、止损、观察、加投、维持的固定优先级排序，并允许按动作与状态筛选" },
      { id: "AC-F05-04", parent: "REQ-F05-02", p: "P0", title: "角色视图遵循最小可见", when: "运营、运营主管或采购计划查看同一清单", shall: "按各自权限返回完整经营视图或仅补货与禁补及必要库存销量依据的采购视图" },
      { id: "AC-F05-05", parent: "REQ-F05-03", p: "P0", title: "建议详情可追溯", when: "用户打开任一建议详情", shall: "展示具体 SPU、发现问题、关键依据、推荐动作、业务期间、规则版本和参与判定的原始关键值" },
    ],
  },
  {
    id: "F06",
    name: "审核与执行跟踪",
    stories: [
      { id: "US-F06-01", title: "审核经营建议", role: "运营主管", goal: "批准或驳回完整建议并查看冲突状态", value: "在动作执行前形成明确拍板记录" },
      { id: "US-F06-02", title: "执行并记录动作结果", role: "运营", goal: "与采购计划分别更新各自负责动作的状态和结果", value: "形成建议、审核、执行、结果的轻闭环" },
    ],
    requirements: [
      { id: "REQ-F06-01", story: "US-F06-01", title: "整体审核建议", body: "运营主管对完整建议执行一次批准或驳回；只有批准才按角色激活动作，驳回保留原始规则与备注。" },
      { id: "REQ-F06-02", story: "US-F06-02", title: "按责任跟踪经营与采购动作", body: "运营更新经营动作，采购计划更新补货或禁补动作；两个动作状态独立但保持同一建议关联。" },
      { id: "REQ-F06-03", story: "US-F06-02", title: "记录结果并防止并发覆盖", body: "运营和采购计划分别记录各自动作结果；状态更新使用版本保护，重复或过期提交不得覆盖已成功结果。" },
    ],
    acceptance: [
      { id: "AC-F06-01", parent: "REQ-F06-01", p: "P0", title: "主管整体审核", when: "运营主管查看一条待审核建议", shall: "允许对完整建议执行批准或驳回，并记录操作者、时间和驳回原因" },
      { id: "AC-F06-02", parent: "REQ-F06-01", p: "P0", title: "驳回后不可执行", when: "建议被运营主管驳回", shall: "不创建可执行动作，或把已预生成动作保持为不可执行，并向相关角色显示驳回结果" },
      { id: "AC-F06-03", parent: "REQ-F06-02", p: "P0", title: "批准后按角色拆动作", when: "包含经营主动作及补货或禁补动作的建议被批准", shall: "创建相互关联但状态独立的经营动作和库存动作，并分别指定运营与采购计划为责任角色" },
      { id: "AC-F06-04", parent: "REQ-F06-02", p: "P0", title: "并发状态更新可观察", when: "用户基于过期版本提交建议或动作状态更新", shall: "拒绝覆盖新版本，返回当前状态与冲突提示，并保留本次冲突记录" },
      { id: "AC-F06-05", parent: "REQ-F06-03", p: "P0", title: "结果由责任角色回填", when: "审核通过的经营动作或库存动作进入执行阶段", shall: "仅允许运营回填经营动作结果，并允许采购计划回填补货或禁补动作的执行状态和结果" },
      { id: "AC-F06-06", parent: "REQ-F06-03", p: "P0", title: "周内更新与历史保留", when: "责任角色在新清单生成后的一周内更新审核、执行或结果状态", shall: "保存最新状态并追加不可覆盖的状态事件，使后续批次仍可查看完整历史" },
    ],
  },
  {
    id: "F07",
    name: "权限隔离",
    stories: [{ id: "US-F07-01", title: "按职责查看和操作", role: "采购计划", goal: "只查看并处理补货或禁补所需信息", value: "在不暴露完整利润、推广和售后数据的前提下完成采购动作" }],
    requirements: [
      { id: "REQ-F07-01", story: "US-F07-01", title: "隔离运营与审核操作", body: "运营可见完整经营信息并处理经营动作，运营主管可见审核所需完整信息并负责建议审核。" },
      { id: "REQ-F07-02", story: "US-F07-01", title: "限制采购数据与操作", body: "采购计划仅可见补货或禁补结论及必要库存、销量依据，并只处理补货或禁补动作；越权读取与操作必须被拒绝。" },
    ],
    acceptance: [
      { id: "AC-F07-01", parent: "REQ-F07-01", p: "P0", title: "运营视图完整", when: "运营或运营主管查看其有权访问的 SPU 建议", shall: "展示完整利润、推广、售后、规则依据、审核和动作信息" },
      { id: "AC-F07-02", parent: "REQ-F07-01", p: "P0", title: "采购视图最小化", when: "采购计划查看 SPU 建议或导出清单", shall: "仅展示补货或禁补结论、库存数量、在途数量、最近十四天销量依据及必要商品身份信息，不展示完整利润、推广和售后信息" },
      { id: "AC-F07-03", parent: "REQ-F07-02", p: "P0", title: "审核权限唯一", when: "非运营主管用户尝试批准或驳回建议", shall: "拒绝该操作并记录越权事件" },
      { id: "AC-F07-04", parent: "REQ-F07-02", p: "P0", title: "动作权限按责任隔离", when: "用户尝试更新不属于其责任角色的行动项", shall: "拒绝更新；仅允许运营处理经营动作、采购计划处理补货或禁补动作" },
    ],
  },
  {
    id: "F08",
    name: "规则与数据溯源",
    stories: [{ id: "US-F08-01", title: "追溯结论来源", role: "运营主管", goal: "查看建议使用的数据批次、规则版本、关键值和状态历史", value: "复核结论并在规则或数据变化后解释差异" }],
    requirements: [
      { id: "REQ-F08-01", story: "US-F08-01", title: "保存决策快照", body: "系统为每条建议保存业务批次、业务期间、规则版本、商品类型、关键输入值和输出动作，后续数据导入不得覆盖旧快照。" },
      { id: "REQ-F08-02", story: "US-F08-01", title: "保存审核与动作事件", body: "系统追加记录建议审核、动作状态、结果更新、越权拒绝和并发冲突事件。" },
    ],
    acceptance: [
      { id: "AC-F08-01", parent: "REQ-F08-01", p: "P0", title: "规则结论可复算", when: "有权限用户查看任一历史建议", shall: "展示该建议的批次、期间、规则版本、商品类型、参与判定的原始关键值和输出动作" },
      { id: "AC-F08-02", parent: "REQ-F08-01", p: "P0", title: "新批次不覆盖历史", when: "同一 SPU 在后续周次导入新的经营数据", shall: "创建新的快照和决策记录，同时保留此前批次的输入、结论和状态历史" },
      { id: "AC-F08-03", parent: "REQ-F08-02", p: "P0", title: "业务状态变化留痕", when: "建议审核、动作执行或结果记录发生变化", shall: "追加包含对象、前后状态、操作者、时间和版本的审计事件" },
      { id: "AC-F08-04", parent: "REQ-F08-02", p: "P1", title: "异常操作留痕", when: "发生越权操作拒绝或过期版本并发冲突", shall: "追加包含请求角色、目标对象、拒绝原因和发生时间的审计事件" },
    ],
  },
];

// PRD R3 的 39 条场景是最终可观察行为源；从主笔稿生成 EARS，避免契约与详细版出现双重语义。
const pmDraft = readFileSync(resolve(root, "drafts/r3-pm.md"), "utf8");
const acceptancePattern = /^### AC-(\d+)（(AC-F\d{2}-\d{2})，关联 (REQ-F\d{2}-\d{2})）\n+\n([^\n]+)$/gm;
const parsedAcceptance = [];
for (const match of pmDraft.matchAll(acceptancePattern)) {
  const [, legacy, id, parent, paragraph] = match;
  const normalized = paragraph.replace(/（[^）]*来源：[^）]*）/g, "").trim();
  const parts = normalized.match(/^当(.+?)(?:时|后)，(.+)$/);
  if (!parts) throw new Error(`无法把 ${id} 转换为 EARS: ${paragraph}`);
  parsedAcceptance.push({
    id,
    parent,
    p: ["4", "39"].includes(legacy) ? "P1" : "P0",
    title: `产品场景 AC-${legacy}`,
    when: parts[1],
    shall: parts[2].replace(/^系统应/, "").replace(/^系统不应/, "不得"),
  });
}
if (parsedAcceptance.length !== 39) throw new Error(`验收场景数量异常: ${parsedAcceptance.length}`);
for (const feature of features) {
  feature.acceptance = parsedAcceptance.filter((item) => item.id.startsWith(`AC-${feature.id}-`));
}

const nfrs = [
  { id: "NFR-001", title: "固定规则确定性", applies: "REQ-F02-01、REQ-F02-02、REQ-F02-03、REQ-F03-01、REQ-F03-02、REQ-F03-03", measure: "同一有效数据快照与同一规则版本被重复处理时，商品类型、经营主动作和库存动作逐项一致。" },
  { id: "NFR-002", title: "权限与数据最小可见", applies: "REQ-F05-02、REQ-F07-01、REQ-F07-02", measure: "采购计划的页面、接口响应和错误路径中不得出现完整利润、推广和售后字段，仅出现补货或禁补所需的商品、库存和销量依据。" },
  { id: "NFR-003", title: "凭据保密", applies: "REQ-F04-03、REQ-F07-02", measure: "页面、接口响应、业务日志和错误详情均不得返回 LiteLLM 部署密钥明文或可恢复内容，普通用户无查看入口。" },
  { id: "NFR-004", title: "AI 失败可降级", applies: "REQ-F04-01、REQ-F04-02、REQ-F04-03", measure: "LiteLLM 网关不可用时，同一处理尝试仍产出固定规则结论和结构化依据，且审核与执行入口可用。" },
  { id: "NFR-005", title: "审计可追溯", applies: "REQ-F01-01、REQ-F05-01、REQ-F06-01、REQ-F06-02、REQ-F06-03、REQ-F08-01、REQ-F08-02", measure: "每条决策及每次状态事件均包含关联批次、业务期间、规则或对象版本、关键值或状态变化、操作者与时间；历史事件不可被状态更新覆盖。" },
];

let md = `# 趣然 AI 商品经营与利润决策助手 Requirements Contract

## Metadata

- work_type: feature
- workflow_mode: standard
- revision: 1
- source_prd: PRD详细版.md
- status: active
- derived_decision: 新品年龄使用批次业务截止日以保证历史重放确定性；这是阶段 5 派生产品决策，不冒充用户原始事实

## External capability configuration

| Capability | Credential owner | Configuration actor | Surface | Scope | Lifecycle | Stage | Requirement IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LiteLLM 网关服务 | 运维人员 | 运维人员 | deployment-secret | system | 运维负责部署、轮换与撤销 | MVP | REQ-F04-01、REQ-F04-02、REQ-F04-03 |

## Capability prerequisites

| Prerequisite | Status | Owner | Evidence or deadline | Fallback | Stage | Requirement IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 数据支持部门每周 SPU 经营表格 | ready | 数据支持部门 | 用户确认当前每周一可提供经营表格，且已提供真实字段样表 | 保留历史清单并提示本周无新批次，不虚构新结论 | MVP | REQ-F01-01、REQ-F02-01 |
| LiteLLM 网关服务已存在 | ready | 运维人员 | 用户确认已有由运维维护的 LiteLLM 网关服务；产品环境连通性与部署密钥作用域待实施验证 | 使用结构化固定规则说明，继续开放审核和执行 | MVP | REQ-F04-01、REQ-F04-02 |
`;

for (const feature of features) {
  md += `\n## Feature ${feature.id} · ${feature.name}\n`;
  for (const story of feature.stories) {
    md += `\n### ${story.id} · ${story.title}\n\n- Role: ${story.role}\n- Goal: ${story.goal}\n- Value: ${story.value}\n- Stage: MVP\n- Status: active\n`;
  }
  for (const req of feature.requirements) {
    md += `\n### ${req.id} · ${req.title}\n\n- Story: ${req.story}\n- Stage: MVP\n- Revision: 1\n- Status: active\n- Behavior: ${req.body}\n`;
  }
  for (const ac of feature.acceptance) {
    md += `\n### ${ac.id} · ${ac.title}\n\n- Parent: ${ac.parent}\n- Priority: ${ac.p}\n- EARS:\n\n\`\`\`text\nWHEN ${ac.when}\nTHE SYSTEM SHALL ${ac.shall}\n\`\`\`\n`;
  }
}

md += `\n## Non-functional requirements\n`;
for (const nfr of nfrs) {
  md += `\n### ${nfr.id} · ${nfr.title}\n\n- Applies-to: ${nfr.applies}\n- Revision: 1\n- Status: active\n- Measure: ${nfr.measure}\n`;
}

writeFileSync(resolve(root, "output/requirements.md"), md, "utf8");

const analysis = `# 趣然 AI 商品经营与利润决策助手 · Requirements Correctness Analysis

## 1. 范围与权威来源

- 分析对象：\`output/requirements.md\` revision 1。
- 权威顺序：用户已确认的 \`output/PRD-V0.md\`、真实表格字段证据、阶段 5 稳定 ID 注册表。
- 阶段 2—4 未执行，因此本分析不引入年度价值、竞品或多角色辩论结论。

## 2. 完整性

| 检查项 | 结果 | 说明 |
| :--- | :--- | :--- |
| 功能覆盖 | PASS | F01—F08 均为 MVP，并各自包含用户故事、行为需求和验收条件。 |
| 需求可验收 | PASS | 二十一个 REQ 均至少由一个 EARS AC 覆盖。 |
| 非功能约束 | PASS | 固定规则确定性、最小权限、凭据保密、AI 降级、审计追溯均有可观察度量。 |
| 外部能力责任 | PASS | LiteLLM 的密钥所有者、配置者、配置面、作用域与生命周期已明确。 |
| 前置能力 | PASS | 每周经营表格与 LiteLLM 网关均有已确认依据和降级策略。 |

## 3. 跨需求正确性

| 冲突主题 | 处理结论 | 关联需求 |
| :--- | :--- | :--- |
| 建议整体审核与双动作执行 | 建议只整体批准或驳回；批准后经营动作与库存动作分别执行、分别记录结果。 | REQ-F06-01、REQ-F06-02、REQ-F06-03 |
| 止损/清仓与继续补货冲突 | 止损或清仓与禁补在同一规则决策中原子生成，采购计划负责回填禁补结果。 | REQ-F03-03、REQ-F06-02 |
| AI 与固定规则权威冲突 | 固定规则是唯一动作判定源；AI 仅解释且失败不阻塞清单、审核或执行。 | REQ-F03-02、REQ-F04-01、REQ-F04-02 |
| 重复导入与重复清单 | 相同指纹及期间直接返回原批次和原清单，不产生新的业务对象。 | REQ-F01-02、REQ-F05-01 |
| 单一当前状态与审计历史 | 当前状态使用版本控制；所有变更以追加事件保留，过期更新不得覆盖。 | REQ-F06-02、REQ-F06-03、REQ-F08-02 |
| 采购最小可见与执行所需证据 | 采购只看补货或禁补结论及商品、库存、销量必要依据，不看完整利润、推广和售后信息。 | REQ-F07-01、REQ-F07-02 |

## 4. 边界与降级

- 新品以数据批次业务截止日为基准，按上架未满两个自然月判断，避免使用导入时间导致同一批数据结论漂移。
- 销售、利润、品退和库存字段缺失按字段级降级；只有商品链接等必要身份字段缺失才拒绝整行。
- 新品暂不生成补货建议；库存或最近十四天销量不足时不生成补货建议。
- 表格没有评价、退款原因和广告明细时，产品不输出无证据的归因或明细优化动作。

## 5. 决策依赖与未决项

- 当前没有阻塞 MVP 设计和开发的产品 P0/P1 未决项。
- Asia/Shanghai 作为当前业务日期实现假设；如后续事业部跨时区，应在不改变业务口径的前提下参数化。
- 三角色身份认证与映射能力尚未形成 ready/committed 责任承诺，因此未伪填入前置能力责任表；在设计阶段明确身份接入及负责人之前，不得以共享账号、仅前端隐藏或真实数据写操作替代 F07 权限要求。
- 技术栈属于后续设计阶段建议，不是本需求契约的产品事实。

P0 unresolved: 0
P1 unresolved: 0`;

writeFileSync(resolve(root, "output/requirements-analysis.md"), analysis, "utf8");
