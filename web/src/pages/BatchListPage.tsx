import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listBatches } from '../api'
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

  return <AppShell><section data-page-id="PAGE-F01-01">
    <div className="page-heading"><div><p className="overline">数据批次</p><h1>月度经营数据</h1><p className="muted">每次导入都冻结为可追溯的经营事实，完成后生成对应行动清单。</p></div><a className="button primary-button" href="/batches/new">导入新批次</a></div>
    <div className="stat-row"><Stat label="批次总数" value={query.data?.total ?? '—'} /><Stat label="处理中" value={query.data?.items.filter(item => item.status === 'received' || item.status === 'processing').length ?? '—'} /><Stat label="当前规则" value={query.data?.items.find(item => item.rule_version)?.rule_version ?? '—'} /></div>
    <div className="panel table-panel">
      {query.isPending ? <State title="正在加载批次" body="正在读取真实批次记录。" /> : query.isError ? <State title="批次加载失败" body="服务暂时不可用，请重试。" action={<button className="button" onClick={() => query.refetch()}>重新加载</button>} /> : query.data.items.length === 0 ? <State title="还没有数据批次" body="导入首个完整自然月的 XLSX 文件后，批次会显示在这里。" action={<a className="button" href="/batches/new">开始导入</a>} /> : <div className="table-scroll"><table><thead><tr><th>批次</th><th>经营期间</th><th>文件</th><th>状态</th><th>有效 / 拒绝 / 降级</th><th>创建时间</th></tr></thead><tbody>{query.data.items.map(item => <tr key={item.id}><td><a className="table-link" href={`/batches/${item.id}`}>{item.code}</a><small>{item.business_unit}</small></td><td>{item.period_start} 至 {item.period_end}<small>截止 {item.business_cutoff_date}</small></td><td>{item.source_file_name}</td><td><span className={`status status-${item.status}`}>{statusText[item.status]}</span>{item.failure_code ? <small>{item.failure_code}</small> : null}</td><td>{item.valid_count ?? '—'} / {item.rejected_count ?? '—'} / {item.degraded_count ?? '—'}</td><td>{new Date(item.created_at).toLocaleString('zh-CN')}</td></tr>)}</tbody></table></div>}
      <footer className="pagination"><label>每页 <select value={limit} onChange={event => { setLimit(Number(event.target.value)); setPage(1) }}><option>20</option><option>50</option><option>100</option></select></label><span>第 {page} / {pages} 页</span><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>上一页</button><button disabled={page === pages} onClick={() => setPage(value => value + 1)}>下一页</button></footer>
    </div>
  </section></AppShell>
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div> }
function State({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="empty-state"><strong>{title}</strong><p>{body}</p>{action}</div> }
