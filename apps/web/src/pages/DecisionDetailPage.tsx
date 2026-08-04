import { ArrowLeft, GitBranch, Robot, ShieldCheck } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type { CurrentUser, DecisionDetail } from "../api.ts";
import { loadDecisionDetail } from "../api.ts";
import { AppShell } from "../components/AppShell.tsx";

const actionLabel: Record<string, string> = { clearance: "清仓", stop_loss: "止损", observe: "观察", increase_investment: "加投", restock: "补货", block_restock: "禁止补货", no_restock: "不补货" };
const statusLabel: Record<string, string> = { pending: "待审核", approved: "已通过", rejected: "已驳回", awaiting_review: "等待审核", pending_execution: "待执行", executed: "已执行", result_recorded: "已记录结果", closed_by_rejection: "驳回关闭" };

function MetricQuality({ decision }: { decision: DecisionDetail["decision"] }) {
  return <details><summary>查看字段周期与质量状态</summary><pre>{JSON.stringify({ periods: decision.metric_periods, quality: decision.quality_statuses }, null, 2)}</pre></details>;
}

function Timeline({ events }: { events: DecisionDetail["timeline"] }) {
  return <div className="timeline">{events.length === 0 ? <p>当前尚无该动作的执行事件。</p> : events.map((event) => <div key={event.id}><i /><span><strong>{event.event_type}</strong><small>{event.actor_name ?? "系统"} · {new Date(event.created_at).toLocaleString("zh-CN", { hour12: false })}</small></span></div>)}</div>;
}

function StandardDetail({ data }: { data: Extract<DecisionDetail, { currentRole: "operator" | "manager" }> }) {
  const d = data.decision;
  const businessAction = data.actions.find((action) => action.action_track === "business");
  return <>
    <header className="page-heading"><div><small className="eyebrow">{d.spu_id} · {d.shop} · {d.platform}</small><h1>{d.link_name}</h1><p>规则版本 <code>{d.rule_version}</code> · 批次期间 {d.period_start.slice(0, 10)}—{d.period_end.slice(0, 10)}</p></div><div className="decision-actions"><span className={`pill pill--${d.approval_status === "approved" ? "success" : d.approval_status === "rejected" ? "danger" : "warn"}`}>{statusLabel[d.approval_status] ?? d.approval_status}</span><span className={`pill pill--${d.inventory_action === "block_restock" ? "danger" : "warn"}`}>{actionLabel[d.inventory_action] ?? d.inventory_action}</span>{data.currentRole === "manager" && d.approval_status === "pending" && <a className="button button--primary" href={`/decisions/${d.decision_id}/review`}>审核建议</a>}{data.currentRole === "operator" && businessAction?.status === "pending_execution" && <a className="button button--primary" href={`/decisions/${d.decision_id}/operations-action/execute`}>记录经营执行</a>}{data.currentRole === "operator" && businessAction?.status === "executed" && <a className="button button--primary" href={`/decisions/${d.decision_id}/operations-outcome`}>登记经营结果</a>}</div></header>
    <section className="advice-grid">{(["object", "problem", "evidence", "action"] as const).map((key, index) => <article className="panel advice-card" key={key}><small>0{index + 1} · {({ object: "对象", problem: "问题", evidence: "关键依据", action: "推荐动作" })[key]}</small><strong>{d.structured_advice[key]}</strong></article>)}</section>
    <section className="detail-columns"><div className="detail-stack">
      <section className="panel detail-section"><header><h2>指标与口径</h2><span className="pill pill--accent">冻结快照</span></header><div className="metric-grid"><div><small>经营准利润率</small><strong className={Number(d.profit_rate) < 0 ? "danger" : ""}>{d.profit_rate === null ? "不可用" : `${(Number(d.profit_rate) * 100).toFixed(1)}%`}</strong></div><div><small>销售收入</small><strong>{d.net_sales === null ? "不可用" : `¥${Number(d.net_sales).toLocaleString("zh-CN")}`}</strong></div><div><small>品退率</small><strong>{d.return_rate === null ? "不可用" : `${(Number(d.return_rate) * 100).toFixed(2)}%`}</strong></div><div><small>库存天数</small><strong>{d.stock_days ?? "不可用"}</strong></div><div><small>仓内 / 在途</small><strong>{d.warehouse_inventory ?? "—"} / {d.in_transit_inventory ?? "—"}</strong></div><div><small>近 14 天销量</small><strong>{d.sold_count_14d ?? "不可用"}</strong></div></div><MetricQuality decision={d} /></section>
      <section className="panel detail-section"><header><h2><Robot />AI 解释</h2><span className="pill pill--warn">{d.ai_status}</span></header><p>{d.ai_status === "generated" ? d.ai_explanation : d.ai_status === "failed" ? "AI 解释生成失败，不影响固定规则结论。" : "AI 解释正在独立生成，审核与执行无需等待。"}</p></section>
    </div><aside className="detail-stack">
      <section className="panel detail-section"><header><h2><GitBranch />双轨行动</h2></header><div className="track-list">{data.actions.map((action) => <div className="track-card" key={action.id}><small>{action.action_track === "business" ? "经营动作 · 运营" : "库存动作 · 采购计划"}</small><strong>{actionLabel[action.action_code] ?? action.action_code}</strong><span>{statusLabel[action.status] ?? action.status} · v{action.version}</span>{action.result_note && <p>{action.result_note}</p>}</div>)}</div></section>
      <section className="panel detail-section"><header><h2><ShieldCheck />追加时间线</h2></header><Timeline events={data.timeline} /></section>
    </aside></section>
  </>;
}

