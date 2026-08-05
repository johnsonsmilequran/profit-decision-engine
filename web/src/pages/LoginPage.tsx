import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSession } from '../api'

export function LoginPage() {
  const [starting, setStarting] = useState(false)
  const session = useQuery({ queryKey: ['session'], queryFn: ({ signal }) => getSession(signal) })
  const requested = new URLSearchParams(window.location.search).get('return_to') ?? '/'
  const authPath = `/auth/dingtalk/start?return_to=${encodeURIComponent(requested)}`

  useEffect(() => {
    if (session.data) {
      const fallback = session.data.user.role === 'supervisor' ? '/workbench/supervisor' : '/workbench/operations'
      const target = requested !== '/' && requested.startsWith('/') && !requested.startsWith('//') ? requested : fallback
      window.location.replace(target)
    }
  }, [requested, session.data])

  const start = () => {
    setStarting(true)
    window.location.assign(authPath)
  }

  return (
    <main className="auth-shell" data-page-id="PAGE-F07-01">
      <header className="auth-topbar"><Brand /><span className="internal-chip">仅供趣然内部经营协作使用</span></header>
      <section className="login-frame">
        <article className="story-panel">
          <div>
            <span className="eyebrow"><LoginIcon name="shield" />INTERNAL DECISION WORKSPACE</span>
            <h1>让经营判断有统一依据，让每个动作找到负责人。</h1>
            <p>汇总玩具事业部的 SPU 经营数据，由固定规则形成行动建议，再由运营与运营主管完成审核、执行、钉钉协同和结果确认。</p>
            <div className="decision-rails" aria-label="经营决策工作流程"><Rail icon="database" label="数据批次" /><Rail icon="branch" label="固定规则" /><Rail icon="list" label="行动清单" /><Rail icon="cycle" label="轻闭环" /></div>
          </div>
          <p className="story-note"><LoginIcon name="checkCircle" />固定规则决定商品类型与动作，AI 只负责解释；每周数据批次与后续状态均可追溯。</p>
        </article>
        <article className="auth-card auth-panel">
          <p className="overline">统一身份认证</p>
          <h2>{session.isPending ? '正在检查登录状态' : '使用钉钉安全进入'}</h2>
          <p className="muted">请使用本人的钉钉身份完成确认，系统将按已审批配置开放相应功能。</p>
          <div className="auth-status"><span aria-hidden="true" />普通浏览器 · 安全连接已就绪</div>
          {session.error && session.error.message !== 'unauthenticated' ? <div className="alert">暂时无法检查登录状态，请稍后重试。</div> : null}
          <div className="auth-content">
            <div className="click-login-note">
              <span className="click-login-icon" aria-hidden="true"><LoginIcon name="userCheck" /></span>
              <span><strong>使用本人钉钉身份</strong><small>点击后前往钉钉授权页，完成确认后进入你有权访问的工作台。</small></span>
            </div>
            <button className="primary" type="button" onClick={start} disabled={starting || session.isPending}>{starting ? null : <LoginIcon name="signIn" />}{starting ? '正在前往钉钉…' : '使用钉钉登录'}</button>
            <p className="auth-feedback" aria-live="polite">无需填写其他信息</p>
          </div>
          <div className="trust-list"><Trust icon="userCheck" title="本人身份" body="每位用户使用自己的钉钉身份进入" /><Trust icon="sealCheck" title="审批配置" body="业务权限依据已审批配置自动生效" /><Trust icon="lock" title="最小可见" body="仅开放当前职责所需的数据与功能" /></div>
          <p className="auth-footnote"><LoginIcon name="info" />继续即表示使用当前钉钉身份进入趣然内部系统。认证完成前，本页面不会展示任何经营数据。</p>
        </article>
      </section>
    </main>
  )
}

function Brand() { return <div className="brand"><span className="brand-mark"><LoginIcon name="chart" /></span><span><strong>趣然经营决策</strong><small>AI 商品经营与利润决策助手</small></span></div> }
function Rail({ icon, label }: { icon: 'database' | 'branch' | 'list' | 'cycle'; label: string }) { return <div className="rail-node"><span className="rail-icon" aria-hidden="true"><RailIcon name={icon} /></span><span>{label}</span></div> }
function RailIcon({ name }: { name: 'database' | 'branch' | 'list' | 'cycle' }) {
  const paths = {
    database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    branch: <><circle cx="7" cy="5" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="7" cy="19" r="2" /><path d="M7 7v10M9 11h3a5 5 0 0 0 5-2" /></>,
    list: <><path d="m5 6 1.5 1.5L9 5M5 12l1.5 1.5L9 11M5 18l1.5 1.5L9 17M12 6h7M12 12h7M12 18h7" /></>,
    cycle: <><path d="M19 7V3l-2 2a8 8 0 0 0-12 3M5 17v4l2-2a8 8 0 0 0 12-3" /></>,
  }
  return <svg viewBox="0 0 24 24" focusable="false">{paths[name]}</svg>
}
type LoginIconName = 'chart' | 'shield' | 'checkCircle' | 'userCheck' | 'signIn' | 'sealCheck' | 'lock' | 'info'

function LoginIcon({ name }: { name: LoginIconName }) {
  const paths: Record<LoginIconName, React.ReactNode> = {
    chart: <><path d="M5 17V9M10 17V5M15 17v-4M4 19h16" /><path d="m5 11 5-5 4 4 5-5" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.4 2.8 7.8 7 10 4.2-2.2 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    userCheck: <><circle cx="10" cy="8" r="4" /><path d="M3.5 20c.8-4 3-6 6.5-6 1.4 0 2.6.3 3.6.9M16 17l2 2 3-4" /></>,
    signIn: <><path d="M14 5h5v14h-5M10 8l4 4-4 4M14 12H3" /></>,
    sealCheck: <><path d="m12 3 2 2.1 2.9-.1.8 2.8 2.3 1.7-1.1 2.7 1.1 2.7-2.3 1.7-.8 2.8-2.9-.1L12 21l-2-2.1-2.9.1-.8-2.8L4 14.5l1.1-2.7L4 9.1l2.3-1.7.8-2.8 2.9.1L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>
}

function Trust({ icon, title, body }: { icon: LoginIconName; title: string; body: string }) { return <div className="trust-item"><LoginIcon name={icon} /><strong>{title}</strong><span>{body}</span></div> }
