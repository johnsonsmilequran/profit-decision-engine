import { describe, expect, it } from "vitest";
import { isFullMonth } from "./NewBatchPage.tsx";

describe("导入期间前置校验", () => {
  it.each([
    ["2026-07-01", "2026-07-31"],
    ["2024-02-01", "2024-02-29"],
  ])("接受完整自然月 %s 至 %s", (start, end) => expect(isFullMonth(start, end)).toBe(true));

  it.each([
    ["2026-07-02", "2026-07-31"],
    ["2026-07-01", "2026-07-30"],
    ["", ""],
  ])("拒绝非完整自然月 %s 至 %s", (start, end) => expect(isFullMonth(start, end)).toBe(false));
});
