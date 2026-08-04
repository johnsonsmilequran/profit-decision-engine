import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listBatches, type BatchSummary } from '../api'
import { AppShell } from '../components/AppShell'

const statusText = { received: '已接收', processing: '处理中', ready: '已完成', failed: '失败' }

export function BatchListPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const query = useQuery({
    queryKey: ['batches', page, limit],
    queryFn: ({ signal }) => listBatches(page, limit, signal),
    refetchInterval: ({ state }) => state.data?.items.some(item => item.status === 'received' || item.status === 'processing') ? 3000 : false,
  })
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / limit))
  const current = query.data?.items.find(item => item.status === 'ready')
  const history = query.data?.items.filter(item => item.id !== current?.id) ?? []

  return <AppShell><section data-page-id="PAGE-F01-01">
    <div className="page-heading"><div><p className="overline">Batch Management</p><h1>数据批次</h1><p className="muted">查看每周经营数据的处理状态、校验摘要与冻结版本。</p></div><div className="heading-actions"><button className="button" onClick={() => query.refetch()} disabled={query.isFetching}>{query.isFetching ? '刷新中…' : '刷新列表'}</button><a className="button primary-button" href="/batches/new">导入新批次</a></div></div>
    {query.isPending ? <div className="panel"><State title="正在加载批次" body="正在读取真实批次记录。" /></div> : query.isError ? <div className="panel"><State title="批次加载失败" body="服务暂时不可用，请重试。" action={<button className="button" onClick={() => query.refetch()}>重新加载</button>} /></div> : query.data.items.length === 0 ? <div className="panel"><State title="还没有数据批次" body="导入首个完整自然月的 XLSX 文件后，批次会显示在这里。" action={<a className="button" href="/batches/new">开始导入</a>} /></div> : <>
      {current ? <CurrentBatch batch={current} /> : <div className="notice warning">最新批次尚未形成可用清单，因此不会替换当前成功批次。</div>}
      <div className="batch-guidance" aria-label="批次规则说明"><article><strong>每周一导入</strong><span>数据支持部门提供经营表格，运营创建新批次。</span></article><article><strong>相同输入不重复</strong><span>相同文件与批次声明只返回首次创建记录。</span></article><article><strong>历史不可覆盖</strong><span>期间、校验结果与规则版本按创建时冻结保留。</span></article></div>
      <div className="panel table-panel batch-history">
        <div className="history-result-heading"><h2>历史批次</h2><p className="muted">当前批次单独固定展示，其余记录按创建时间追溯。</p></div>
        {history.length === 0 ? <State title="暂无历史批次" body={`当前仅有真实批次 ${current?.code ?? '—'}；后续新批次不会覆盖这里的事实。`} /> : <BatchTable items={history} />}
        <footer className="pagination"><span>共 {query.data.total} 个批次</span><label>每页 <select value={limit} onChange={event => { setLimit(Number(event.target.value)); setPage(1) }}><option>20</option><option>50</option><option>100</option></select></label><span>第 {page} / {pages} 页</span><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>上一页</button><button disabled={page === pages} onClick={() => setPage(value => value + 1)}>下一页</button></footer>
      </div>
    </>}
  </section></AppShell>
}

function CurrentBatch({ batch }: { batch: BatchSummary }) {
  const steps = ['文件已接收', '字段已校验', '指标已冻结', '规则已完成']
  return <section className="panel current-batch" aria-label="当前批次">
    <div className="current-batch-head"><div><span className="status status-ready">当前批次 · 清单已就绪</span><h2>{batch.code}</h2><p>{batch.business_unit} · {batch.period_start} 至 {batch.period_end}</p></div><a className="button" href={`/batches/${batch.id}`}>查看批次详情</a></div>
    <div className="batch-context-grid"><div><span>业务截止日</span><strong>{batch.business_cutoff_date}</strong><small>冻结批次判断时点</small></div><div><span>规则版本</span><strong>{batch.rule_version ?? '—'}</strong><small>历史版本不可覆盖</small></div><div><span>源文件</span><strong>{batch.source_file_name}</strong><small>{batch.created_by} · {formatDate(batch.created_at)}</small></div></div>
    <div className="batch-process">{steps.map((step, index) => <div key={step} className="batch-process-step"><span>{index + 1}</span><strong>{step}</strong></div>)}</div>
    <div className="batch-summary"><Stat label="有效 SPU" value={batch.valid_count ?? '—'} /><Stat label="拒绝记录" value={batch.rejected_count ?? '—'} /><Stat label="降级处理" value={batch.degraded_count ?? '—'} /><Stat label="批次警告" value={batch.warning_count ?? '—'} /></div>
  </section>
}

function BatchTable({ items }: { items: BatchSummary[] }) { return <div className="table-scroll"><table><thead><tr><th>批次</th><th>经营期间</th><th>文件</th><th>状态</th><th>有效 / 拒绝 / 降级</th><th>创建时间</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><a className="table-link" href={`/batches/${item.id}`}>{item.code}</a><small>{item.business_unit}</small></td><td>{item.period_start} 至 {item.period_end}<small>截止 {item.business_cutoff_date}</small></td><td>{item.source_file_name}</td><td><span className={`status status-${item.status}`}>{statusText[item.status]}</span>{item.failure_code ? <small>{item.failure_code}</small> : null}</td><td>{item.valid_count ?? '—'} / {item.rejected_count ?? '—'} / {item.degraded_count ?? '—'}</td><td>{formatDate(item.created_at)}</td></tr>)}</tbody></table></div> }

function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN') }

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div> }
function State({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="empty-state"><strong>{title}</strong><p>{body}</p>{action}</div> }
