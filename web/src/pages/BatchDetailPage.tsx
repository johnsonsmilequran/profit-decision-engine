import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createBatch, getBatch, type ImportIssue, type Snapshot } from '../api'
import { AppShell } from '../components/AppShell'

const actionText: Record<string, string> = { clearance: '清仓', stop_loss: '止损', maintain: '维持', invest: '加大投入' }

export function BatchDetailPage({ batchId }: { batchId?: string }) {
  return <AppShell>{batchId ? <ExistingBatch batchId={batchId} /> : <NewBatch />}</AppShell>
}

function NewBatch() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: createBatch, onSuccess: batch => window.location.assign(`/batches/${batch.id}`) })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (!file) { setError('请选择 XLSX 文件。'); return }
    setError('')
    mutation.mutate({ businessUnit: String(data.get('business_unit')), periodStart: String(data.get('period_start')), periodEnd: String(data.get('period_end')), cutoffDate: String(data.get('cutoff_date')), file })
  }
  return <section data-page-id="PAGE-F01-02">
    <a className="back-link" href="/batches">← 返回数据批次</a>
    <div className="page-heading"><div><p className="overline">新建批次</p><h1>导入月度经营数据</h1><p className="muted">上传后由后台异步解析，原始文件、字段质量和规则结果会一并冻结。</p></div></div>
    <div className="detail-grid"><form className="panel form-panel" onSubmit={submit}>
      <h2>批次信息</h2><div className="form-grid"><label>事业部<select name="business_unit" defaultValue="玩具事业部"><option>玩具事业部</option></select></label><label>期间开始<input name="period_start" type="date" required /></label><label>期间结束<input name="period_end" type="date" required /></label><label>业务截止日<input name="cutoff_date" type="date" required /></label></div>
      <label className="upload-zone">经营数据文件<input type="file" accept=".xlsx" required onChange={event => setFile(event.target.files?.[0] ?? null)} /><span>{file ? file.name : '选择 .xlsx 文件'}</span><small>必须包含完整自然月；重复的文件与期间组合会返回既有批次。</small></label>
      {error || mutation.error ? <div className="alert">{error || errorText(mutation.error?.message)}</div> : null}
      <div className="form-actions"><a className="button" href="/batches">取消</a><button className="button primary-button" disabled={mutation.isPending}>{mutation.isPending ? '正在上传…' : '上传并开始处理'}</button></div>
    </form><aside className="panel guide-panel"><h2>导入检查</h2><ol><li>SPU ID、名称、店铺、平台与运营归属必须完整。</li><li>同一批次 SPU ID 重复时，所有重复行都会拒绝。</li><li>缺失的销量、利润率、质退或库存字段不会用 0 补齐。</li><li>工作簿中的汇总行仅提示，不进入规则计算。</li></ol></aside></div>
  </section>
}

