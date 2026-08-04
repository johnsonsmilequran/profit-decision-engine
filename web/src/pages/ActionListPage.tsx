import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { listActions, listBatches, type ActionFilters } from '../api'
import { AppShell } from '../components/AppShell'
import { ActionTable } from '../components/ActionTable'

function initialFilters(): ActionFilters {
  const query = new URLSearchParams(window.location.search)
  const rawTab = query.get('tab')
  const tab = rawTab === 'all' || rawTab === 'processing' || rawTab === 'completed' ? rawTab : 'mine'
  return {
    batchId: query.get('batch_id') ?? '', tab, search: query.get('search') ?? '', action: query.get('action') ?? '',
    store: query.get('store') ?? '', operator: query.get('operator') ?? '', reviewStatus: query.get('review_status') ?? '',
    businessState: query.get('business_state') ?? '', inventoryState: query.get('inventory_state') ?? '',
    clearanceStatus: query.get('clearance_status') ?? '', progress: query.get('progress') ?? '',
    page: Number(query.get('page')) || 1, limit: Number(query.get('limit')) || 50,
  }
}

const tabs = [
  { value: 'mine', label: '待我处理' }, { value: 'all', label: '全部' },
  { value: 'processing', label: '处理中' }, { value: 'completed', label: '已完成' },
] as const

