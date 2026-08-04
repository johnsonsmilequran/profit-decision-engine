import { Decimal } from "decimal.js";

export const RULE_VERSION = "RULE-V0-2026-08-04";

export type ProductType = "new" | "large_hit" | "small_hit" | "eliminated" | "data_error";
export type MainAction =
  | "clearance"
  | "stop_loss"
  | "observe"
  | "increase_investment"
  | "maintain"
  | "undetermined";
export type InventoryAction = "block_restock" | "restock" | "no_restock" | "not_generated";

export interface RuleInput {
  spuId: string;
  linkName: string;
  launchDate: string | null;
  businessDate: string;
  netSales: string | null;
  profitRate: string | null;
  returnRate: string | null;
  returnPeriodVerified: boolean;
  stockDays: string | null;
  metricPeriods: Record<string, string>;
  qualityStatuses: Record<string, string>;
}

export interface RuleResult {
  ruleVersion: string;
  productType: ProductType;
  mainAction: MainAction;
  inventoryAction: InventoryAction;
  triggerRules: string[];
  keyValues: Record<string, string | boolean | null>;
  structuredAdvice: {
    object: string;
    problem: string;
    evidence: string;
    action: string;
  };
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function addCalendarMonths(value: string, months: number): string | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const monthIndex = parsed.month - 1 + months;
  const targetYear = parsed.year + Math.floor(monthIndex / 12);
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetDay = Math.min(parsed.day, lastDay);
  return [
    targetYear.toString().padStart(4, "0"),
    (targetMonthIndex + 1).toString().padStart(2, "0"),
    targetDay.toString().padStart(2, "0"),
  ].join("-");
}

function classify(input: RuleInput, triggerRules: string[]): ProductType {
  if (!input.launchDate || !parseDate(input.launchDate)) {
    triggerRules.push("CLASSIFY_LAUNCH_DATE_INVALID");
    return "data_error";
  }
  const matureBoundary = addCalendarMonths(input.launchDate, 2);
  if (!matureBoundary) {
    triggerRules.push("CLASSIFY_LAUNCH_DATE_INVALID");
    return "data_error";
  }
  if (input.businessDate < matureBoundary) {
    triggerRules.push("CLASSIFY_NEW_LT_TWO_CALENDAR_MONTHS");
    return "new";
  }
  if (input.netSales === null) {
    triggerRules.push("CLASSIFY_NET_SALES_UNAVAILABLE");
    return "data_error";
  }
  const netSales = new Decimal(input.netSales);
  if (netSales.greaterThanOrEqualTo(100_000)) {
    triggerRules.push("CLASSIFY_LARGE_HIT_NET_SALES_GTE_100000");
    return "large_hit";
  }
  if (netSales.greaterThanOrEqualTo(20_000)) {
    triggerRules.push("CLASSIFY_SMALL_HIT_NET_SALES_GTE_20000_LT_100000");
    return "small_hit";
  }
  triggerRules.push("CLASSIFY_ELIMINATED_NET_SALES_LT_20000");
  return "eliminated";
}

function chooseMainAction(
  productType: ProductType,
  input: RuleInput,
  triggerRules: string[],
): MainAction {
  if (productType === "data_error") return "undetermined";
  if (productType === "eliminated") {
    triggerRules.push("ACTION_CLEARANCE_ELIMINATED");
    return "clearance";
  }
  if (input.profitRate === null) {
    triggerRules.push("ACTION_PROFIT_RATE_UNAVAILABLE");
    return "undetermined";
  }
  const profitRate = new Decimal(input.profitRate);
  const returnRate = input.returnPeriodVerified && input.returnRate !== null
    ? new Decimal(input.returnRate)
    : null;

  if (productType === "new") {
    if (profitRate.greaterThanOrEqualTo(-0.2)) {
      triggerRules.push("ACTION_INCREASE_NEW_PROFIT_GTE_NEGATIVE_20_PERCENT");
      return "increase_investment";
    }
    triggerRules.push("ACTION_OBSERVE_NEW_PROFIT_LT_NEGATIVE_20_PERCENT");
    return "observe";
  }

  if (productType === "large_hit") {
    if (profitRate.lessThan(0)) {
      triggerRules.push("ACTION_CLEARANCE_LARGE_HIT_PROFIT_LT_ZERO");
      return "clearance";
    }
    if (profitRate.lessThan(0.05)) {
      triggerRules.push("ACTION_STOP_LOSS_LARGE_HIT_PROFIT_LT_5_PERCENT");
      return "stop_loss";
    }
    if (returnRate?.greaterThan(0.015)) {
      triggerRules.push("ACTION_OBSERVE_LARGE_HIT_RETURN_GT_1_5_PERCENT");
      return "observe";
    }
    if (profitRate.greaterThanOrEqualTo(0.1) && returnRate?.lessThanOrEqualTo(0.015)) {
      triggerRules.push("ACTION_INCREASE_LARGE_HIT_PROFIT_GTE_10_RETURN_LTE_1_5_PERCENT");
      return "increase_investment";
    }
  }

  if (productType === "small_hit") {
    if (profitRate.lessThan(0.05)) {
      triggerRules.push("ACTION_CLEARANCE_SMALL_HIT_PROFIT_LT_5_PERCENT");
      return "clearance";
    }
    if (profitRate.lessThan(0.1)) {
      triggerRules.push("ACTION_STOP_LOSS_SMALL_HIT_PROFIT_LT_10_PERCENT");
      return "stop_loss";
    }
    if (returnRate?.greaterThan(0.015)) {
      triggerRules.push("ACTION_OBSERVE_SMALL_HIT_RETURN_GT_1_5_PERCENT");
      return "observe";
    }
    if (profitRate.greaterThanOrEqualTo(0.15) && returnRate?.lessThanOrEqualTo(0.015)) {
      triggerRules.push("ACTION_INCREASE_SMALL_HIT_PROFIT_GTE_15_RETURN_LTE_1_5_PERCENT");
      return "increase_investment";
    }
  }

  triggerRules.push("ACTION_MAINTAIN_NO_STRONG_ACTION_MATCHED");
  return "maintain";
}