function ExistingBatch({ batchId }: { batchId: string }) {
  const [severity, setSeverity] = useState('all')
  const [selected, setSelected] = useState<Snapshot | null>(null)
  const query = useQuery({ queryKey: ['batch', batchId], queryFn: ({ signal }) => getBatch(batchId, signal), refetchInterval: ({ state }) => state.data?.status === 'received' || state.data?.status === 'processing' ? 2000 : false })
  const issues = useMemo(() => query.data?.issues.filter(issue => severity === 'all' || issue.severity === severity) ?? [], [query.data, severity])
  if (query.isPending) return <section data-page-id="PAGE-F01-02"><div className="empty-state"><strong>正在读取批次</strong><p>正在加载冻结快照与处理状态。</p></div></section>
  if (query.isError || !query.data) return <section data-page-id="PAGE-F01-02"><div className="empty-state"><strong>批次无法打开</strong><p>记录不存在或服务暂时不可用。</p><a className="button" href="/batches">返回列表</a></div></section>
  const batch = query.data
  return <section data-page-id="PAGE-F01-02">
    <a className="back-link" href="/batches">← 返回数据批次</a>
    <div className="page-heading"><div><p className="overline">批次详情</p><h1>{batch.code}</h1><p className="muted">{batch.period_start} 至 {batch.period_end} · 截止 {batch.business_cutoff_date} · {batch.source_file_name}</p></div><span className={`status status-${batch.status}`}>{batchStatus(batch.status)}</span></div>
    {(batch.status === 'received' || batch.status === 'processing') ? <div className="processing-banner"><span className="spinner" />后台正在解析并固化经营事实，本页会自动刷新。</div> : null}
    {batch.status === 'failed' ? <div className="alert">处理失败：{batch.failure_code ?? 'unknown_failure'}。原始文件已保留，可据错误修正后重新导入。</div> : null}
    <div className="stat-row"><Stat label="有效 SPU" value={batch.valid_count} /><Stat label="拒绝" value={batch.rejected_count} /><Stat label="降级" value={batch.degraded_count} /><Stat label="警告" value={batch.warning_count} /><Stat label="规则版本" value={batch.rule_version} /></div>
    <div className="panel section-panel"><div className="section-title"><div><h2>冻结快照与规则结果</h2><p>点击任一 SPU 查看来源证据，缺失字段保持未知。</p></div></div>{batch.snapshots.length === 0 ? <p className="muted">处理完成后显示快照。</p> : <div className="table-scroll"><table><thead><tr><th>SPU</th><th>归属</th><th>销售额</th><th>利润率</th><th>质退率 / 库存天数</th><th>规则结论</th></tr></thead><tbody>{batch.snapshots.map(snapshot => <tr className="clickable" key={snapshot.id} onClick={() => setSelected(snapshot)}><td><strong>{snapshot.name}</strong><small>{snapshot.spu_id}</small></td><td>{snapshot.store}<small>{snapshot.platform} · {snapshot.operator_ref}</small></td><td>{numberOrUnknown(snapshot.net_sales_prev_month)}</td><td>{percentOrUnknown(snapshot.operating_profit_rate)}</td><td>{percentOrUnknown(snapshot.quality_return_rate_7d)} / {numberOrUnknown(snapshot.inventory_days)}</td><td>{snapshot.decision?.business_action ? actionText[snapshot.decision.business_action] ?? snapshot.decision.business_action : '依据不足'}<small>{snapshot.decision?.trigger_rule ?? '—'}</small></td></tr>)}</tbody></table></div>}</div>
    <div className="panel section-panel"><div className="section-title"><div><h2>导入质量问题</h2><p>每条问题均保留来源、影响与处理方式。</p></div><select value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">全部级别</option><option value="rejected">拒绝</option><option value="degraded">降级</option><option value="warning">警告</option></select></div>{issues.length === 0 ? <p className="muted">当前筛选下没有问题。</p> : <IssueTable issues={issues} />}</div>
    {selected ? <EvidenceDrawer snapshot={selected} onClose={() => setSelected(null)} /> : null}
  </section>
}

function IssueTable({ issues }: { issues: ImportIssue[] }) { return <div className="table-scroll"><table><thead><tr><th>级别</th><th>来源</th><th>字段 / 原值</th><th>原因</th><th>影响与处理</th></tr></thead><tbody>{issues.map((issue, index) => <tr key={`${issue.source_sheet}-${issue.source_row}-${issue.code}-${index}`}><td><span className={`quality quality-${issue.severity}`}>{issue.severity}</span></td><td>{issue.source_sheet || '工作簿'}{issue.source_row ? ` · 第 ${issue.source_row} 行` : ''}<small>{issue.spu_id ?? '全局'}</small></td><td>{issue.field}<small>{issue.raw_value || '空值'}</small></td><td>{issue.reason}</td><td>{issue.impact}<small>{issue.resolution}</small></td></tr>)}</tbody></table></div> }
function EvidenceDrawer({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={event => event.stopPropagation()}><div className="section-title"><div><p className="overline">来源证据</p><h2>{snapshot.name}</h2><p>{snapshot.spu_id} · {snapshot.source_sheet} 第 {snapshot.source_row} 行</p></div><button className="icon-button" aria-label="关闭证据抽屉" onClick={onClose}>×</button></div><h3>字段质量</h3><dl>{Object.entries(snapshot.quality).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><h3>原始字段</h3><dl>{Object.entries(snapshot.raw_values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || '空值'}</dd></div>)}</dl><h3>规则证据</h3><pre>{JSON.stringify(snapshot.decision?.evidence ?? {}, null, 2)}</pre></aside></div> }
function Stat({ label, value }: { label: string; value: string | number | null }) { return <div className="stat"><span>{label}</span><strong>{value ?? '—'}</strong></div> }
function batchStatus(value: string) { return ({ received: '已接收', processing: '处理中', ready: '已完成', failed: '失败' } as Record<string, string>)[value] ?? value }
function numberOrUnknown(value: number | null) { return value === null ? '未知' : value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) }
function percentOrUnknown(value: number | null) { return value === null ? '未知' : `${(value * 100).toFixed(2)}%` }
function errorText(code?: string) { return ({ invalid_complete_natural_month: '期间必须是完整自然月，且业务截止日不得早于期间结束日。', xlsx_file_required: '请选择有效的 .xlsx 文件。', forbidden: '当前角色只能查看批次，不能上传。' } as Record<string, string>)[code ?? ''] ?? '批次创建失败，请核对内容后重试。' }
