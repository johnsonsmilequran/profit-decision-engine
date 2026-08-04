import { ArrowLeft, ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import type { CurrentUser } from "../api.ts";
import { loadActionList } from "../api.ts";
import { AppShell } from "../components/AppShell.tsx";

const actionLabel: Record<string, string> = { clearance: "清仓", stop_loss: "止损", observe: "观察", increase_investment: "加投", restock: "补货", block_restock: "禁止补货" };
const statusLabel: Record<string, string> = { pending: "待审核", approved: "已通过", rejected: "已驳回", awaiting_review: "等待审核", pending_execution: "待执行", executed: "已执行", result_recorded: "已记录结果", closed_by_rejection: "驳回关闭" };

export function ActionListPage({ user }: { user: CurrentUser }) {
  const { batchId } = useParams({ from: "/action-lists/$batchId" });
  const search = useSearch({ from: "/action-lists/$batchId" });
  const navigate = useNavigate({ from: "/action-lists/$batchId" });
  const [keyword, setKeyword] = useState(search.keyword ?? "");
  const query = useQuery({ queryKey: ["action-list", batchId, search], queryFn: () => loadActionList(batchId, { ...search, pageSize: 20 }), placeholderData: keepPreviousData });
  const apply = (next: Partial<typeof search> = {}) => navigate({ search: (previous) => ({ ...previous, ...next, keyword: keyword || undefined, page: 1 }) });
  return <AppShell user={user}><div className="workspace batch-page" data-page-id="PAGE-F05-01">
    <div className="breadcrumb">行动清单 / <span>{query.data?.batch.period_start.slice(0, 7) ?? "批次清单"}</span></div>
    <header className="page-heading"><div><h1>{user.role === "procurement" ? "采购行动清单" : "商品经营行动清单"}</h1><p>固定规则排序；AI 解释状态不影响审核与执行。</p></div>{query.data && <span className="pill pill--accent">共 {query.data.total} 条</span>}</header>
    <section className="panel filters action-filters">
      <label><MagnifyingGlass /><input aria-label="搜索 SPU" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && apply()} placeholder="搜索 SPU 编号或名称" /></label>
      <select aria-label="动作" value={search.action ?? ""} onChange={(event) => apply({ action: (event.target.value || undefined) as typeof search.action })}><option value="">全部动作</option>{user.role !== "procurement" && <><option value="clearance">清仓</option><option value="stop_loss">止损</option><option value="observe">观察</option><option value="increase_investment">加投</option></>}<option value="block_restock">禁止补货</option><option value="restock">补货</option></select>
      {user.role !== "procurement" && <select aria-label="审核状态" value={search.approvalStatus ?? ""} onChange={(event) => apply({ approvalStatus: (event.target.value || undefined) as typeof search.approvalStatus })}><option value="">全部审核状态</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select>}
      <select aria-label="执行状态" value={search.executionStatus ?? ""} onChange={(event) => apply({ executionStatus: (event.target.value || undefined) as typeof search.executionStatus })}><option value="">全部执行状态</option><option value="awaiting_review">等待审核</option><option value="pending_execution">待执行</option><option value="executed">已执行</option><option value="result_recorded">已记录结果</option></select>
      <button className="button button--primary" onClick={() => apply()}>查询</button>
    </section>
    {query.isLoading && <section className="panel loading-panel">正在读取本批次唯一行动清单…</section>}
    {query.isError && <section className="panel error-panel"><h2>行动清单加载失败</h2><p>当前条件没有被当成零结果，请按原条件重试。</p><button className="button button--secondary" onClick={() => query.refetch()}>原条件重试</button></section>}
    {query.data && <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>SPU / 店铺</th><th>{user.role === "procurement" ? "库存动作" : "经营 / 库存动作"}</th><th>关键依据</th><th>状态</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{query.data.items.map((item) => <tr key={item.decision_id}>
      <td><strong>{item.link_name}</strong><small><code>{item.spu_id}</code> · {item.shop} · {item.platform}</small></td>
      <td>{"main_action" in item && <span className={`pill pill--${["clearance", "stop_loss"].includes(item.main_action) ? "danger" : "accent"}`}>{actionLabel[item.main_action] ?? item.main_action}</span>} <span className={`pill pill--${item.inventory_action === "block_restock" ? "danger" : "warn"}`}>{actionLabel[item.inventory_action] ?? item.inventory_action}</span></td>
      <td>{"profit_rate" in item ? <><strong className={Number(item.profit_rate) < 0 ? "danger" : ""}>{item.profit_rate === null ? "利润率不可用" : `利润率 ${(Number(item.profit_rate) * 100).toFixed(1)}%`}</strong><small>库存天数 {item.stock_days ?? "不可用"} · 责任运营 {item.operator_name}</small></> : <><strong>库存 {item.warehouse_inventory ?? "不可用"} + 在途 {item.in_transit_inventory ?? "不可用"}</strong><small>近 14 天销量 {item.sold_count_14d ?? "不可用"} · 库存天数 {item.stock_days ?? "不可用"}</small></>}</td>
      <td>{"approval_status" in item ? <><strong>{statusLabel[item.approval_status] ?? item.approval_status}</strong><small>经营：{statusLabel[item.business_status ?? ""] ?? "无任务"} · 库存：{statusLabel[item.inventory_status ?? ""] ?? "无任务"}</small></> : <strong>{statusLabel[item.inventory_status] ?? item.inventory_status}</strong>}</td>
      <td><a className="text-link" href={`/decisions/${item.decision_id}`}>查看建议<ArrowRight /></a></td>
    </tr>)}</tbody></table></div>{query.data.items.length === 0 ? <div className="inline-empty">当前筛选条件无匹配行动，可调整条件后重试。</div> : <footer className="pagination"><span>第 {(search.page - 1) * 20 + 1}—{Math.min(search.page * 20, query.data.total)} 条，共 {query.data.total} 条</span><div><button className="button button--secondary" disabled={search.page <= 1} onClick={() => navigate({ search: (previous) => ({ ...previous, page: previous.page - 1 }) })}><ArrowLeft />上一页</button><span>第 {search.page} 页</span><button className="button button--secondary" disabled={search.page * 20 >= query.data.total} onClick={() => navigate({ search: (previous) => ({ ...previous, page: previous.page + 1 }) })}>下一页<ArrowRight /></button></div></footer>}</section>}
  </div></AppShell>;
}
