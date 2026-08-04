import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listBatches, listHistory, type HistoryFilters, type HistoryItem } from '../api'
import { AppShell } from '../components/AppShell'

const actionText:Record<string,string>={clearance:'清仓',stop_loss:'推广止损',observe:'观察',invest:'加投',maintain:'维持',restock:'补货',no_restock:'不补货',prohibit_restock:'禁止补货'}
const reviewText:Record<string,string>={pending:'待审核',approved:'已通过',rejected:'已驳回'}
const stateText:Record<string,string>={pending_review:'待审核',pending_execution:'待执行',executed:'已执行',result_recorded:'已记录结果',processed:'已核验处理',closed:'已关闭',terminated:'已终止',not_generated:'未生成'}

function initialFilters():HistoryFilters{
  const query=new URLSearchParams(window.location.search)
  const limit=Number(query.get('limit'))
  return {batchId:query.get('batch_id')??'',search:query.get('search')??'',action:query.get('action')??'',reviewStatus:query.get('review_status')??'',executionState:query.get('execution_state')??'',periodStart:query.get('period_start')??'',periodEnd:query.get('period_end')??'',page:Math.max(1,Number(query.get('page'))||1),limit:[20,50,100].includes(limit)?limit:50}
}

export function HistoryPage(){
  const [draft,setDraft]=useState<HistoryFilters>(initialFilters)
  const [filters,setFilters]=useState<HistoryFilters>(initialFilters)
  const [validation,setValidation]=useState('')
  const history=useQuery({queryKey:['history',filters],queryFn:({signal})=>listHistory(filters,signal)})
  const batches=useQuery({queryKey:['history-batches'],queryFn:({signal})=>listBatches(1,100,signal)})
  const apply=(next:HistoryFilters)=>{setFilters(next);setDraft(next);const query=toQuery(next);window.history.replaceState(null,'',`/history${query.toString()?`?${query}`:''}`)}
  const submit=(event:FormEvent)=>{event.preventDefault();if(draft.periodStart&&draft.periodEnd&&draft.periodStart>draft.periodEnd){setValidation('起始业务期间不得晚于结束期间。');return}setValidation('');apply({...draft,page:1})}
  const reset=()=>{setValidation('');apply({batchId:'',search:'',action:'',reviewStatus:'',executionState:'',periodStart:'',periodEnd:'',page:1,limit:50})}
  const totalPages=Math.max(1,Math.ceil((history.data?.total??0)/filters.limit))
  const hasFilters=Boolean(filters.batchId||filters.search||filters.action||filters.reviewStatus||filters.executionState||filters.periodStart||filters.periodEnd)
  return <AppShell active="history"><section data-page-id="PAGE-F08-01">
    <div className="page-heading"><div><p className="overline">不可变快照 · 业务事件追溯</p><h1>历史与追溯</h1><p className="muted">按批次与 SPU 找回当时的固定规则建议、审核结果和双动作进度。</p></div><span className="status">历史只读</span></div>
    <div className="processing-banner">历史记录为生成时快照，仅供追溯，不可在此修改审核、执行或结果；当前规则不会替换当时结论。</div>
    <form className="history-filters panel" onSubmit={submit}>
      <label>业务批次<select value={draft.batchId} onChange={event=>setDraft({...draft,batchId:event.target.value})}><option value="">全部批次</option>{batches.data?.items.map(batch=><option value={batch.id} key={batch.id}>{batch.code} · {batch.business_cutoff_date}</option>)}</select></label>
      <label>SPU ID 或名称<input type="search" value={draft.search} onChange={event=>setDraft({...draft,search:event.target.value})} placeholder="例如：515 或忙碌屋" /></label>
      <label>建议动作<select value={draft.action} onChange={event=>setDraft({...draft,action:event.target.value})}><option value="">全部动作</option><option value="invest">加投</option><option value="observe">观察</option><option value="stop_loss">推广止损</option><option value="clearance">清仓</option><option value="restock">补货</option><option value="prohibit_restock">禁止补货</option></select></label>
      <label>审核状态<select value={draft.reviewStatus} onChange={event=>setDraft({...draft,reviewStatus:event.target.value})}><option value="">全部状态</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select></label>
      <label>执行状态<select value={draft.executionState} onChange={event=>setDraft({...draft,executionState:event.target.value})}><option value="">全部进度</option><option value="pending_execution">待执行</option><option value="executed">已执行</option><option value="result_recorded">已记录结果</option><option value="processed">协同已处理</option><option value="closed">已关闭</option><option value="terminated">已终止</option></select></label>
      <label>起始业务期间<input type="month" value={draft.periodStart} onChange={event=>setDraft({...draft,periodStart:event.target.value})} /></label>
      <label>结束业务期间<input type="month" value={draft.periodEnd} onChange={event=>setDraft({...draft,periodEnd:event.target.value})} /></label>
      <div className="history-filter-actions"><button className="button" type="button" onClick={reset}>重置筛选</button><button className="button primary-button" disabled={history.isFetching}>查询历史</button></div>
      {validation?<div className="alert history-validation">{validation}</div>:null}
    </form>
    <section className="panel table-panel history-results"><div className="history-result-heading"><div><h2>历史建议记录</h2><p className="muted">匹配 <strong>{history.data?.total??0}</strong> 条；每行对应一个业务批次中的一条 SPU 建议</p></div></div>
      {history.isPending?<div className="empty-state compact"><strong>正在读取历史记录</strong><p>正在按当前权限与条件加载不可变快照。</p></div>:history.isError?<div className="empty-state compact"><strong>历史记录暂未加载成功</strong><p>检索条件已保留，请重试。</p><button className="button" onClick={()=>history.refetch()}>重试</button></div>:history.data.items.length===0?<div className="empty-state compact"><strong>{hasFilters?'当前条件无匹配历史':'尚无历史建议'}</strong><p>{hasFilters?'请移除部分条件或重置筛选。':'有效批次形成建议后将在此保留不可变记录。'}</p>{hasFilters?<button className="button" onClick={reset}>重置筛选</button>:null}</div>:<div className="table-scroll"><table className="history-table"><thead><tr><th>批次与 SPU</th><th>冻结建议动作</th><th>审核与双动作状态</th><th>业务里程碑摘要</th><th>审计异常</th><th>追溯</th></tr></thead><tbody>{history.data.items.map(item=><HistoryRow item={item} key={item.link_id} />)}</tbody></table></div>}
      <div className="pagination"><span>共 {totalPages} 页</span><select aria-label="每页数量" value={filters.limit} onChange={event=>apply({...filters,limit:Number(event.target.value),page:1})}><option value="20">20</option><option value="50">50</option><option value="100">100</option></select><button disabled={filters.page<=1} onClick={()=>apply({...filters,page:filters.page-1})}>上一页</button><span>第 {filters.page} 页</span><button disabled={filters.page>=totalPages} onClick={()=>apply({...filters,page:filters.page+1})}>下一页</button></div>
    </section>
  </section></AppShell>
}