export function ActionListPage() {
  const [filters, setFilters] = useState<ActionFilters>(initialFilters)
  const query = useQuery({ queryKey: ['actions', filters], queryFn: ({ signal }) => listActions(filters, signal) })
  const batchQuery = useQuery({ queryKey: ['batches', 'action-list'], queryFn: ({ signal }) => listBatches(1, 100, '', signal) })
  const countQueries = useQueries({ queries: tabs.map(tab => ({
    queryKey: ['action-count', tab.value, filters.batchId, filters.search, filters.action, filters.store, filters.operator, filters.reviewStatus, filters.businessState, filters.inventoryState, filters.clearanceStatus, filters.progress],
    queryFn: ({ signal }: { signal: AbortSignal }) => listActions({ ...filters, tab: tab.value, page: 1, limit: 20 }, signal),
  })) })
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.batchId) params.set('batch_id', filters.batchId)
    params.set('tab', filters.tab)
    if (filters.search) params.set('search',filters.search)
    if (filters.action) params.set('action',filters.action)
    if (filters.store) params.set('store', filters.store)
    if (filters.operator) params.set('operator', filters.operator)
    if (filters.reviewStatus) params.set('review_status',filters.reviewStatus)
    if (filters.businessState) params.set('business_state',filters.businessState)
    if (filters.inventoryState) params.set('inventory_state', filters.inventoryState)
    if (filters.clearanceStatus) params.set('clearance_status', filters.clearanceStatus)
    if (filters.progress) params.set('progress', filters.progress)
    params.set('page',String(filters.page)); params.set('limit',String(filters.limit))
    window.history.replaceState(null,'',`${window.location.pathname}?${params}`)
  },[filters])
  const pages = Math.max(1,Math.ceil((query.data?.total ?? 0)/filters.limit))
  const update = (part: Partial<ActionFilters>) => setFilters(value => ({ ...value, ...part, page: part.page ?? 1 }))
  const readyBatches = (batchQuery.data?.items ?? []).filter(batch => batch.status === 'ready')
  const historical = Boolean(filters.batchId && readyBatches[0] && filters.batchId !== readyBatches[0].id)
  const newestBatch = batchQuery.data?.items[0]
  const activeBatch = filters.batchId ? readyBatches.find(batch => batch.id === filters.batchId) : readyBatches[0]
  const hasNarrowing = Boolean(filters.search || filters.action || filters.store || filters.operator || filters.reviewStatus || filters.businessState || filters.inventoryState || filters.clearanceStatus || filters.progress)
  const clearFilters = () => update({ search: '', action: '', store: '', operator: '', reviewStatus: '', businessState: '', inventoryState: '', clearanceStatus: '', progress: '' })
  return <AppShell active="actions"><section data-page-id="PAGE-F05-02">
    <div className="page-heading"><div><p className="overline">行动中心 · {historical ? '历史批次' : '最新成功批次'}</p><h1>行动清单</h1><p className="muted">按固定动作优先级查看本人待办，核对同一 SPU 的经营动作、库存动作、关键依据和处理进度。</p></div><label>查看批次<select value={filters.batchId} onChange={event => update({ batchId: event.target.value })}><option value="">最新成功批次</option>{readyBatches.map(batch => <option key={batch.id} value={batch.id}>{batch.code} · {batch.period_start.slice(0, 7)}</option>)}</select></label></div>
    {activeBatch ? <section className="panel action-batch-context"><div><p className="overline">当前清单批次</p><h2>{activeBatch.code}</h2><span className="status status-ready">{historical ? '历史只读' : '最新成功'}</span></div><dl><div><dt>业务期间</dt><dd>{shortDate(activeBatch.period_start)} 至 {shortDate(activeBatch.period_end)}</dd></div><div><dt>业务截止日</dt><dd>{activeBatch.business_cutoff_date}</dd></div><div><dt>规则版本</dt><dd>{activeBatch.rule_version ?? '—'}</dd></div><div><dt>最后更新</dt><dd>{activeBatch.completed_at ? dateTime(activeBatch.completed_at) : dateTime(activeBatch.created_at)}</dd></div></dl></section> : null}
    <div className="rule-banner"><div><strong>固定规则先给出结论</strong><p>商品类型、动作与阈值来自本批次固定规则；同一 SPU 本周动作未变时沿用原任务和状态，不重复建任。AI 等待或失败不影响清单与执行。</p></div><span>不支持批量操作，请逐条查看建议</span></div>
    {newestBatch && newestBatch.status !== 'ready' && !filters.batchId ? <div className="notice warning">最新提交 {newestBatch.code} 当前为 {newestBatch.status === 'received' || newestBatch.status === 'processing' ? '规则处理中' : '处理失败'}；当前继续展示最近成功批次。</div> : null}
    {historical ? <div className="notice">当前为历史批次只读清单；进入详情后不提供审核、执行、结果或 AI 重试操作。</div> : null}
    <section className="panel action-list-panel"><div className="action-tabs-heading"><nav className="tabs" aria-label="行动范围">{tabs.map((tab, index) => <button key={tab.value} className={filters.tab === tab.value ? 'active' : ''} aria-pressed={filters.tab === tab.value} onClick={() => update({ tab: tab.value })}>{tab.label}<span>{countQueries[index].data?.total ?? '—'}</span></button>)}</nav><span>页签仅改变显示范围，不修改业务状态</span></div>
    <div className="filter-panel action-filter-strip">
      <label>搜索 SPU<input value={filters.search} placeholder="SPU ID 或名称" onChange={event => update({ search:event.target.value })} /></label>
      <label>动作<select value={filters.action} onChange={event => update({ action:event.target.value })}><option value="">全部</option><option value="clearance">清仓</option><option value="stop_loss">止损</option><option value="observe">观察</option><option value="invest">加投</option><option value="restock">补货</option><option value="prohibit_restock">禁补</option></select></label>
      <label>店铺<input value={filters.store} placeholder="完整店铺名称" onChange={event => update({ store: event.target.value })} /></label>
      <label>责任运营<input value={filters.operator} placeholder="姓名" onChange={event => update({ operator: event.target.value })} /></label>
      <label>审核状态<select value={filters.reviewStatus} onChange={event => update({ reviewStatus:event.target.value })}><option value="">全部</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select></label>
      <label>经营状态<select value={filters.businessState} onChange={event => update({ businessState:event.target.value })}><option value="">全部</option><option value="pending_review">待审核</option><option value="action_change_pending">变更待确认</option><option value="pending_execution">待执行</option><option value="awaiting_result">待记录结果</option><option value="result_recorded">已记录结果</option><option value="closed">已关闭</option><option value="terminated">已终止</option></select></label>
      <label>库存状态<select value={filters.inventoryState} onChange={event => update({ inventoryState:event.target.value })}><option value="">全部</option><option value="pending_review">待审核</option><option value="pending_execution">待执行</option><option value="processed">已执行 / 已确认禁补</option><option value="not_generated">未生成协同</option><option value="closed">已关闭</option><option value="terminated">已终止</option></select></label>
      <label>清仓确认<select value={filters.clearanceStatus} onChange={event => update({ clearanceStatus:event.target.value })}><option value="">全部</option><option value="not_submitted">待提交</option><option value="pending_confirmation">待主管确认</option><option value="returned">已退回待修正</option><option value="confirmed">已确认</option></select></label>
      <label>任务总进度<select value={filters.progress} onChange={event => update({ progress:event.target.value })}><option value="">全部</option><option value="pending_review">待审核</option><option value="pending_execution">待执行</option><option value="executing">执行中</option><option value="executed">已执行</option><option value="result_recorded">已记录结果</option><option value="rejected">已驳回</option></select></label>
      <button className="button subtle" type="button" disabled={!hasNarrowing} onClick={clearFilters}>清除条件</button>
    </div>
    <div className="priority-rail"><strong>固定排序</strong><span className="action action-clearance">清仓</span><b>›</b><span className="action action-stop_loss">止损</span><b>›</b><span className="action action-observe">观察</span><b>›</b><span className="action action-invest">加投</span><b>›</b><span className="action action-restock">补货</span><small>同层按已校验影响代理排序，否则按稳定 SPU ID</small></div>
    <div className="table-panel">{query.isPending ? <State title="正在加载行动清单" body="正在读取当前筛选对应的持久化任务。" /> : query.isError ? <State title="行动清单加载失败" body="网络失败不会显示为空清单。" action={<button className="button" onClick={() => query.refetch()}>重试</button>} /> : (query.data?.items.length ?? 0) === 0 ? <State title={hasNarrowing ? '当前条件无结果' : filters.tab === 'mine' ? '本批次暂无待我处理' : '当前范围没有行动'} body={hasNarrowing ? '清单加载成功，但没有匹配当前搜索与筛选的建议。' : '可切换其他页签查看已授权范围。'} action={hasNarrowing ? <button className="button" onClick={clearFilters}>清除条件</button> : undefined} /> : <ActionTable items={query.data?.items ?? []} historyMode={historical} detailed />}
      <footer className="pagination"><label>每页 <select value={filters.limit} onChange={event => update({ limit:Number(event.target.value) })}><option>20</option><option>50</option><option>100</option></select></label><span>共 {query.data?.total ?? 0} 条 · 第 {filters.page}/{pages} 页</span><button disabled={filters.page<=1} onClick={() => update({ page:filters.page-1 })}>上一页</button><button disabled={filters.page>=pages} onClick={() => update({ page:filters.page+1 })}>下一页</button></footer>
    </div></section>
  </section></AppShell>
}
function State({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="empty-state"><strong>{title}</strong><p>{body}</p>{action}</div> }
function shortDate(value: string) { return value.slice(5).replace('-', '—') }
function dateTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