function ProcurementDetail({ data }: { data: Extract<DecisionDetail, { currentRole: "procurement" }> }) {
  const d = data.decision;
  return <><header className="page-heading"><div><small className="eyebrow">{d.spu_id} · {d.shop} · {d.platform}</small><h1>{d.link_name}</h1><p>库存任务 · 规则版本 <code>{d.rule_version}</code></p></div><div className="decision-actions"><span className={`pill pill--${d.inventory_action === "block_restock" ? "danger" : "warn"}`}>{actionLabel[d.inventory_action] ?? d.inventory_action}</span>{d.status === "pending_execution" && <a className="button button--primary" href={`/decisions/${d.decision_id}/procurement-action/execute`}>记录采购处理</a>}</div></header><section className="detail-columns"><div className="detail-stack"><section className="panel detail-section"><header><h2>库存与销量依据</h2><span className="pill pill--accent">必要字段</span></header><div className="metric-grid"><div><small>库存天数</small><strong>{d.stock_days ?? "不可用"}</strong></div><div><small>仓内 / 在途</small><strong>{d.warehouse_inventory ?? "—"} / {d.in_transit_inventory ?? "—"}</strong></div><div><small>近 14 天销量</small><strong>{d.sold_count_14d ?? "不可用"}</strong></div></div><MetricQuality decision={d} /></section></div><aside className="detail-stack"><section className="panel detail-section"><header><h2><GitBranch />库存行动</h2></header><div className="track-card"><small>库存动作 · 采购计划</small><strong>{actionLabel[d.inventory_action] ?? d.inventory_action}</strong><span>{statusLabel[d.status] ?? d.status} · v{d.version}</span></div></section><section className="panel detail-section"><header><h2><ShieldCheck />库存动作时间线</h2></header><Timeline events={data.timeline} /></section></aside></section></>;
}

export function DecisionDetailPage({ user }: { user: CurrentUser }) {
  const { decisionId } = useParams({ from: "/decisions/$decisionId" });
  const query = useQuery({ queryKey: ["decision", decisionId], queryFn: () => loadDecisionDetail(decisionId) });
  return <AppShell user={user}><div className="workspace decision-page" data-page-id="PAGE-F05-02"><div className="breadcrumb"><a className="text-link" href={query.data ? `/action-lists/${query.data.decision.batch_id}?page=1` : "/workspace"}><ArrowLeft />返回行动清单</a></div>{query.isLoading && <section className="panel loading-panel">正在读取冻结建议与执行时间线…</section>}{query.isError && <section className="panel error-panel"><h2>建议详情加载失败</h2><p>未用空状态替代错误，请刷新当前版本后重试。</p><button className="button button--secondary" onClick={() => query.refetch()}>重新加载</button></section>}{query.data && (query.data.currentRole === "procurement" ? <ProcurementDetail data={query.data} /> : <StandardDetail data={query.data} />)}</div></AppShell>;
}
