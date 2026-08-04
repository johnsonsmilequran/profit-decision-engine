import { ArrowRight, ArrowUpRight, GitBranch, ListMagnifyingGlass, Stack } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import type { CurrentUser, Workspace } from "../api";
import { loadWorkspace } from "../api";
import { AppShell } from "../components/AppShell";

const actionLabel: Record<string, string> = {
  clearance: "清仓", stop_loss: "止损", observe: "观察", increase_investment: "加投",
  maintain: "保持", undetermined: "待判断", block_restock: "禁补", restock: "补货",
  no_restock: "不补货", not_generated: "未生成",
};
const statusLabel: Record<string, string> = {
  awaiting_review: "待审核", pending_execution: "待执行", executed: "已执行",
  result_recorded: "已记录结果", closed_by_rejection: "已驳回关闭",
};

function formatPeriod(value: string): string {
  return value.slice(0, 10);
}

function BatchCard({ workspace }: { workspace: Workspace }) {
  const batch = workspace.latestBatch;
  if (!batch) return <section className="panel empty-panel"><h2>尚无业务批次</h2><p>当前没有可供此角色查看的批次。运营可前往数据批次导入，其他角色将在清单就绪后看到待办。</p></section>;
  return (
    <section className="panel latest-batch">
      <span className="batch-icon"><Stack /></span>
      <div className="latest-batch__text"><div><h2>{formatPeriod(batch.period_start).slice(0, 7)} 经营批次</h2><span className={`pill ${batch.status === "list_ready" ? "pill--success" : "pill--warn"}`}>{batch.status === "list_ready" ? "清单已就绪" : "处理中"}</span><span className="pill pill--warn">AI {batch.ai_status}</span></div><p><code>{batch.id}</code> · 期间 {formatPeriod(batch.period_start)}—{formatPeriod(batch.period_end)} · 业务截止日 {formatPeriod(batch.business_date)} · {batch.valid_row_count} 个有效 SPU</p></div>
      <a className="panel-link" href={`/batches/${batch.id}`}>查看批次详情<ArrowRight /></a>
    </section>
  );
}

function RiskCards({ workspace }: { workspace: Workspace }) {
  const counts = workspace.currentRole === "procurement" ? workspace.inventoryCounts : workspace.riskCounts;
  if (!counts) return null;
  const keys = workspace.currentRole === "procurement"
    ? ["block_restock", "restock", "no_restock", "not_generated"]
    : ["clearance", "stop_loss", "observe", "increase_investment"];
  return <section className="risk-grid">{keys.map((key) => <a className="panel risk-card" href={`/actions?action=${key}`} key={key}><span className={`pill pill--${["clearance", "stop_loss", "block_restock"].includes(key) ? "danger" : key === "observe" ? "warn" : "accent"}`}>{actionLabel[key]}</span><ArrowUpRight /><strong>{counts[key] ?? 0}</strong><small>所属最新就绪批次</small></a>)}</section>;
}

function Tasks({ workspace }: { workspace: Workspace }) {
  const tasks = workspace.tasks ?? [];
  const title = workspace.currentRole === "manager" ? "待我审核" : workspace.currentRole === "operator" ? "我的经营待办" : "我的采购待办";
  return <section className={`panel tasks-panel ${workspace.currentRole === "procurement" ? "tasks-panel--wide" : ""}`}><header><div><h2>{title}</h2><p>按风险与待处理状态排列</p></div><span className="pill pill--accent">{tasks.length} 条</span></header>{tasks.length === 0 ? <div className="inline-empty">当前角色暂无待办</div> : <div className="task-list">{tasks.map((task) => <a href={`/actions/${task.decision_id}`} key={task.decision_id}><span className={`pill pill--${("main_action" in task && ["clearance", "stop_loss"].includes(task.main_action)) || ("inventory_action" in task && task.inventory_action === "block_restock") ? "danger" : "warn"}`}>{actionLabel["main_action" in task ? task.main_action : task.inventory_action] ?? "待处理"}</span><div><strong>{task.link_name}</strong><small><code>{task.spu_id}</code></small></div><div className="task-status"><strong>{statusLabel["business_status" in task ? task.business_status : task.inventory_status] ?? "待处理"}</strong>{"inventory_status" in task && workspace.currentRole !== "procurement" && <small>采购：{statusLabel[task.inventory_status] ?? task.inventory_status}</small>}</div><ArrowRight /></a>)}</div>}</section>;
}

function Blockers({ workspace }: { workspace: Extract<Workspace, { currentRole: "operator" | "manager" }> }) {
  const blockers = workspace.blockers ?? [];
  return <section className="panel blockers"><header><div><h2>跨部门卡点</h2><p>经营与补货动作进度不一致</p></div><span className="pill pill--warn">{blockers.length} 条</span></header>{blockers.length === 0 ? <div className="inline-empty">当前没有跨部门卡点</div> : <div className="blocker-list">{blockers.map((item) => <a href={`/actions/${item.decision_id}`} key={item.decision_id}><div className="blocker-title"><strong>{item.link_name}</strong><ArrowUpRight /></div><div className="blocker-rail"><span><small>经营动作</small><strong>{actionLabel[item.main_action]} · {statusLabel[item.business_status]}</strong></span><GitBranch /><span><small>补货动作</small><strong>{actionLabel[item.inventory_action]} · {statusLabel[item.inventory_status]}</strong></span></div></a>)}</div>}</section>;
}

export function WorkspacePage({ user }: { user: CurrentUser }) {
  const query = useQuery({ queryKey: ["workspace"], queryFn: loadWorkspace });
  return <AppShell user={user}><div className="topbar"><span>工作台 / 本周经营</span></div><div className="workspace" data-page-id="PAGE-F00-01"><section className="workspace-title"><div><small>当前角色：{user.displayName}</small><h1>{user.role === "manager" ? "先处理需要拍板的经营风险" : "先处理本周需要推进的行动"}</h1><p>固定规则形成唯一清单，AI 解释失败不影响审核和执行。</p></div><a className="button button--primary" href="/actions"><ListMagnifyingGlass />查看全部行动</a></section>{query.isLoading && <section className="panel loading-panel">正在按当前角色加载经营任务…</section>}{query.isError && <section className="panel error-panel"><h2>工作台数据暂不可用</h2><p>这不是“零任务”。请检查网络后重试，或前往历史追溯查看已完成批次。</p><button className="button button--secondary" onClick={() => query.refetch()}>重新加载</button></section>}{query.data && <><BatchCard workspace={query.data} />{!query.data.processing && <><RiskCards workspace={query.data} /><section className="workspace-columns"><Tasks workspace={query.data} />{query.data.currentRole !== "procurement" && <Blockers workspace={query.data} />}</section></>}</>}</div></AppShell>;
}
