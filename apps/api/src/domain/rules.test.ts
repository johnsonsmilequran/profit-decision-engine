import { describe, expect, it } from "vitest";
import { evaluateRules, type RuleInput } from "./rules.js";

const base: RuleInput = {
  spuId: "SPU-规则测试",
  linkName: "真实规则边界测试商品",
  launchDate: "2026-01-01",
  businessDate: "2026-07-31",
  netSales: "100000",
  profitRate: "0.10",
  returnRate: "0.015",
  returnPeriodVerified: true,
  stockDays: "29.9999",
  metricPeriods: { netSales: "2026-07-01/2026-07-31" },
  qualityStatuses: {},
};

describe("版本化固定规则", () => {
  it.each([
    [{ ...base, launchDate: "2026-06-01", profitRate: "-0.20" }, "new", "increase_investment", "not_generated"],
    [{ ...base, launchDate: "2026-06-01", profitRate: "-0.200001" }, "new", "observe", "not_generated"],
    [{ ...base, profitRate: "-0.000001" }, "large_hit", "clearance", "block_restock"],
    [{ ...base, profitRate: "0" }, "large_hit", "stop_loss", "block_restock"],
    [{ ...base, profitRate: "0.05", returnRate: "0.015001" }, "large_hit", "observe", "restock"],
    [base, "large_hit", "increase_investment", "restock"],
    [{ ...base, netSales: "99999.99", profitRate: "0.05" }, "small_hit", "stop_loss", "block_restock"],
    [{ ...base, netSales: "20000", profitRate: "0.15", stockDays: "30" }, "small_hit", "increase_investment", "no_restock"],
    [{ ...base, netSales: "19999.99", profitRate: null }, "eliminated", "clearance", "block_restock"],
  ] satisfies Array<[RuleInput, string, string, string]>) (
    "按边界得到唯一类型、主动作和库存动作 %#",
    (input, productType, mainAction, inventoryAction) => {
      expect(evaluateRules(input)).toMatchObject({ productType, mainAction, inventoryAction });
    },
  );

  it("达到上架日加两个自然月的当日即转为非新品", () => {
    const result = evaluateRules({
      ...base,
      launchDate: "2026-05-31",
      businessDate: "2026-07-31",
    });
    expect(result.productType).toBe("large_hit");
  });

  it("品退期间未经证明时不使用低品退率证明加投", () => {
    const result = evaluateRules({ ...base, returnPeriodVerified: false });
    expect(result.mainAction).toBe("maintain");
    expect(result.structuredAdvice.evidence).toContain("期间未校验");
  });

  it("同一冻结输入重复计算逐项完全一致", () => {
    expect(evaluateRules(base)).toEqual(evaluateRules(base));
  });
});
