import { describe, expect, it, vi } from "vitest";
import { DingTalkClient, DingTalkProtocolError } from "./dingtalk.js";

const config = {
  clientId: "ding-client",
  clientSecret: "ding-secret",
  redirectUri: "https://profit.example.com/api/auth/dingtalk/callback",
};

describe("DingTalkClient", () => {
  it("生成带防伪 state 的标准 OAuth 授权地址", () => {
    const url = new URL(new DingTalkClient(config).authorizationUrl("state-token"));
    expect(url.origin + url.pathname).toBe("https://login.dingtalk.com/oauth2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "ding-client",
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid",
      state: "state-token",
    });
  });

  it("以授权码换取用户令牌并只采用稳定 unionId", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "access-token", expireIn: 7200 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ unionId: "union-123", nick: "薇恩" })));
    const client = new DingTalkClient(config, request);

    await expect(client.profileFromCode("auth-code")).resolves.toEqual({ unionId: "union-123" });
    expect(request).toHaveBeenNthCalledWith(
      1,
      "https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
      expect.objectContaining({ method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "https://api.dingtalk.com/v1.0/contact/users/me",
      { headers: { "x-acs-dingtalk-access-token": "access-token" } },
    );
  });

  it("上游未返回稳定身份时明确失败", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "access-token" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ openId: "app-scoped-id" })));
    await expect(new DingTalkClient(config, request).profileFromCode("auth-code")).rejects.toBeInstanceOf(
      DingTalkProtocolError,
    );
  });
});
