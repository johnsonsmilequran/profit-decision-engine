import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { executeAction, getSession, getSuggestion, recordActionResult, reviewSuggestion, type SuggestionDetail } from '../api'
import { AppShell } from '../components/AppShell'

const actionText: Record<string,string> = { clearance:'清仓',stop_loss:'止损',observe:'观察',invest:'加投',maintain:'维持',restock:'补货',prohibit_restock:'禁止补货' }

export function SuggestionDetailPage({ linkId }: { linkId: string }) {
  const historyMode = new URLSearchParams(window.location.search).get('mode') === 'history'
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey:['suggestion',linkId],queryFn:({signal})=>getSuggestion(linkId,signal) })
  const session = useQuery({ queryKey:['session'],queryFn:({signal})=>getSession(signal) })
  const [reviewChoice,setReviewChoice]=useState<'approved'|'rejected'>('approved')
  const [note,setNote]=useState('')
  const [message,setMessage]=useState('')
  const review=useMutation({mutationFn:()=>reviewSuggestion(linkId,reviewChoice,note,detail.data!.review_version),onSuccess:data=>{queryClient.setQueryData(['suggestion',linkId],data);setMessage('审核已保存，两条动作轨已按结果更新。')},onError:error=>setMessage(error.message==='version_conflict'?'状态已被其他人更新，请刷新后重新判断。':'审核提交失败，输入已保留。')})
  const submit=(event:FormEvent)=>{event.preventDefault();if(reviewChoice==='rejected'&&!note.trim()){setMessage('驳回时必须填写原因。');return}const action=reviewChoice==='approved'?'通过':'驳回';if(!window.confirm(`确认${action}「${detail.data?.name ?? ''}」的完整建议？`))return;setMessage('');review.mutate()}
  if(detail.isPending)return <AppShell><State title="正在加载建议" body="正在读取冻结证据与状态事件。" /></AppShell>
  if(detail.isError||!detail.data)return <AppShell><State title="建议无法打开" body="记录不存在、无权访问或服务暂时不可用。" /></AppShell>
  const item=detail.data
  return <AppShell active="actions"><section data-page-id="PAGE-F06-03">
    <a className="back-link" href={historyMode?'/history':'/actions'}>← 返回{historyMode?'历史追溯':'行动清单'}</a>
    <div className="page-heading"><div><p className="overline">{historyMode?'历史只读追溯':'建议详情'}</p><h1>{item.name}</h1><p className="muted">{item.spu_id} · {item.batch_code} · {item.period_start} 至 {item.period_end} · {item.rule_version}</p></div><span className={`status status-${item.review_status}`}>{reviewLabel(item.review_status)}</span></div>
    {historyMode?<div className="processing-banner">历史模式只读取原批次快照和当时事件，不重新计算，也不允许提交。</div>:null}
    <div className="four-elements"><Card title="对象" body={`${item.name}（${item.spu_id}）`} /><Card title="问题" body={item.trigger_rule} /><Card title="关键依据" body={`销售 ${money(item.net_sales_prev_month)}；利润率 ${percent(item.operating_profit_rate)}`} /><Card title="推荐动作" body={`${label(item.suggested_business_action)} + ${label(item.suggested_inventory_action)}`} /></div>
    <div className="suggestion-grid"><div>
      <section className="panel section-panel"><h2>冻结指标与规则证据</h2><dl className="evidence-list"><Row label="统计期间" value={`${item.period_start} 至 ${item.period_end}，截止 ${item.business_cutoff_date}`} /><Row label="上月净销售额" value={money(item.net_sales_prev_month)} /><Row label="经营准利润率" value={percent(item.operating_profit_rate)} /><Row label="近 7 天品退率" value={percent(item.quality_return_rate_7d)} /><Row label="库存可售天数" value={number(item.inventory_days)} /><Row label="触发规则" value={item.trigger_rule} /></dl><details><summary>查看完整结构化证据</summary><pre>{JSON.stringify(item.evidence,null,2)}</pre></details></section>
      <section className="panel section-panel"><h2>双轨动作</h2><div className="track"><div><span>经营动作 · 责任运营</span><strong>{label(item.effective_business_action)}</strong><small>{item.operator_ref} · {item.business_state}</small></div><div><span>库存协同 · 责任运营通过 OA 推进</span><strong>{label(item.effective_inventory_action)}</strong><small>{item.operator_ref} · {item.inventory_state}</small></div></div></section>
      <section className="panel section-panel"><h2>AI 辅助解读</h2>{item.ai_status==='generated'?<pre>{JSON.stringify(item.ai_content,null,2)}</pre>:<p className="muted">当前状态：{item.ai_status==='not_configured'?'未配置模型服务。结构化四要素与业务闭环不受影响。':item.ai_status}</p>}</section>
    </div><aside>
      <section className="panel section-panel"><h2>审核与执行</h2>{historyMode?<p className="muted">历史只读，不提供审核或执行入口。</p>:item.review_status==='pending'&&session.data?.user.role==='supervisor'?<form onSubmit={submit}><div className="choice-row"><label><input type="radio" checked={reviewChoice==='approved'} onChange={()=>setReviewChoice('approved')} /> 整体通过</label><label><input type="radio" checked={reviewChoice==='rejected'} onChange={()=>setReviewChoice('rejected')} /> 整体驳回</label></div><label className="stacked">审核备注<textarea value={note} onChange={event=>setNote(event.target.value)} placeholder={reviewChoice==='rejected'?'必填驳回原因':'通过时可选'} /></label>{message?<div className={review.isError?'alert':'success-note'}>{message}</div>:null}<button className="button primary-button full-button" disabled={review.isPending}>{review.isPending?'正在提交…':'确认审核'}</button></form>:session.data?.user.role==='operations'?<OperationsPanel item={item} onUpdated={data=>queryClient.setQueryData(['suggestion',linkId],data)} />:<p className="muted">当前审核状态：{reviewLabel(item.review_status)}。主管不能代责任运营执行。</p>}</section>
      <section className="panel section-panel"><h2>跨周任务</h2><dl className="evidence-list"><Row label="稳定任务 ID" value={item.task_id} /><Row label="任务产生" value={dateTime(item.task_created_at)} /><Row label="本周关联" value={dateTime(item.linked_at)} /><Row label="经营执行" value={item.business_executed_at?dateTime(item.business_executed_at):'—'} /></dl>{item.previous?<details><summary>最近前序建议</summary><p>{item.previous.batch_code} · {label(item.previous.business_action)} · {item.previous.trigger_rule}</p></details>:<p className="muted">首次命中，无前序待办。</p>}</section>
    </aside></div>
    <section className="panel section-panel"><h2>业务时间线</h2>{item.events.length===0?<p className="muted">尚无业务事件。</p>:<ol className="timeline">{item.events.map(event=><li key={event.id}><strong>{event.type}</strong><span>{dateTime(event.created_at)} · {event.actor_ref}</span><p>{event.reason??`${event.from_state??'—'} → ${event.to_state??'—'}`}</p></li>)}</ol>}</section>
  </section></AppShell>
}

