import { useState } from 'react'
import type { ActionItem, PreviousActionItem } from '../api'

const actions: Record<string, string> = { clearance: '清仓', stop_loss: '止损', observe: '观察', invest: '加投', maintain: '维持', restock: '补货', prohibit_restock: '禁补' }
const states: Record<string, string> = { pending_review: '待审核', pending_execution: '待执行', executed: '已执行', result_recorded: '已记录结果', closed: '已关闭', terminated: '已终止' }

export function ActionTable({ items, showReview = true, historyMode = false }: { items: ActionItem[]; showReview?: boolean; historyMode?: boolean }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  if (items.length === 0) return <div className="empty-state compact"><strong>当前没有匹配的行动</strong><p>可调整筛选条件或等待新批次完成规则处理。</p></div>
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

function PreviousRow({ item, showReview }: { item: PreviousActionItem; showReview: boolean }) { return <tr className="previous-row"><td><strong>{item.name}</strong><small>{item.spu_id} · 前序只读</small></td><td><ActionPair business={item.business_action} inventory={item.inventory_action} /><small>{item.batch_code}</small></td><td>{item.trigger_rule}<small>销售 {money(item.net_sales_prev_month)} · 利润 {percent(item.operating_profit_rate)}</small></td><td>原责任运营</td>{showReview ? <td>历史快照</td> : null}<td>{states[item.business_state] ?? item.business_state}</td><td><small>产生 {dateTime(item.task_created_at)}</small><small>当周关联 {dateTime(item.linked_at)}</small><small>执行 {item.business_executed_at ? dateTime(item.business_executed_at) : '—'}</small></td><td><a className="table-link" href={`/suggestions/${item.link_id}?mode=history`}>追溯</a></td></tr> }
function ActionPair({ business, inventory }: { business: string | null; inventory: string | null }) { return <div className="action-pair"><span className={`action action-${business}`}>{business ? actions[business] ?? business : '依据不足'}</span>{inventory === 'restock' || inventory === 'prohibit_restock' ? <span className={`action action-${inventory}`}>{actions[inventory]}</span> : <span className="muted">无协同任务</span>}</div> }
function relationText(value: string) { return ({ new_task: '本周新任务', same_action_continuation: '延续前序 · 未重建', action_change_pending: '动作变化 · 待主管确认' } as Record<string,string>)[value] ?? value }
function reviewText(value: string) { return ({ pending: '待审核', approved: '已通过', rejected: '已驳回' } as Record<string,string>)[value] ?? value }
function money(value: number | null) { return value === null ? '数据不足' : `¥${value.toLocaleString('zh-CN',{ maximumFractionDigits: 0 })}` }
function percent(value: number | null) { return value === null ? '数据不足' : `${(value*100).toFixed(2)}%` }
function dateTime(value: string) { return new Date(value).toLocaleString('zh-CN',{ hour12: false }) }
