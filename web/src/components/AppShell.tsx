import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSession } from '../api'

export function AppShell({ children, active = 'batches' }: { children: ReactNode; active?: string }) {
  const session = useQuery({ queryKey: ['session'], queryFn: ({ signal }) => getSession(signal) })
  const workbench = session.data?.user.role === 'supervisor' ? '/workbench/supervisor' : '/workbench/operations'
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="side-brand" href="/"><span className="brand-mark">趣</span><span><strong>趣然经营决策</strong><small>利润控制台</small></span></a>
      <nav aria-label="主导航">
        <a className={active === 'workbench' ? 'active' : ''} href={workbench}>我的工作台</a>
        <a className={active === 'batches' ? 'active' : ''} href="/batches">数据批次</a>
        <a className={active === 'actions' ? 'active' : ''} href="/actions">行动中心</a>
        <a href="/history">历史追溯</a>
      </nav>
      <p className="sidebar-note">固定规则形成结论<br />AI 仅辅助解释</p>
    </aside>
    <div className="app-column">
      <header className="app-topbar"><span>玩具事业部</span><span>{session.data ? `${session.data.user.name} · ${session.data.user.role === 'supervisor' ? '运营主管' : '运营'}` : '正在确认身份'}</span></header>
      <main className="app-main">{children}</main>
    </div>
  </div>
}
