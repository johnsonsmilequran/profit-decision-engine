import { afterEach, describe, expect, it, vi } from "vitest";
import { dingtalkStartUrl, loadCurrentUser } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("身份 API", () => {
  it("未认证时只返回空身份，不伪造默认角色", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    await expect(loadCurrentUser()).resolves.toBeNull();
  });

  it("拒绝不符合三角色契约的身份响应", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { identityRef: "ding-1", displayName: "薇恩", role: "admin" } })),
    );
    await expect(loadCurrentUser()).rejects.toThrow();
  });

  it("认证发起地址只携带站内回跳意图", () => {
    const url = new URL(dingtalkStartUrl("/batches/123"));
    expect(url.pathname).toBe("/api/auth/dingtalk/start");
    expect(url.searchParams.get("return_to")).toBe("/batches/123");
  });
});
