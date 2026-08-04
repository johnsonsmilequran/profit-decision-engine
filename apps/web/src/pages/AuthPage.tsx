import { GitBranch, Headset, IdentificationCard, ShieldCheck, SignIn, TrendUp } from "@phosphor-icons/react";
import { useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { dingtalkStartUrl } from "../api";

const feedback = {
  failed: "钉钉认证未完成，请重新认证。",
  role_missing: "未配置有效业务角色，请联系 IT。",
  unavailable: "身份服务暂不可用，请稍后重新认证。",
} as const;

export function AuthPage() {
  const search = useSearch({ strict: false }) as { status?: keyof typeof feedback; return_to?: string };
  const [submitting, setSubmitting] = useState(false);
  const message = search.status ? feedback[search.status] : undefined;

  function startAuthentication() {
    setSubmitting(true);
    window.location.assign(dingtalkStartUrl(search.return_to ?? "/workspace"));
  }

  return (
    <main className="auth-layout" data-page-id="PAGE-F07-01">
      <section className="auth-story">
        <div className="brand">
          <span className="brand__mark"><TrendUp weight="bold" /></span>
          <span><strong>趣然经营助手</strong><small>玩具事业部 · 内部系统</small></span>
        </div>
        <div className="auth-story__content">
          <p className="eyebrow">经营事实 · 固定规则 · 协同执行</p>
          <h1>让每条利润判断，<br />都与库存动作并轨。</h1>
          <p className="lead">每周导入 SPU 经营数据，由固定规则形成唯一行动清单；运营主管整体审核，运营与采购计划分别执行并留痕。</p>
          <div className="decision-rail" aria-label="利润库存双轨决策带">
            <div><small>经营动作</small><strong className="danger">SPU 推广止损</strong></div>
            <GitBranch aria-hidden="true" />
            <div className="decision-rail__warn"><small>补货动作</small><strong className="warn">禁止补货</strong></div>
          </div>
        </div>
        <small>仅限公司内部授权人员使用 · 经营动作由固定规则判定，AI 仅负责解释</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="feature-icon"><IdentificationCard /></span>
          <h2>使用公司身份进入</h2>
          <p>系统仅使用钉钉统一身份认证。完成认证后，将按 IT 配置的唯一业务角色进入对应工作台。</p>
          <button className="button button--primary button--wide" disabled={submitting} onClick={startAuthentication}>
            <SignIn />{submitting ? "正在前往钉钉…" : message ? "重新发起钉钉认证" : "使用钉钉认证"}
          </button>
          {(submitting || message) && <div className={`notice ${message ? "notice--error" : ""}`} role="status">{message ?? "正在建立安全认证会话，请在钉钉完成身份确认。"}</div>}
          <div className="info-card"><ShieldCheck /><div><strong>角色由公司统一维护</strong><p>事业部负责人审批，IT/运维配置运营、运营主管或采购计划角色。产品不提供账号密码、注册或角色自助选择。</p></div></div>
          <div className="auth-help"><p>认证失败、登录态失效或未配置有效角色时，系统不会返回任何经营数据。</p><span><Headset />需要帮助？联系 IT 支持</span></div>
        </div>
      </section>
    </main>
  );
}
