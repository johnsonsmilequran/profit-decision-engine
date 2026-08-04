import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listActions, type ActionFilters } from '../api'
import { AppShell } from '../components/AppShell'
import { ActionTable } from '../components/ActionTable'

function initialFilters(): ActionFilters {
  const query = new URLSearchParams(window.location.search)
  return { search: query.get('search') ?? '', action: query.get('action') ?? '', reviewStatus: query.get('review_status') ?? '', businessState: query.get('business_state') ?? '', page: Number(query.get('page')) || 1, limit: Number(query.get('limit')) || 50 }
}

export function ActionListPage() {
  const [filters, setFilters] = useState<ActionFilters>(initialFilters)
  const query = useQuery({ queryKey: ['actions', filters], queryFn: ({ signal }) => listActions(filters, signal) })
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search',filters.search)
    if (filters.action) params.set('action',filters.action)
    if (filters.reviewStatus) params.set('review_status',filters.reviewStatus)
    if (filters.businessState) params.set('business_state',filters.businessState)
    params.set('page',String(filters.page)); params.set('limit',String(filters.limit))
    window.history.replaceState(null,'',`${window.location.pathname}?${params}`)
  },[filters])
  const pages = Math.max(1,Math.ceil((query.data?.total ?? 0)/filters.limit))
  const update = (part: Partial<ActionFilters>) => setFilters(value => ({ ...value, ...part, page: part.page ?? 1 }))
  return <AppShell active="actions"><section data-page-id="PAGE-F05-02">
    <div className="page-heading"><div><p className="overline">行动中心</p><h1>本周行动清单</h1><p className="muted">默认读取最新成功批次；固定规则排序，AI 不改变动作层级。</p></div></div>
    <div className="panel filter-panel"><label>搜索 SPU<input value={filters.search} placeholder="SPU ID 或名称" onChange={event => update({ search:event.target.value })} /></label><label>主动作<select value={filters.action} onChange={event => update({ action:event.target.value })}><option value="">全部</option><option value="clearance">清仓</option><option value="stop_loss">止损</option><option value="observe">观察</option><option value="invest">加投</option></select></label><label>审核状态<select value={filters.reviewStatus} onChange={event => update({ reviewStatus:event.target.value })}><option value="">全部</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select></label><label>经营状态<select value={filters.businessState} onChange={event => update({ businessState:event.target.value })}><option value="">全部</option><option value="pending_review">待审核</option><option value="pending_execution">待执行</option><option value="executed">已执行</option><option value="result_recorded">已记录结果</option><option value="closed">已关闭</option></select></label></div>
    <div className="panel table-panel">{query.isPending ? <State title="正在加载行动清单" body="正在读取当前筛选对应的持久化任务。" /> : query.isError ? <State title="行动清单加载失败" body="网络失败不会显示为空清单。" action={<button className="button" onClick={() => query.refetch()}>重试</button>} /> : <ActionTable items={query.data?.items ?? []} />}
      <footer className="pagination"><label>每页 <select value={filters.limit} onChange={event => update({ limit:Number(event.target.value) })}><option>20</option><option>50</option><option>100</option></select></label><span>共 {query.data?.total ?? 0} 条 · 第 {filters.page}/{pages} 页</span><button disabled={filters.page<=1} onClick={() => update({ page:filters.page-1 })}>上一页</button><button disabled={filters.page>=pages} onClick={() => update({ page:filters.page+1 })}>下一页</button></footer>
    </div>
  </section></AppShell>
}
function State({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="empty-state"><strong>{title}</strong><p>{body}</p>{action}</div> }
