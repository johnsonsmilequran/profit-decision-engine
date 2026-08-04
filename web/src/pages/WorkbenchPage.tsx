import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getWorkbench, listActions, type ActionItem } from '../api'
import { AppShell } from '../components/AppShell'
import { ActionTable } from '../components/ActionTable'

export function WorkbenchPage({ expectedRole }: { expectedRole: 'operations' | 'supervisor' }) {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [businessState, setBusinessState] = useState('')
  const query = useQuery({ queryKey: ['workbench'], queryFn: ({ signal }) => getWorkbench(signal) })
  const supervisor = expectedRole === 'supervisor'
  const allItems = useQuery({
    queryKey: ['workbench-all', query.data?.latest_batch_id],
    enabled: supervisor && Boolean(query.data?.latest_batch_id),
    queryFn: ({ signal }) => listActions({ batchId: query.data?.latest_batch_id, tab: 'all', page: 1, limit: 100 }, signal),
  })
  const filteredItems = useMemo(() => query.data?.items.filter(item => {
    const matchesSearch = !search || item.spu_id.includes(search) || item.name.includes(search)
    const matchesAction = !action || item.effective_business_action === action || item.effective_inventory_action === action
    const matchesState = !businessState || item.business_state === businessState
    return matchesSearch && matchesAction && matchesState
  }).sort((left, right) => statePriority(left.business_state) - statePriority(right.business_state)) ?? [], [action, businessState, query.data, search])
  if (query.data && query.data.role !== expectedRole) {
    window.location.replace(query.data.role === 'supervisor' ? '/workbench/supervisor' : '/workbench/operations')
    return null
  }
  return <AppShell active="workbench"><section data-page-id={supervisor ? 'PAGE-F06-01' : 'PAGE-F05-01'}>
    <div className="page-heading"><div><p className="overline">{supervisor ? 'Supervisor Workspace' : 'Operations Workspace'}</p><h1>{supervisor ? '主管审核工作台' : '运营工作台'}</h1><p className="muted">{supervisor ? '聚焦待审核风险、清仓确认和协同异常，不在总览页批量拍板。' : '从当前批次进入本人经营动作、结果补录与清仓确认闭环。'}</p></div><div className="heading-actions"><button className="button" onClick={() => query.refetch()} disabled={query.isFetching}>{query.isFetching ? '刷新中…' : '刷新工作台'}</button>{!supervisor ? <a className="button" href="/batches/new">导入新批次</a> : null}<a className="button primary-button" href="/actions">全部行动</a></div></div>
    {query.isPending ? <State title="正在加载工作台" body="正在按当前身份读取真实任务。" /> : query.isError ? <State title="工作台加载失败" body="未显示任何可能过期的经营数据。" action={<button className="button" onClick={() => query.refetch()}>重新加载</button>} /> : query.data ? <>
      <BatchContext data={query.data} supervisor={supervisor} />
      <div className="stat-row">{supervisor ? <><Stat label="待审核建议" value={query.data.pending_review_count} tone="warn" /><Stat label="待确认清仓" value={query.data.clearance_confirm_count} tone="danger" /><Stat label="钉钉发送失败" value={query.data.notification_failure_count} tone="danger" /><Stat label="动作变化/冲突" value={query.data.exception_count} /></> : <><Stat label="待执行经营动作" value={query.data.pending_execution_count} tone="warn" /><Stat label="待补录结果" value={query.data.pending_result_count} /><Stat label="待主管确认清仓" value={query.data.clearance_confirm_count} tone="danger" /><Stat label="钉钉发送失败" value={query.data.notification_failure_count} tone="danger" /></>}</div>
      {supervisor ? <SupervisorOverview items={query.data.items} clearanceCount={query.data.clearance_confirm_count} notificationFailures={query.data.notification_failure_count} /> : <WorkbenchFilters search={search} setSearch={setSearch} action={action} setAction={setAction} businessState={businessState} setBusinessState={setBusinessState} />}
      {supervisor ? <><div className="panel section-panel"><div className="section-title"><div><h2>待审核建议</h2><p>按清仓、止损、观察、加投固定风险顺序展示；必须进入单条详情审核。</p></div><a className="button" href={`/actions?batch_id=${query.data.latest_batch_id}&review_status=pending`}>查看全部待审核</a></div><ActionTable items={query.data.items} /></div><div className="workbench-lower"><div className="panel section-panel"><h2>钉钉异常与任务去向</h2><div className={query.data.notification_failure_count ? 'notice warning' : 'success-note'}>{query.data.notification_failure_count ? `当前批次有 ${query.data.notification_failure_count} 条钉钉通知发送失败，业务状态未被自动推进。` : '当前批次没有钉钉发送异常。'}</div><p className="muted">动作变化 {query.data.exception_count} 条；并发冲突只追加审计，不覆盖已成功事实。</p><div className="heading-actions"><a className="table-link" href="/actions">进入行动中心</a><a className="table-link" href="/history">查看历史追溯</a></div></div><RecentReviews items={allItems.data?.items ?? []} /></div></> : <OperationsOverview items={filteredItems} data={query.data} />}
    </> : null}
  </section></AppShell>
}

