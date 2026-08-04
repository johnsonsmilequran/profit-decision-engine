import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSession } from '../api'

export function LoginPage() {
  const [starting, setStarting] = useState(false)
  const session = useQuery({ queryKey: ['session'], queryFn: ({ signal }) => getSession(signal) })
  const requested = new URLSearchParams(window.location.search).get('return_to') ?? '/'

  useEffect(() => {
    if (session.data) {
      const fallback = session.data.user.role === 'supervisor' ? '/workbench/supervisor' : '/workbench/operations'
      const target = requested !== '/' && requested.startsWith('/') && !requested.startsWith('//') ? requested : fallback
      window.location.replace(target)
    }
  }, [requested, session.data])

  const start = () => {
    setStarting(true)
    window.location.assign(`/auth/dingtalk/start?return_to=${encodeURIComponent(requested)}`)
  }

  return (
    <main className="auth-shell" data-page-id="PAGE-F07-01">
      <header className="auth-topbar"><Brand /><span className="internal-chip">仅供趣然内部使用</span></header>
      <section className="login-frame">
        <article className="story-panel">
          <span className="eyebrow">经营事实 · 固定规则 · 行动闭环</span>
          <h1>让每个利润风险，都有明确的下一步</h1>
          <p>把周度 SPU 数据变成可审核、可执行、可追溯的经营行动。固定规则决定结论，AI 只负责解释。</p>
          <div className="feature-grid"><Feature title="统一事实" body="批次、期间与规则版本全程可追溯" /><Feature title="双轨联动" body="经营动作与库存协同从同一证据出发" /><Feature title="责任闭环" body="运营执行，主管审核并确认关键事实" /></div>
        </article>
        <article className="auth-card">
          <span className="state-icon" aria-hidden="true">钉</span>
          <p className="overline">统一身份认证</p>
          <h2>{session.isPending ? '正在检查登录状态' : '使用钉钉确认身份'}</h2>
          <p className="muted">系统将按事业部负责人审批、运维配置的唯一有效角色进入对应工作台。</p>
          {session.error && session.error.message !== 'unauthenticated' ? <div className="alert">暂时无法检查登录状态，请稍后重试。</div> : null}
          <button className="primary" type="button" onClick={start} disabled={starting || session.isPending}>{starting ? '正在前往钉钉…' : '使用钉钉登录'}</button>
          <div className="security-note"><strong>本人身份</strong><span>请使用本人的钉钉身份进入，不支持共享账号、账号密码或自行选择角色。</span></div>
        </article>
      </section>
    </main>
  )
}

function Brand() { return <div className="brand"><span className="brand-mark">趣</span><span><strong>趣然 AI 商品经营与利润决策助手</strong><small>商品经营控制台</small></span></div> }
function Feature({ title, body }: { title: string; body: string }) { return <div className="feature"><span>✓</span><div><strong>{title}</strong><p>{body}</p></div></div> }
