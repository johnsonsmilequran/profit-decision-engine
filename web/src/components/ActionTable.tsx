import { useState } from 'react'
import type { ActionItem, PreviousActionItem } from '../api'

const actions: Record<string, string> = { clearance: '清仓', stop_loss: '止损', observe: '观察', invest: '加投', maintain: '维持', restock: '补货', prohibit_restock: '禁补' }
const states: Record<string, string> = { pending_review: '待审核', pending_execution: '待执行', executed: '已执行', result_recorded: '已记录结果', closed: '已关闭', terminated: '已终止' }

export function ActionTable({ items, showReview = true, historyMode = false, detailed = false }: { items: ActionItem[]; showReview?: boolean; historyMode?: boolean; detailed?: boolean }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  if (items.length === 0) return <div className="empty-state compact"><strong>当前没有匹配的行动</strong><p>可调整筛选条件或等待新批次完成规则处理。</p></div>
  if (detailed) return <DetailedActionTable items={items} historyMode={historyMode} expanded={expanded} setExpanded={setExpanded} />
  return <div className="table-scroll"><table className="action-table"><thead><tr><th>经营对象</th><th>主动作 / 库存</th><th>关键依据</th><th>责任运营</th>{showReview ? <th>审核</th> : null}<th>经营状态</th><th>生命周期</th><th /></tr></thead><tbody>{items.flatMap(item => {
    const rows = [<tr key={item.link_id}>
      <td><strong>{item.name}</strong><small>{item.spu_id} · {item.store}</small>{item.previous ? <button className="fold-button" aria-expanded={Boolean(expanded[item.link_id])} onClick={() => setExpanded(value => ({ ...value, [item.link_id]: !value[item.link_id] }))}>{expanded[item.link_id] ? '收起最近前序' : '展开最近前序'}</button> : <small>本周新任务</small>}</td>
      <td><ActionPair business={item.suggested_business_action} inventory={item.suggested_inventory_action} /><small>{relationText(item.relation_type)}</small></td>
      <td>{item.trigger_rule}<small>销售 {money(item.net_sales_prev_month)} · 利润 {percent(item.operating_profit_rate)}</small></td>
      <td>{item.operator_ref}</td>{showReview ? <td>{reviewText(item.review_status)}</td> : null}<td>{states[item.business_state] ?? item.business_state}</td>
      <td><small>产生 {dateTime(item.task_created_at)}</small><small>本周关联 {dateTime(item.linked_at)}</small><small>执行 {item.business_executed_at ? dateTime(item.business_executed_at) : '—'}</small></td>
      <td><a className="table-link" href={`/suggestions/${item.link_id}${historyMode ? `?mode=history&return_to=${encodeURIComponent(window.location.pathname + window.location.search)}` : ''}`}>{historyMode ? '只读追溯' : '查看详情'}</a></td>
    </tr>]
    if (item.previous && expanded[item.link_id]) rows.push(<PreviousRow key={`${item.link_id}-previous`} item={item.previous} showReview={showReview} />)
    return rows
  })}</tbody></table></div>
}

function DetailedActionTable({ items, historyMode, expanded, setExpanded }: { items: ActionItem[]; historyMode: boolean; expanded: Record<string, boolean>; setExpanded: (value: Record<string, boolean>) => void }) {
  return <div className="table-scroll"><table className="action-list-table"><thead><tr><th>SPU 对象</th><th>发现问题与关键依据</th><th>双轨动作与执行进度</th><th>审核 / AI / 数据限制</th><th>责任人与时间</th><th /></tr></thead><tbody>{items.flatMap(item => {
    const rows = [<tr key={item.link_id}>
      <td><strong>{item.name}</strong><small>{item.spu_id} · {item.store}</small><small>{item.platform} · 责任运营 {item.operator_ref}</small><span className="task-mark">{relationText(item.relation_type)}</span>{item.previous ? <button className="fold-button" aria-expanded={Boolean(expanded[item.link_id])} onClick={() => setExpanded({ ...expanded, [item.link_id]: !expanded[item.link_id] })}>{expanded[item.link_id] ? '收起最近前序' : '展开最近前序'}</button> : <small>无前序待办</small>}</td>
      <td><strong>{item.trigger_rule}</strong><small>经营准利润率 {percent(item.operating_profit_rate)}</small><small>上月净销售额 {money(item.net_sales_prev_month)}</small><small>库存可售天数 {item.inventory_days === null ? '数据不足' : `${item.inventory_days.toFixed(1)} 天`}</small></td>
      <td><Track label="经营动作" action={item.effective_business_action} state={item.business_state} /><Track label="库存动作" action={item.effective_inventory_action} state={item.inventory_state} /></td>
      <td><StatusLine label="审核" value={reviewText(item.review_status)} tone={item.review_status === 'approved' ? 'ready' : item.review_status === 'rejected' ? 'failed' : 'pending'} /><StatusLine label="AI" value={aiText(item.latest_ai_status)} tone={item.latest_ai_status === 'generated' ? 'ready' : item.latest_ai_status === 'generating' ? 'pending' : 'failed'} />{item.latest_clearance_status ? <StatusLine label="完成确认" value={clearanceText(item.latest_clearance_status)} tone={item.latest_clearance_status === 'confirmed' ? 'ready' : item.latest_clearance_status === 'returned' ? 'failed' : 'pending'} /> : null}<DataLimitations quality={item.quality} /></td>
      <td><strong>{item.operator_ref}</strong><small>产生 {dateTime(item.task_created_at)}</small><small>本周关联 {dateTime(item.linked_at)}</small><small>执行 {item.business_executed_at ? dateTime(item.business_executed_at) : '—'}</small></td>
      <td><a className="table-link" href={`/suggestions/${item.link_id}${historyMode ? `?mode=history&return_to=${encodeURIComponent(window.location.pathname + window.location.search)}` : ''}`}>{historyMode ? '只读追溯' : '查看建议'}</a></td>
    </tr>]
    if (item.previous && expanded[item.link_id]) rows.push(<DetailedPreviousRow key={`${item.link_id}-previous`} item={item.previous} />)
    return rows
  })}</tbody></table></div>
}

