import { SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Space } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "wouter";

import { ApiError, api } from "../api";
import { useAuth } from "../components/AuthContext";

export function LoginPage() {
  const { status, loading } = useAuth();
  const [, navigate] = useLocation();
  const [params] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const sessionExpired = params.get("reason") === "session";
  const callbackFailed = params.get("error") === "auth";

  useEffect(() => {
    if (!loading && status?.authenticated) navigate("/workspace", { replace: true });
  }, [loading, navigate, status?.authenticated]);

  async function login() {
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ authorization_url: string }>("/auth/login", { method: "POST" });
      window.location.assign(result.authorization_url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "暂时无法发起钉钉登录。");
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-brand">
        <div className="login-mark">QR</div>
        <div className="login-copy">
          <h1>
            让每一个商品决策
            <br />
            有依据、有行动、有追溯
          </h1>
          <p>
            汇总玩具事业部 SPU
            经营数据，由固定规则生成利润与库存行动，让运营、主管与采购在同一事实源上协作。
          </p>
          <div className="login-proof">
            <div>
              固定规则决策
              <br />
              AI 只做解释
            </div>
            <div>
              整体审核
              <br />
              双动作分轨执行
            </div>
            <div>
              批次与规则快照
              <br />
              全程可追溯
            </div>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <Card className="login-card">
          <SafetyCertificateOutlined style={{ color: "#075ead", fontSize: 32, marginBottom: 18 }} />
          <h2>使用公司身份登录</h2>
          <p className="muted">
            请使用本人钉钉身份。运营、运营主管和采购计划角色由 IT 统一维护，产品内不可自行选择。
          </p>
          <Space direction="vertical" size={14} style={{ width: "100%", marginTop: 22 }}>
            {sessionExpired ? (
              <Alert type="warning" showIcon message="登录状态已失效，请重新使用钉钉登录。" />
            ) : null}
            {callbackFailed ? (
              <Alert
                type="error"
                showIcon
                message="暂时无法完成钉钉登录，请重新尝试。"
                description={status?.support_guidance}
              />
            ) : null}
            {error ? (
              <Alert type="error" showIcon message={error} description={status?.support_guidance} />
            ) : null}
            {!loading && status?.dingtalk_ready === false ? (
              <Alert
                type="info"
                showIcon
                message="钉钉登录尚未完成部署配置"
                description={status.support_guidance}
              />
            ) : null}
            <Button
              type="primary"
              size="large"
              block
              loading={submitting || loading}
              onClick={() => void login()}
            >
              使用钉钉登录
            </Button>
          </Space>
          <div className="login-footer">
            完成有效认证与角色校验前，系统不会返回任何商品、批次、销售或利润数据。
          </div>
        </Card>
      </section>
    </div>
  );
}
