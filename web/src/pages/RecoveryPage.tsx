const states = {
  auth_failed: { title: '未能完成身份认证', body: '本次钉钉认证没有建立有效登录状态，请重新认证。', action: '重新使用钉钉认证' },
  session_expired: { title: '登录状态已失效', body: '为保护经营数据，请重新确认本人身份后继续。', action: '重新认证并返回' },
  no_role: { title: '当前身份尚未配置业务角色', body: '系统已确认身份，但没有找到唯一有效角色。请联系运维或系统管理员核对审批配置。', action: '重新确认身份' },
  forbidden: { title: '当前身份无法访问此内容', body: '系统不会展示目标对象的任何信息。请返回本人工作台继续。', action: '返回我的工作台' },
  network: { title: '认证服务暂时不可用', body: '当前无法连接钉钉认证服务，请稍后重试或联系运维。', action: '重新尝试' },
} as const

export function RecoveryPage() {
  const params = new URLSearchParams(window.location.search)
  const key = params.get('reason') as keyof typeof states | null
  const state = key && states[key] ? states[key] : states.auth_failed
  const returnTo = params.get('return_to') ?? '/'
  const act = () => {
    if (key === 'forbidden') window.location.assign('/')
    else window.location.assign(`/auth/dingtalk/start?return_to=${encodeURIComponent(returnTo)}`)
  }
  return (
    <main className="recovery-shell" data-page-id="PAGE-F07-02">
      <header className="auth-topbar"><div className="brand"><span className="brand-mark">趣</span><span><strong>趣然 AI 商品经营与利润决策助手</strong><small>受控身份恢复</small></span></div><span className="internal-chip">受保护页面</span></header>
      <section className="recovery-panel">
        <article><span className="warning-icon">!</span><p className="overline">身份恢复</p><h1>{state.title}</h1><p className="muted lead">{state.body}</p><button className="primary" onClick={act}>{state.action}</button></article>
        <aside><h2>你的经营数据仍受保护</h2><p>完成身份和权限复核前，本页不会加载商品、建议、利润、库存或历史数据。</p><div className="security-note"><strong>需要帮助？</strong><span>请联系运维或系统管理员，并说明你当前使用的钉钉展示身份。</span></div></aside>
      </section>
    </main>
  )
}
