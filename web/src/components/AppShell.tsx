import type { ReactNode } from 'react'

export function AppShell({ children, active = 'batches' }: { children: ReactNode; active?: string }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="side-brand" href="/"><span className="brand-mark">趣</span><span><strong>趣然经营决策</strong><small>利润控制台</small></span></a>
      <nav aria-label="主导航">
        <a href="/workbench/operations">运营工作台</a>
        <a href="/workbench/supervisor">主管工作台</a>
        <a className={active === 'batches' ? 'active' : ''} href="/batches">数据批次</a>
        <a href="/actions">行动中心</a>
        <a href="/history">历史追溯</a>
      </nav>
      <p className="sidebar-note">固定规则形成结论<br />AI 仅辅助解释</p>
    </aside>
    <div className="app-column">
      <header className="app-topbar"><span>玩具事业部</span><span className="internal-chip">内部经营系统</span></header>
      <main className="app-main">{children}</main>
    </div>
  </div>
}
