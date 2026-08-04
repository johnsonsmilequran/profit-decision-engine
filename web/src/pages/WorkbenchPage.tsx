import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getWorkbench } from '../api'
import { AppShell } from '../components/AppShell'
import { ActionTable } from '../components/ActionTable'

export function WorkbenchPage({ expectedRole }: { expectedRole: 'operations' | 'supervisor' }) {
  const query = useQuery({ queryKey: ['workbench'], queryFn: ({ signal }) => getWorkbench(signal) })
  if (query.data && query.data.role !== expectedRole) {
    window.location.replace(query.data.role === 'supervisor' ? '/workbench/supervisor' : '/workbench/operations')
    return null
  }
  const supervisor = expectedRole === 'supervisor'
  return <AppShell active="workbench"><section data-page-id={supervisor ? 'PAGE-F06-01' : 'PAGE-F05-01'}>
    <div className="page-heading"><div><p className="overline">{supervisor ? '运营主管工作台' : '运营工作台'}</p><h1>{supervisor ? '审核与风险总览' : '我的经营行动'}</h1><p className="muted">{query.data?.latest_batch_code ? `${query.data.latest_batch_code} · 更新于 ${new Date(query.data.batch_completed_at).toLocaleString('zh-CN')}` : '等待最新成功批次'}</p></div><div className="heading-actions"><a className="button" href="/batches">批次详情</a><a className="button primary-button" href="/actions">全部行动</a></div></div>
    {query.isPending ? <State title="正在加载工作台" body="正在按当前身份读取真实任务。" /> : query.isError ? <State title="工作台加载失败" body="未显示任何可能过期的经营数据。" action={<button className="button" onClick={() => query.refetch()}>重新加载</button>} /> : query.data ? <>
      <div className="stat-row">{supervisor ? <><Stat label="待审核建议" value={query.data.pending_review_count} tone="warn" /><Stat label="待确认清仓" value={query.data.clearance_confirm_count} tone="danger" /><Stat label="动作变化/异常" value={query.data.exception_count} /><Stat label="待执行动作" value={query.data.pending_execution_count} /></> : <><Stat label="待执行" value={query.data.pending_execution_count} tone="warn" /><Stat label="清仓待确认" value={query.data.clearance_confirm_count} tone="danger" /><Stat label="待审核" value={query.data.pending_review_count} /><Stat label="数据限制" value={query.data.items.filter(item => Object.values(item.quality).some(value => value !== 'valid')).length} /></>}</div>
      <div className="panel section-panel"><div className="section-title"><div><h2>{supervisor ? '优先审核与确认' : '优先待办'}</h2><p>{supervisor ? '工作台只提供逐条详情入口，不进行批量审核或代运营执行。' : '仅展示当前身份负责的 SPU；最近前序记录默认折叠。'}</p></div></div><ActionTable items={query.data.items} /></div>
      <div className="workbench-lower"><div className="panel section-panel"><h2>{supervisor ? '异常与冲突' : '数据限制'}</h2><p className="muted">{supervisor ? `当前有 ${query.data.exception_count} 条动作变化需要逐条确认。并发冲突不会覆盖已成功事实。` : '“数据不足/未校验”不会以 0 补齐；依赖缺失字段的动作不会生成。'}</p></div><div className="panel section-panel"><h2>流程责任</h2><p className="muted">固定规则生成 → 主管整体审核 → 责任运营分别执行经营与 OA 协同 → 记录结果与完成确认。</p></div></div>
    </> : null}
  </section></AppShell>
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) { return <div className={`stat ${tone ? `stat-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></div> }
function State({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="panel empty-state"><strong>{title}</strong><p>{body}</p>{action}</div> }