function DetailedPreviousRow({ item }: { item: PreviousActionItem }) { return <tr className="previous-row"><td><strong>{item.name}</strong><small>{item.spu_id} · {item.batch_code}</small><span className="task-mark">最近前序 · 只读</span></td><td><strong>{item.trigger_rule}</strong><small>经营准利润率 {percent(item.operating_profit_rate)}</small><small>上月净销售额 {money(item.net_sales_prev_month)}</small><small>库存可售天数 {item.inventory_days === null ? '数据不足' : `${item.inventory_days.toFixed(1)} 天`}</small></td><td><Track label="经营动作" action={item.business_action} state={item.business_state} /><Track label="库存语境" action={item.inventory_action} state="历史快照" /></td><td><StatusLine label="审核" value="历史快照" tone="pending" /><p className="data-limit">原批次证据与状态，不使用当前周回填</p></td><td><small>产生 {dateTime(item.task_created_at)}</small><small>当周关联 {dateTime(item.linked_at)}</small><small>执行 {item.business_executed_at ? dateTime(item.business_executed_at) : '—'}</small></td><td><a className="table-link" href={`/suggestions/${item.link_id}?mode=history`}>只读追溯</a></td></tr> }
function Track({ label, action, state }: { label: string; action: string | null; state: string }) { return <div className="track-row"><small>{label}</small>{action ? <span className={`action action-${action}`}>{actions[action] ?? action}</span> : <span className="muted">未生成动作</span>}<span>{states[state] ?? state}</span></div> }
function StatusLine({ label, value, tone }: { label: string; value: string; tone: 'ready' | 'pending' | 'failed' }) { return <div className="status-line"><small>{label}</small><span className={`status status-${tone}`}>{value}</span></div> }
function DataLimitations({ quality }: { quality: Record<string, string> }) { const entries = Object.entries(quality).filter(([, value]) => value !== 'valid'); return entries.length ? <p className="data-limit">数据限制：{entries.map(([field, value]) => `${qualityField(field)}${qualityState(value)}`).join('；')}</p> : <p className="data-limit data-ok">数据校验通过</p> }

function PreviousRow({ item, showReview }: { item: PreviousActionItem; showReview: boolean }) { return <tr className="previous-row"><td><strong>{item.name}</strong><small>{item.spu_id} · 前序只读</small></td><td><ActionPair business={item.business_action} inventory={item.inventory_action} /><small>{item.batch_code}</small></td><td>{item.trigger_rule}<small>销售 {money(item.net_sales_prev_month)} · 利润 {percent(item.operating_profit_rate)}</small></td><td>原责任运营</td>{showReview ? <td>历史快照</td> : null}<td>{states[item.business_state] ?? item.business_state}</td><td><small>产生 {dateTime(item.task_created_at)}</small><small>当周关联 {dateTime(item.linked_at)}</small><small>执行 {item.business_executed_at ? dateTime(item.business_executed_at) : '—'}</small></td><td><a className="table-link" href={`/suggestions/${item.link_id}?mode=history`}>追溯</a></td></tr> }
function ActionPair({ business, inventory }: { business: string | null; inventory: string | null }) { return <div className="action-pair"><span className={`action action-${business}`}>{business ? actions[business] ?? business : '依据不足'}</span>{inventory === 'restock' || inventory === 'prohibit_restock' ? <span className={`action action-${inventory}`}>{actions[inventory]}</span> : <span className="muted">无协同任务</span>}</div> }
function relationText(value: string) { return ({ new_task: '本周新任务', same_action_continuation: '延续前序 · 未重建', action_change_pending: '动作变化 · 待主管确认' } as Record<string,string>)[value] ?? value }
function reviewText(value: string) { return ({ pending: '待审核', approved: '已通过', rejected: '已驳回' } as Record<string,string>)[value] ?? value }
function aiText(value: string) { return ({ generating: '生成中', generated: '已生成', failed: '生成失败', not_adopted: '内容未采用', not_configured: '模型服务未配置' } as Record<string,string>)[value] ?? value }
function clearanceText(value: string) { return ({ pending_confirmation: '待主管确认', returned: '已退回待修正', confirmed: '已确认' } as Record<string,string>)[value] ?? value }
function qualityField(value: string) { return ({ quality_return_rate_7d: '近 7 天品退率', inventory_days: '库存可售天数', launch_date: '上架日期', operating_profit_rate: '经营准利润率', net_sales_prev_month: '上月净销售额' } as Record<string,string>)[value] ?? value }
function qualityState(value: string) { return ({ not_verified: '未校验', insufficient: '数据不足', unavailable: '未提供', anomalous: '异常', no_recent_sales: '无近期销售' } as Record<string,string>)[value] ?? value }
function money(value: number | null) { return value === null ? '数据不足' : `¥${value.toLocaleString('zh-CN',{ maximumFractionDigits: 0 })}` }
function percent(value: number | null) { return value === null ? '数据不足' : `${(value*100).toFixed(2)}%` }
function dateTime(value: string) { return new Date(value).toLocaleString('zh-CN',{ hour12: false }) }
