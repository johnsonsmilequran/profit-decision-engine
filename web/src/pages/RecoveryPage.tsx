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
      <header className="auth-topbar"><div className="brand"><span className="brand-mark">趣</span><span><strong>趣然 AI 商品经营与利润决策助手</strong><small>内部经营工作台</small></span></div><span className="internal-chip">安全认证</span></header>
      <section className="recovery-panel">
        <article className="recovery-summary">
          <span className="recovery-status">需要重新认证</span>
          <h1>{state.title}</h1>
          <p className="muted lead">{key === 'session_expired' ? '为保护受控信息，长时间未操作后当前会话已安全结束。完成钉钉认证后，系统会重新校验访问权限，并尝试返回您原先有权访问的位置。' : state.body}</p>
          <div className="return-notice"><span aria-hidden="true"><ReturnIcon /></span><div><strong>您的工作位置会被安全恢复</strong><p>只有原位置仍然可访问时才会返回；否则将进入当前身份可用的安全入口。</p></div></div>
          <ol className="recovery-steps"><Step number="01" title="完成钉钉身份认证" body="使用公司的统一身份入口重新确认当前身份。" /><Step number="02" title="重新校验访问权限" body="系统以认证完成时的最新权限结果进行检查。" /><Step number="03" title="返回安全位置" body="仅在原访问位置仍然安全且有权时恢复工作上下文。" /></ol>
        </article>
        <aside className="recovery-action">
          <span className="recovery-lock" aria-hidden="true"><UnlockIcon /></span>
          <p className="overline">SESSION RECOVERY</p>
          <h2>重新确认当前身份</h2>
          <p className="muted">点击后将通过钉钉发起一次新的身份认证。本页不会要求输入账号密码。</p>
          <button className="primary" onClick={act}>{state.action}</button>
          <p className="action-help">认证完成后仍会再次核验当前权限，不会直接进入受保护页面。</p>
          <div className="protected-note"><strong>受控信息已隐藏</strong><span>完成身份和权限复核前，本页不会加载商品、建议、利润、库存或历史数据。</span></div>
          <p className="contact-note">无法完成认证？请联系<strong>运维/系统管理员</strong>协助检查统一身份服务。</p>
        </aside>
      </section>
      <footer className="recovery-footer"><span><LockIcon />连接与身份信息受到保护</span><span>仅限公司内部授权访问</span></footer>
    </main>
  )
}

function Step({ number, title, body }: { number: string; title: string; body: string }) { return <li><span>{number}</span><div><strong>{title}</strong><p>{body}</p></div></li> }

function ReturnIcon() { return <svg viewBox="0 0 24 24" role="img" aria-label="返回"><path d="M9 7H5v-4M5.4 7.2A8 8 0 1 1 4 16" /></svg> }

function UnlockIcon() { return <svg viewBox="0 0 24 24" role="img" aria-label="安全恢复"><path d="M7 10V7a5 5 0 0 1 9.2-2.7M5 10h14v11H5zM12 14v3" /></svg> }

function LockIcon() { return <svg viewBox="0 0 24 24" role="img" aria-label="安全"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3" /></svg> }