function HistoryRow({item}:{item:HistoryItem}){
  const returnTo=window.location.pathname+window.location.search
  const link=`/suggestions/${encodeURIComponent(item.link_id)}?mode=history&return_to=${encodeURIComponent(returnTo)}`
  const milestones=[['建议生成',true],['主管审核',item.review_status!=='pending'],['运营动作',['executed','result_recorded','closed','terminated'].includes(item.business_state)],['库存协同',item.inventory_state==='not_generated'||['processed','closed','terminated'].includes(item.inventory_state)],['业务结果',item.business_state==='result_recorded'||item.business_state==='closed']] as const
  return <tr><td><strong>{item.batch_code}</strong><small>{item.name}</small><small>{item.spu_id} · {item.period_start.slice(0,7)} · 截止 {item.business_cutoff_date}</small><small>{item.rule_version} · 生成于 {dateTime(item.generated_at)}</small></td><td><div className="action-pair"><span className={`action action-${item.business_action}`}>{label(item.business_action)}</span>{item.inventory_action?<span className={`action action-${item.inventory_action}`}>{label(item.inventory_action)}</span>:null}</div><small>{item.product_type??'分类受限'} · {item.trigger_rule}</small></td><td><small>主管审核 · {reviewText[item.review_status]??item.review_status}</small><small>运营动作 · {stateText[item.business_state]??item.business_state}</small><small>库存协同 · {stateText[item.inventory_state]??item.inventory_state}</small></td><td><div className="milestone-line">{milestones.map(([name,done])=><span className={done?'milestone done':'milestone'} key={name}>{name}</span>)}</div><small>{item.latest_event_at?`最近事件：${item.latest_event_actor??'系统'}于 ${dateTime(item.latest_event_at)} 执行 ${item.latest_event_type}`:'尚无后续业务事件'}</small></td><td>{item.audit_count>0?<span className="status status-failed">{item.audit_count} 条可见异常</span>:<span className="status status-ready">无可见异常</span>}</td><td><a className="table-link" href={link}>查看追溯 →</a></td></tr>
}

function toQuery(filters:HistoryFilters){const query=new URLSearchParams();if(filters.batchId)query.set('batch_id',filters.batchId);if(filters.search)query.set('search',filters.search);if(filters.action)query.set('action',filters.action);if(filters.reviewStatus)query.set('review_status',filters.reviewStatus);if(filters.executionState)query.set('execution_state',filters.executionState);if(filters.periodStart)query.set('period_start',filters.periodStart);if(filters.periodEnd)query.set('period_end',filters.periodEnd);if(filters.page!==1)query.set('page',String(filters.page));if(filters.limit!==50)query.set('limit',String(filters.limit));return query}
function label(value:string|null){return value?actionText[value]??value:'不生成'}
function dateTime(value:string){return new Date(value).toLocaleString('zh-CN',{hour12:false})}
