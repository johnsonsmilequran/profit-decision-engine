import {
  CheckCircleFilled,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Alert, Button, Space } from "antd";
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
      <div className="login-frame">
        <section className="login-brand">
          <div className="login-logo">
            <span>趣然</span>
            <strong>AI 商品经营利润决策助手</strong>
          </div>
          <div className="login-copy">
            <div className="login-eyebrow">统一经营语言 · 共用事实来源</div>
            <h1>
              让每一条经营建议，
              <br />
              都有依据、有责任、有结果
            </h1>
            <p>
              汇总玩具事业部 SPU
              经营数据，用固定规则生成利润与库存行动，让运营、主管与采购在同一事实源上协作。
            </p>
            <div className="login-proof">
              <div>
                <b>01</b>
                <span>
                  <strong>规则固定</strong>利润、库存与动作口径一致
                </span>
              </div>
              <div>
                <b>02</b>
                <span>
                  <strong>责任清晰</strong>审核、经营、采购分轨协作
                </span>
              </div>
              <div>
                <b>03</b>
                <span>
                  <strong>全程可追溯</strong>批次、规则和结果完整留痕
                </span>
              </div>
            </div>
          </div>
          <footer>仅供趣然电商授权员工使用 · 身份与权限由公司统一管理</footer>
        </section>
        <section className="login-panel">
          <div className="login-panel-inner">
            <div className="auth-badge">
              <SafetyCertificateOutlined /> 公司统一身份认证
            </div>
            <h2>欢迎回来</h2>
            <p className="login-intro">
              登录后即可查看与你岗位相关的经营建议、审核任务与执行结果。
            </p>
            <div className="login-card">
              <div className="login-card-heading">
                <div className="login-lock">
                  <LockOutlined />
                </div>
                <div>
                  <strong>使用钉钉安全登录</strong>
                  <span>无需输入账号密码</span>
                </div>
              </div>
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
                  <Alert
                    type="error"
                    showIcon
                    message={error}
                    description={status?.support_guidance}
                  />
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
              <div className="login-guides">
                <div>
                  <CheckCircleFilled />
                  <span>
                    <strong>身份自动校验</strong>使用本人钉钉，无需选择角色
                  </span>
                </div>
                <div>
                  <TeamOutlined />
                  <span>
                    <strong>岗位权限同步</strong>运营、主管和采购由 IT 统一维护
                  </span>
                </div>
              </div>
            </div>
            <div className="login-support">
              <SafetyCertificateOutlined />
              <span>
                <strong>数据访问受保护</strong>
                完成认证与角色校验前，不返回任何经营数据。登录异常请联系 IT 支持。
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