function chooseInventoryAction(
  productType: ProductType,
  mainAction: MainAction,
  stockDays: string | null,
  triggerRules: string[],
): InventoryAction {
  if (mainAction === "clearance" || mainAction === "stop_loss") {
    triggerRules.push("INVENTORY_BLOCK_RESTOCK_FOR_CLEARANCE_OR_STOP_LOSS");
    return "block_restock";
  }
  if (productType === "new") {
    triggerRules.push("INVENTORY_NOT_GENERATED_FOR_NEW_PRODUCT");
    return "not_generated";
  }
  if (productType === "data_error" || stockDays === null) {
    triggerRules.push("INVENTORY_NOT_GENERATED_DATA_UNAVAILABLE");
    return "not_generated";
  }
  if (new Decimal(stockDays).lessThan(30)) {
    triggerRules.push("INVENTORY_RESTOCK_STOCK_DAYS_LT_30");
    return "restock";
  }
  triggerRules.push("INVENTORY_NO_RESTOCK_STOCK_DAYS_GTE_30");
  return "no_restock";
}

const productLabels: Record<ProductType, string> = {
  new: "新品",
  large_hit: "大爆款",
  small_hit: "小爆款",
  eliminated: "淘汰商品",
  data_error: "数据异常",
};

const mainActionLabels: Record<MainAction, string> = {
  clearance: "清仓",
  stop_loss: "止损",
  observe: "观察",
  increase_investment: "加投",
  maintain: "维持",
  undetermined: "无法判定",
};

const inventoryActionLabels: Record<InventoryAction, string> = {
  block_restock: "禁止补货",
  restock: "补货",
  no_restock: "不补货",
  not_generated: "不生成",
};

export function evaluateRules(input: RuleInput): RuleResult {
  if (!parseDate(input.businessDate)) {
    throw new Error("业务截止日必须是合法 YYYY-MM-DD 日期");
  }
  const triggerRules: string[] = [];
  const productType = classify(input, triggerRules);
  const mainAction = chooseMainAction(productType, input, triggerRules);
  const inventoryAction = chooseInventoryAction(productType, mainAction, input.stockDays, triggerRules);
  const problem = mainAction === "maintain"
    ? "当前未命中需要处理的强经营动作"
    : `${productLabels[productType]}命中${mainActionLabels[mainAction]}规则`;
  const evidence = [
    `净销售额=${input.netSales ?? "不可用"}`,
    `经营准利润率=${input.profitRate ?? "不可用"}`,
    `最近7天品退率=${input.returnPeriodVerified ? (input.returnRate ?? "不可用") : "期间未校验"}`,
    `库存可售天数=${input.stockDays ?? "不可用"}`,
    `规则版本=${RULE_VERSION}`,
  ].join("；");
  return {
    ruleVersion: RULE_VERSION,
    productType,
    mainAction,
    inventoryAction,
    triggerRules,
    keyValues: {
      launchDate: input.launchDate,
      businessDate: input.businessDate,
      netSales: input.netSales,
      profitRate: input.profitRate,
      returnRate: input.returnRate,
      returnPeriodVerified: input.returnPeriodVerified,
      stockDays: input.stockDays,
    },
    structuredAdvice: {
      object: `${input.spuId} ${input.linkName}`,
      problem,
      evidence,
      action: `经营动作=${mainActionLabels[mainAction]}；补货动作=${inventoryActionLabels[inventoryAction]}`,
    },
  };
}