function BatchContext({ data, supervisor }: { data: Awaited<ReturnType<typeof getWorkbench>>; supervisor: boolean }) {
  const first = data.items[0]
  return <section className="panel workbench-context"><div><span className="status status-ready">当前成功批次</span><h2>{data.latest_batch_code}</h2><p>{first ? `${first.period_start} 至 ${first.period_end} · 截止 ${first.business_cutoff_date} · ${first.rule_version}` : '批次清单已就绪，当前身份暂无匹配任务。'}</p></div><div className="workbench-flow"><span>数据导入<strong>运营 / 数据支持</strong></span><span>固定规则<strong>系统</strong></span><span>整体审核<strong>运营主管</strong></span><span>经营与协同<strong>责任运营</strong></span><span>结果与确认<strong>运营 / 主管</strong></span></div><a className="button" href={`/batches/${data.latest_batch_id}`}>{supervisor ? '查看冻结批次' : '查看批次详情'}</a></section>
}

function WorkbenchFilters({ search, setSearch, action, setAction, businessState, setBusinessState }: { search: string; setSearch: (value: string) => void; action: string; setAction: (value: string) => void; businessState: string; setBusinessState: (value: string) => void }) { return <div className="panel workbench-filters"><label>SPU ID / 名称<input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索本人任务" /></label><label>经营动作<select value={action} onChange={event => setAction(event.target.value)}><option value="">全部动作</option><option value="clearance">清仓</option><option value="stop_loss">止损</option><option value="observe">观察</option><option value="invest">加投</option></select></label><label>经营状态<select value={businessState} onChange={event => setBusinessState(event.target.value)}><option value="">全部经营状态</option><option value="pending_execution">待执行</option><option value="executed">待补录结果</option><option value="result_recorded">已记录结果</option><option value="closed">已关闭</option></select></label><button className="button" onClick={() => { setSearch(''); setAction(''); setBusinessState('') }}>清除条件</button></div> }

function SupervisorOverview({ items, clearanceCount, notificationFailures }: { items: ActionItem[]; clearanceCount: number; notificationFailures: number }) {
  const risks = ['clearance', 'stop_loss', 'observe', 'invest'].map(value => ({ value, count: items.filter(item => item.review_status === 'pending' && item.effective_business_action === value).length }))
  return <div className="supervisor-overview"><section className="panel clearance-card"><div><p className="overline">Clearance Confirmation</p><h2>清仓完成确认</h2><p>{clearanceCount ? `有 ${clearanceCount} 条运营提交等待逐条复核。` : '当前没有待主管确认的清仓完成时间。'}</p></div><a className="button" href="/actions?clearance_status=pending_confirmation">{clearanceCount ? '逐条确认' : '查看清仓任务'}</a></section><section className="panel risk-panel"><div className="section-title"><div><h2>待审核动作风险分布</h2><p>固定顺序，不由 AI 改变优先级。</p></div><span className={notificationFailures ? 'status status-failed' : 'status status-ready'}>{notificationFailures} 条协同异常</span></div><div className="risk-grid">{risks.map(risk => <div key={risk.value} className={`risk-card risk-${risk.value}`}><span>{actionLabel[risk.value]}</span><strong>{risk.count}</strong></div>)}</div></section></div>
}

function RecentReviews({ items }: { items: ActionItem[] }) { const reviews=items.filter(item=>item.review_status!=='pending').slice(0,3); return <div className="panel section-panel"><h2>最近审核记录</h2>{reviews.length ? <ul className="recent-list">{reviews.map(item=><li key={item.link_id}><div><strong>{item.spu_id} · {item.name}</strong><span>{item.review_status==='approved'?'整体通过':'已驳回'} · {item.operator_ref}</span></div><a className="table-link" href={`/suggestions/${item.link_id}`}>复核详情</a></li>)}</ul> : <p className="muted">当前批次暂无已完成审核记录。</p>}</div> }
function RecentOperations({ items }: { items: ActionItem[] }) { const completed=items.filter(item=>['executed','result_recorded','closed'].includes(item.business_state)); return <div className="panel section-panel"><h2>最近处理与结果</h2>{completed.length ? <ul className="recent-list">{completed.slice(0,3).map(item=><li key={item.link_id}><div><strong>{item.spu_id} · {actionLabel[item.effective_business_action ?? ''] ?? '经营动作'}</strong><span>{stateLabel[item.business_state] ?? item.business_state} · 执行 {item.business_executed_at ? new Date(item.business_executed_at).toLocaleString('zh-CN') : '—'}</span></div><a className="table-link" href={`/suggestions/${item.link_id}`}>查看记录</a></li>)}</ul> : <p className="muted">当前没有最近处理记录。</p>}</div> }
function OperationsOverview({ items, data }: { items: ActionItem[]; data: Awaited<ReturnType<typeof getWorkbench>> }) { return <div className="operations-overview"><div className="panel section-panel"><div className="section-title"><div><h2>优先经营待办</h2><p>可行动任务优先；当前显示 {items.length} 条本人任务。</p></div><a className="table-link" href="/actions">查看全部行动</a></div><ActionTable items={items} /></div><aside className="operations-side"><section className="panel section-panel"><h2>待补录经营结果</h2><strong className="side-metric">{data.pending_result_count}</strong><p className="muted">已执行但尚未记录结果的经营动作。</p><RecentOperations items={data.items} /></section><section className="panel section-panel"><h2>数据限制</h2>{data.data_limitations.length===0 ? <p className="muted">本批次未发现数据限制。</p> : <><ul className="limitation-list">{data.data_limitations.slice(0,3).map(item=><li key={`${item.field}-${item.status}`}><strong>{limitationField[item.field]??item.field}</strong><span>{limitationStatus[item.status]??item.status} · {item.count}</span></li>)}</ul><a className="table-link" href={`/batches/${data.latest_batch_id}`}>核对全部来源与影响</a></>}</section></aside></div> }

const limitationField:Record<string,string>={launch_date:'上架日期',quality_return_rate_7d:'近 7 天品退率',inventory_days:'库存可售天数',net_sales_prev_month:'上月净销售额',operating_profit_rate:'经营准利润率'}
const limitationStatus:Record<string,string>={invalid:'字段无效',not_verified:'周期未校验',insufficient:'数据不足',unavailable:'未提供'}
const actionLabel:Record<string,string>={clearance:'清仓',stop_loss:'止损',observe:'观察',invest:'加投'}
const stateLabel:Record<string,string>={executed:'待补录结果',result_recorded:'已记录结果',closed:'已关闭'}
function statePriority(value: string) { return ({ pending_execution: 1, executed: 2, result_recorded: 3, closed: 4, terminated: 5 } as Record<string, number>)[value] ?? 9 }

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) { return <div className={`stat ${tone ? `stat-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></div> }
function State({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="panel empty-state"><strong>{title}</strong><p>{body}</p>{action}</div> }