function State({title,body}:{title:string;body:string}){return <div className="empty-state"><strong>{title}</strong><p>{body}</p></div>}
function Card({title,body}:{title:string;body:string}){return <div className="fact-card"><span>{title}</span><strong>{body}</strong></div>}
function Row({label:rowLabel,value}:{label:string;value:string}){return <div><dt>{rowLabel}</dt><dd>{value}</dd></div>}
function label(value:string|null){return value?actionText[value]??value:'不生成'}
function reviewLabel(value:string){return ({pending:'待审核',approved:'已通过',rejected:'已驳回'} as Record<string,string>)[value]??value}
function money(value:number|null){return value===null?'数据不足':`¥${value.toLocaleString('zh-CN',{maximumFractionDigits:2})}`}
function percent(value:number|null){return value===null?'未校验':`${(value*100).toFixed(2)}%`}
function number(value:number|null){return value===null?'数据不足':value.toFixed(2)}
function dateTime(value:string){return new Date(value).toLocaleString('zh-CN',{hour12:false})}

function OperationsPanel({item,onUpdated}:{item:SuggestionDetail;onUpdated:(data:SuggestionDetail)=>void}){
  const [businessNote,setBusinessNote]=useState('')
  const [inventoryNote,setInventoryNote]=useState('')
  const [resultNote,setResultNote]=useState('')
  const [periodStart,setPeriodStart]=useState('')
  const [periodEnd,setPeriodEnd]=useState('')
  const [sales,setSales]=useState('');const [profit,setProfit]=useState('');const [inventory,setInventory]=useState('')
  const [feedback,setFeedback]=useState('')
  const command=useMutation({mutationFn:({track,note}:{track:'business'|'inventory';note:string})=>executeAction(item.task_id,track,track==='business'?item.business_version:item.inventory_version,note),onSuccess:data=>{onUpdated(data);setFeedback('动作状态已保存。')},onError:error=>setFeedback(error.message==='version_conflict'?'状态已更新，请刷新后重试。':'提交失败，输入已保留。')})
  const result=useMutation({mutationFn:()=>recordActionResult(item.task_id,{periodStart,periodEnd,salesValue:sales===''?null:Number(sales),profitValue:profit===''?null:Number(profit),inventoryValue:inventory===''?null:Number(inventory),salesUnavailable:sales==='',profitUnavailable:profit==='',inventoryUnavailable:inventory==='',note:resultNote,version:item.business_version}),onSuccess:data=>{onUpdated(data);setFeedback('经营结果已追加到时间线。')},onError:error=>setFeedback(error.message==='version_conflict'?'状态已更新，请刷新后重新判断。':'结果保存失败，输入已保留。')})
  const execute=(track:'business'|'inventory',note:string)=>{if(track==='inventory'&&!note.trim()){setFeedback('库存协同必须填写经责任运营核验的处理说明。');return}if(item.effective_business_action==='observe'&&track==='business'&&!note.trim()){setFeedback('观察动作必须填写实际观察或优化说明。');return}if(!window.confirm(`确认记录${track==='business'?'经营':'库存协同'}动作已执行？`))return;setFeedback('');command.mutate({track,note})}
  if(item.review_status!=='approved')return <p className="muted">建议尚未通过，动作不会提前激活。</p>
  return <div className="operation-stack"><div><strong>经营轨 · {item.business_state}</strong><textarea value={businessNote} onChange={event=>setBusinessNote(event.target.value)} placeholder="执行说明；观察动作必填" /><button className="button" disabled={item.business_state!=='pending_execution'||command.isPending} onClick={()=>execute('business',businessNote)}>确认经营动作已执行</button></div>{item.effective_inventory_action?<div><strong>库存协同轨 · {item.inventory_state}</strong><textarea value={inventoryNote} onChange={event=>setInventoryNote(event.target.value)} placeholder="OA 协同及经核验的外部反馈，必填" /><button className="button" disabled={item.inventory_state!=='pending_execution'||command.isPending} onClick={()=>execute('inventory',inventoryNote)}>确认协同已处理</button></div>:null}{item.business_state==='executed'||item.business_state==='result_recorded'?<form onSubmit={event=>{event.preventDefault();if(!resultNote.trim()){setFeedback('结果说明必填。');return}if(!window.confirm('确认追加本周期经营结果？'))return;result.mutate()}}><strong>补录经营结果</strong><div className="mini-grid"><input type="date" required value={periodStart} onChange={event=>setPeriodStart(event.target.value)} /><input type="date" required value={periodEnd} onChange={event=>setPeriodEnd(event.target.value)} /><input type="number" step="0.01" value={sales} onChange={event=>setSales(event.target.value)} placeholder="销售额；留空=未提供" /><input type="number" step="0.0001" value={profit} onChange={event=>setProfit(event.target.value)} placeholder="利润结果；留空=未提供" /><input type="number" step="0.01" value={inventory} onChange={event=>setInventory(event.target.value)} placeholder="库存结果；留空=未提供" /></div><textarea required value={resultNote} onChange={event=>setResultNote(event.target.value)} placeholder="结果口径和说明，必填" /><button className="button" disabled={result.isPending}>保存结果</button></form>:null}{feedback?<div className={command.isError||result.isError?'alert':'success-note'}>{feedback}</div>:null}</div>
}
