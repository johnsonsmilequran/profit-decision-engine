import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { getSession } from '../api'

export function LoginPage() {
  const [starting, setStarting] = useState(false)
  const [qrCode, setQrCode] = useState('')
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

  useEffect(() => {
    const authURL = new URL(authPath, window.location.origin).toString()
    void QRCode.toDataURL(authURL, { width: 176, margin: 1, color: { dark: '#122033', light: '#ffffff' } }).then(setQrCode)
  }, [authPath])

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
            <span className="eyebrow">INTERNAL DECISION WORKSPACE</span>
            <h1>让经营判断有统一依据，让每个动作找到负责人。</h1>
            <p>汇总玩具事业部的 SPU 经营数据，由固定规则形成行动建议，再由运营与运营主管完成审核、执行、OA 协同和结果确认。</p>
            <div className="decision-rails" aria-label="经营决策工作流程"><Rail icon="▣" label="数据批次" /><Rail icon="⌘" label="固定规则" /><Rail icon="☷" label="行动清单" /><Rail icon="↻" label="轻闭环" /></div>
          </div>
          <p className="story-note"><span aria-hidden="true">✓</span>固定规则决定商品类型与动作，AI 只负责解释；每周数据批次与后续状态均可追溯。</p>
        </article>
        <article className="auth-card auth-panel">
          <p className="overline">统一身份认证</p>
          <h2>{session.isPending ? '正在检查登录状态' : '使用钉钉安全进入'}</h2>
          <p className="muted">请使用本人的钉钉身份完成确认，系统将按已审批配置开放相应功能。</p>
          <div className="auth-status"><span aria-hidden="true" />普通浏览器 · 安全连接已就绪</div>
          {session.error && session.error.message !== 'unauthenticated' ? <div className="alert">暂时无法检查登录状态，请稍后重试。</div> : null}
          <div className="auth-content">
            <div className="qr-shell">{qrCode ? <img src={qrCode} alt="钉钉登录二维码" /> : <span className="qr-loading">正在生成安全登录入口</span>}</div>
            <p className="scan-copy">请使用本人钉钉扫码并完成确认</p>
            <p className="scan-meta">认证成功后将直接进入你有权访问的工作台</p>
            <div className="auth-divider" aria-hidden="true">或</div>
            <button className="primary" type="button" onClick={start} disabled={starting || session.isPending}>{starting ? '正在前往钉钉…' : '使用钉钉登录'}</button>
            <p className="auth-feedback" aria-live="polite">无需填写其他信息</p>
          </div>
          <div className="trust-list"><Trust title="本人身份" body="每位用户使用自己的钉钉身份进入" /><Trust title="审批配置" body="业务权限依据已审批配置自动生效" /><Trust title="最小可见" body="仅开放当前职责所需的数据与功能" /></div>
          <p className="auth-footnote">继续即表示使用当前钉钉身份进入趣然内部系统。认证完成前，本页面不会展示任何经营数据。</p>
        </article>
      </section>
    </main>
  )
}

function Brand() { return <div className="brand"><span className="brand-mark">趣</span><span><strong>趣然经营决策</strong><small>AI 商品经营与利润决策助手</small></span></div> }
function Rail({ icon, label }: { icon: string; label: string }) { return <div className="rail-node"><span className="rail-icon" aria-hidden="true">{icon}</span><span>{label}</span></div> }
function Trust({ title, body }: { title: string; body: string }) { return <div className="trust-item"><strong>{title}</strong><span>{body}</span></div> }
