import { ArrowLeft, Info, LockKey, ShieldSlash, SquaresFour } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import type { CurrentUser } from "../api";

export function ForbiddenPage({ user }: { user: CurrentUser }) {
  const navigate = useNavigate();
  return (
    <AppShell user={user}>
      <div className="breadcrumb">当前角色 / 安全访问 / <span>权限不足</span></div>
      <div className="center-stage" data-page-id="PAGE-F07-02">
        <section className="forbidden-card">
          <span className="forbidden-icon"><ShieldSlash /></span>
          <p className="eyebrow eyebrow--danger">访问已安全终止</p>
          <h1>权限不足</h1>
          <p className="forbidden-card__lead">当前业务角色无法访问此内容。为保护经营数据，本页面不会显示目标对象的身份、状态或任何受限字段。</p>
          <div className="info-card info-card--warm"><Info /><div><strong>你可以继续处理已有权限的任务</strong><p>如工作职责已发生变化，请按公司流程由事业部负责人审批，并联系 IT 更新业务角色。</p></div></div>
          <div className="button-row">
            <button className="button button--secondary" onClick={() => history.back()}><ArrowLeft />返回上一页</button>
            <button className="button button--primary" onClick={() => navigate({ to: "/" })}><SquaresFour />回到我的工作台</button>
          </div>
          <div className="security-note"><LockKey />本次拒绝已按安全策略记录；不会改变任何业务状态</div>
        </section>
      </div>
    </AppShell>
  );
}
