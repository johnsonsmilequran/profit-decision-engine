import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getSession, logout } from '../api'

export function AppShell({ children, active = 'batches' }: { children: ReactNode; active?: string }) {
  const session = useQuery({ queryKey: ['session'], queryFn: ({ signal }) => getSession(signal) })
  const [copyFeedback, setCopyFeedback] = useState('')
  const logoutRequest = useMutation({ mutationFn: logout })
  const workbench = session.data?.user.role === 'supervisor' ? '/workbench/supervisor' : '/workbench/operations'
  const copyUnionID = async () => {
    if (!session.data) return
    await navigator.clipboard.writeText(session.data.user.union_id)
    setCopyFeedback('已复制')
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="side-brand" href="/"><span className="brand-mark">趣</span><span><strong>趣然经营决策</strong><small>利润控制台</small></span></a>
      <nav aria-label="主导航">
        <a className={active === 'workbench' ? 'active' : ''} href={workbench}>我的工作台</a>
        <a className={active === 'batches' ? 'active' : ''} href="/batches">数据批次</a>
        <a className={active === 'actions' ? 'active' : ''} href="/actions">行动中心</a>
        <a className={active === 'history' ? 'active' : ''} href="/history">历史追溯</a>
        {session.data?.user.role === 'supervisor' ? <a className={active === 'roles' ? 'active' : ''} href="/admin/roles">用户角色</a> : null}
      </nav>
      <p className="sidebar-note">固定规则形成结论<br />AI 仅辅助解释</p>
    </aside>
    <div className="app-column">
      <header className="app-topbar"><span>玩具事业部</span>{session.data ? <details className="account-menu"><summary>{session.data.user.name} · {session.data.user.role === 'supervisor' ? '运营主管' : '运营'}</summary><div className="account-popover"><span>当前钉钉 unionId</span><code>{session.data.user.union_id}</code><div><button className="button" type="button" onClick={copyUnionID}>复制 unionId</button><button className="button" type="button" disabled={logoutRequest.isPending} onClick={() => logoutRequest.mutate()}>{logoutRequest.isPending ? '退出中…' : '退出登录'}</button></div>{copyFeedback ? <small role="status">{copyFeedback}</small> : null}{logoutRequest.isError ? <small role="alert">退出失败，请重试。</small> : null}</div></details> : <span>正在确认身份</span>}</header>
      <main className="app-main">{children}</main>
    </div>
  </div>
}
