import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, setCsrfToken } from "./api";

afterEach(() => {
  setCsrfToken();
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("对状态变更请求携带当前 CSRF 令牌", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setCsrfToken("csrf-test-token");

    await expect(
      api<{ accepted: boolean }>("/actions/DEC-1/review", { method: "POST" }),
    ).resolves.toEqual({
      accepted: true,
    });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("X-CSRF-Token")).toBe("csrf-test-token");
    expect(request.credentials).toBe("include");
  });

  it("保留服务端结构化错误码与业务文案", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: { code: "VERSION_CONFLICT", message: "状态已变化，请刷新后重试。" },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(api("/actions/DEC-1/review", { method: "POST" })).rejects.toEqual(
      new ApiError(409, "VERSION_CONFLICT", "状态已变化，请刷新后重试。", {
        code: "VERSION_CONFLICT",
        message: "状态已变化，请刷新后重试。",
      }),
    );
  });

  it("把 204 响应映射为空结果", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api<null>("/auth/logout", { method: "POST" })).resolves.toBeNull();
  });
});
