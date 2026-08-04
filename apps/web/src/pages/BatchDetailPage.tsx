import { ArrowRight, ArrowsClockwise } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { BatchDetail, CurrentUser } from "../api";
import { ApiRequestError, loadBatchDetail } from "../api";
import { AppShell } from "../components/AppShell";

const terminal = new Set(["list_ready", "failed"]);
const statusLabel: Record<string, string> = {
  received: "已接收", validating: "校验中", rules_processing: "规则处理中",
  list_ready: "清单已就绪", failed: "导入失败",
};
const inventoryActionLabel: Record<string, string> = {
  block_restock: "禁止补货", restock: "补货", no_restock: "不补货", not_generated: "未生成",
};
function percent(value: string | null) { return value === null ? "—" : `${(Number(value) * 100).toFixed(2)}%`; }
function numeric(value: string | null) { return value === null ? "—" : Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 }); }

function ProcurementTable({ detail }: { detail: Extract<BatchDetail, { currentRole: "procurement" }> }) {
  return (
    <section className="panel table-panel">
      <header className="section-heading"><div><h2>采购库存任务依据</h2><p>仅展示库存、在途、最近 14 天销量和库存动作。</p></div></header>
      <div className="responsive-table"><table>
        <thead><tr><th>SPU / 商品</th><th>店铺 / 平台</th><th className="number">仓内 / 在途</th><th className="number">14 天销量 / 可售天数</th><th>补货动作</th><th>状态</th></tr></thead>
        <tbody>{detail.inventoryTasks.map((item) => (
          <tr key={item.spu_id}>
            <td><strong><code>{item.spu_id}</code></strong><small>{item.link_name}</small></td>
            <td>{item.shop}<small>{item.platform}</small></td>
            <td className="number"><code>{numeric(item.warehouse_inventory)} / {numeric(item.in_transit_inventory)}</code></td>
            <td className="number"><code>{numeric(item.sold_count_14d)} / {numeric(item.stock_days)}</code></td>
            <td>{inventoryActionLabel[item.inventory_action] ?? item.inventory_action}</td>
            <td><span className="pill pill--warn">{item.action_status}</span></td>
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}

function StandardTables({ detail }: { detail: Extract<BatchDetail, { currentRole: "operator" | "manager" }> }) {
  const [impact, setImpact] = useState("");
  const issues = detail.issues.filter((item) => !impact || item.impact === impact);
  return <>
    <section className="panel table-panel">
      <header className="section-heading"><div><h2>校验问题明细</h2><p>身份错误拒绝整行；指标错误仅停止依赖判断。</p></div><select value={impact} onChange={(event) => setImpact(event.target.value)} aria-label="问题影响范围"><option value="">全部影响范围</option><option value="rejected">拒绝行</option><option value="field_degraded">字段降级</option><option value="warning">警告</option></select></header>
      <div className="responsive-table"><table>
        <thead><tr><th>源位置</th><th>SPU</th><th>字段</th><th>问题与影响</th><th>处理</th></tr></thead>
        <tbody>{issues.map((item, index) => <tr key={`${item.worksheet_name}-${item.row_number}-${item.field_name}-${index}`}><td><code>{item.worksheet_name}!{item.row_number}</code></td><td><code>{item.spu_id ?? "—"}</code></td><td>{item.field_name}</td><td>{item.message}<small>{item.raw_value_summary ? `源值摘要：${item.raw_value_summary}` : ""}</small></td><td><span className={`pill pill--${item.impact === "rejected" ? "danger" : "warn"}`}>{item.impact === "rejected" ? "拒绝行" : item.impact === "field_degraded" ? "字段降级" : "警告"}</span></td></tr>)}</tbody>
      </table></div>
    </section>
    <section className="panel table-panel">
      <header className="section-heading"><div><h2>指标采用结果</h2><p>每个值均来自冻结快照，不使用默认值或 AI 补数。</p></div></header>
      <div className="responsive-table"><table>
        <thead><tr><th>SPU / 商品</th><th className="number">净销售额</th><th className="number">经营准利润率</th><th className="number">最近 7 天品退率</th><th className="number">库存可售天数</th><th>质量限制</th></tr></thead>
        <tbody>{detail.metrics.map((item) => <tr key={item.spu_id}><td><strong><code>{item.spu_id}</code></strong><small>{item.link_name} · {item.shop} / {item.platform}</small></td><td className="number"><code>{numeric(item.net_sales)}</code><small>{item.metric_periods.netSales}</small></td><td className="number"><code>{percent(item.profit_rate)}</code><small>{item.metric_periods.profitRate}</small></td><td className="number"><code>{percent(item.return_rate)}</code><small>{item.metric_periods.returnRate}</small></td><td className="number"><code>{numeric(item.stock_days)}</code><small>{item.metric_periods.stockDays}</small></td><td>{Object.keys(item.quality_statuses).length === 0 ? <span className="pill pill--success">有效</span> : <span className="pill pill--warn">{Object.keys(item.quality_statuses).length} 项降级</span>}</td></tr>)}</tbody>
      </table></div>
    </section>
  </>;
}

export function BatchDetailPage({ user }: { user: CurrentUser }) {
  const { batchId } = useParams({ from: "/batches/$batchId" });
  const search = useSearch({ from: "/batches/$batchId" });
  const query = useQuery({
    queryKey: ["batch", batchId], queryFn: () => loadBatchDetail(batchId),
    refetchInterval: (state) => state.state.data && !terminal.has(state.state.data.batch.status) ? 1500 : false,
  });
  const forbidden = query.error instanceof ApiRequestError && query.error.status === 403;
  useEffect(() => { if (forbidden) window.location.replace("/forbidden"); }, [forbidden]);

  return (
    <AppShell user={user}><div className="workspace batch-page" data-page-id="PAGE-F01-03">
      <div className="breadcrumb">数据批次 / <span><code>{batchId}</code></span></div>
      {search.duplicate === "1" && <div className="notice">相同事业部、期间、截止日与文件内容的批次已存在，已返回原批次，不会产生第二份清单。</div>}
      {query.isLoading && <section className="panel loading-panel">正在读取批次冻结快照…</section>}
      {query.isError && !forbidden && <section className="panel error-panel"><h2>批次详情加载失败</h2><p>批次 ID：<code>{batchId}</code>。请在原对象上重试，不要重复导入。</p><button className="button button--secondary" onClick={() => query.refetch()}><ArrowsClockwise />重新加载</button></section>}
      {query.data && <>
        <header className="page-heading"><div><h1>{query.data.batch.period_start.slice(0, 7)} 经营批次</h1><p><code>{query.data.batch.id}</code> · {query.data.batch.business_unit} · 截止日 {query.data.batch.business_date.slice(0, 10)}</p></div>{query.data.batch.status === "list_ready" && <a className="button button--primary" href={`/actions?batchId=${query.data.batch.id}`}>进入行动清单<ArrowRight /></a>}</header>
        <section className="panel batch-summary"><div><small>数据期间</small><strong><code>{query.data.batch.period_start.slice(0, 10)}—{query.data.batch.period_end.slice(0, 10)}</code></strong></div><div><small>固定规则</small><strong><span className={`pill pill--${query.data.batch.status === "list_ready" ? "success" : query.data.batch.status === "failed" ? "danger" : "warn"}`}>{statusLabel[query.data.batch.status] ?? query.data.batch.status}</span></strong></div><div><small>AI 解释</small><strong><span className="pill pill--warn">{query.data.batch.ai_status}</span></strong></div><div><small>源文件</small><strong>{query.data.batch.original_filename}</strong></div><div><small>提交时间</small><strong>{new Date(query.data.batch.created_at).toLocaleString("zh-CN", { hour12: false })}</strong></div></section>
        {query.data.batch.status === "failed" && <div className="notice notice--error">{query.data.batch.failure_message ?? "文件处理失败，未生成行动清单。"}</div>}
        <section className="stats-grid"><div className="panel"><small>原始 SPU 明细</small><strong>{query.data.batch.source_row_count}</strong></div><div className="panel stats-success"><small>有效身份行</small><strong>{query.data.batch.valid_row_count}</strong></div><div className="panel stats-danger"><small>拒绝行</small><strong>{query.data.batch.rejected_row_count}</strong></div><div className="panel stats-warn"><small>字段级降级</small><strong>{query.data.batch.degraded_field_count}</strong></div></section>
        {query.data.currentRole === "procurement" ? <ProcurementTable detail={query.data} /> : <StandardTables detail={query.data} />}
      </>}
    </div></AppShell>
  );
}
