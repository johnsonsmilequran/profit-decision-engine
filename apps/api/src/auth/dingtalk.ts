export interface DingTalkProfile {
  unionId: string;
}

export interface DingTalkClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface TokenResponse {
  accessToken?: string;
  expireIn?: number;
}

interface ProfileResponse {
  unionId?: string;
}

export class DingTalkProtocolError extends Error {}

export class DingTalkClient {
  constructor(
    private readonly config: DingTalkClientConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  authorizationUrl(state: string): string {
    const url = new URL("https://login.dingtalk.com/oauth2/auth");
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("scope", "openid");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  async profileFromCode(code: string): Promise<DingTalkProfile> {
    const tokenResponse = await this.request("https://api.dingtalk.com/v1.0/oauth2/userAccessToken", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        code,
        grantType: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) throw new DingTalkProtocolError("钉钉用户令牌交换失败");
    const token = (await tokenResponse.json()) as TokenResponse;
    if (!token.accessToken) throw new DingTalkProtocolError("钉钉用户令牌响应无效");

    const profileResponse = await this.request("https://api.dingtalk.com/v1.0/contact/users/me", {
      headers: { "x-acs-dingtalk-access-token": token.accessToken },
    });
    if (!profileResponse.ok) throw new DingTalkProtocolError("钉钉本人信息读取失败");
    const profile = (await profileResponse.json()) as ProfileResponse;
    if (!profile.unionId) throw new DingTalkProtocolError("钉钉身份缺少稳定引用");
    return { unionId: profile.unionId };
  }
}
