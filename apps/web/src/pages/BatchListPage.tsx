import { ArrowLeft, ArrowRight, MagnifyingGlass, UploadSimple } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import type { CurrentUser } from "../api";
import { loadBatches } from "../api";
import { AppShell } from "../components/AppShell";

const statusLabel: Record<string, string> = {
  received: "已接收", validating: "校验中", rules_processing: "规则处理中",
  list_ready: "清单已就绪", failed: "导入失败",
};
const aiLabel: Record<string, string> = {
  pending: "待生成", generating: "生成中", generated: "已生成", failed: "生成失败",
};

export function BatchListPage({ user }: { user: CurrentUser }) {
  const search = useSearch({ from: "/batches" });
  const navigate = useNavigate({ from: "/batches" });
  const [keyword, setKeyword] = useState(search.keyword ?? "");
  const query = useQuery({
    queryKey: ["batches", search],
    queryFn: () => loadBatches({ ...search, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  function applyFilters(next: Partial<typeof search> = {}) {
    navigate({ search: (previous) => ({ ...previous, ...next, keyword: keyword || undefined, page: 1 }) });
  }

  return (
    <AppShell user={user}>
      <div className="workspace batch-page" data-page-id="PAGE-F01-01">
        <div className="breadcrumb">数据批次 / <span>批次列表</span></div>
        <header className="page-heading">
          <div><h1>数据批次</h1><p>每个批次保留独立数据口径、处理状态与唯一行动清单。</p></div>
          {user.role === "operator" && <a className="button button--primary" href="/batches/new"><UploadSimple />新建数据导入</a>}
        </header>
        <section className="panel filters">
          <label><MagnifyingGlass /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} placeholder="搜索批次 ID 或文件名" aria-label="批次关键词" /></label>
          <select value={search.status ?? ""} onChange={(event) => applyFilters({ status: (event.target.value || undefined) as typeof search.status })} aria-label="处理状态">
            <option value="">全部处理状态</option><option value="list_ready">清单已就绪</option>
            <option value="received">已接收</option><option value="validating">校验中</option>
            <option value="rules_processing">规则处理中</option><option value="failed">导入失败</option>
          </select>
          <button className="button button--primary" onClick={() => applyFilters()}>查询</button>
          {(search.keyword || search.status) && <button className="button button--secondary" onClick={() => { setKeyword(""); navigate({ search: { page: 1 } }); }}>清除筛选</button>}
        </section>
        {query.isLoading && <section className="panel loading-panel">正在读取不可变批次…</section>}
        {query.isError && <section className="panel error-panel"><h2>批次列表加载失败</h2><p>当前条件未被改为空结果。请保留筛选并重试。</p><button className="button button--secondary" onClick={() => query.refetch()}>原条件重试</button></section>}
        {query.data && (
          <section className="panel table-panel">
            <div className="responsive-table"><table>
              <thead><tr><th>批次 / 数据期间</th><th>业务截止日</th><th className="number">有效 / 拒绝 / 降级</th><th>固定规则</th><th>AI 解释</th><th>创建信息</th><th><span className="sr-only">操作</span></th></tr></thead>
              <tbody>{query.data.items.map((batch) => (
                <tr key={batch.id}>
                  <td><strong><code>{batch.id}</code></strong><small>{batch.period_start.slice(0, 10)}—{batch.period_end.slice(0, 10)} · {batch.business_unit}</small></td>
                  <td><code>{batch.business_date.slice(0, 10)}</code></td>
                  <td className="number"><code>{batch.valid_row_count} / {batch.rejected_row_count} / {batch.degraded_field_count}</code></td>
                  <td><span className={`pill pill--${batch.status === "list_ready" ? "success" : batch.status === "failed" ? "danger" : "warn"}`}>{statusLabel[batch.status] ?? batch.status}</span></td>
                  <td><span className={`pill pill--${batch.ai_status === "generated" ? "success" : batch.ai_status === "failed" ? "danger" : "warn"}`}>{aiLabel[batch.ai_status] ?? batch.ai_status}</span></td>
                  <td><span>{batch.created_by_name}</span><small>{new Date(batch.created_at).toLocaleString("zh-CN", { hour12: false })}</small></td>
                  <td><a className="text-link" href={`/batches/${batch.id}`}>查看详情<ArrowRight /></a></td>
                </tr>
              ))}</tbody>
            </table></div>
            {query.data.items.length === 0 ? (
              <div className="inline-empty">{search.keyword || search.status ? "当前条件无匹配批次，可清除筛选恢复。" : user.role === "operator" ? "尚无批次，请新建数据导入。" : "当前角色暂无可查看批次。"}</div>
            ) : (
              <footer className="pagination">
                <span>共 {query.data.total} 个批次 · 第 {(search.page - 1) * 10 + 1}—{Math.min(search.page * 10, query.data.total)} 条</span>
                <div>
                  <button className="button button--secondary" disabled={search.page <= 1} onClick={() => navigate({ search: (previous) => ({ ...previous, page: previous.page - 1 }) })}><ArrowLeft />上一页</button>
                  <span>第 {search.page} 页</span>
                  <button className="button button--secondary" disabled={search.page * 10 >= query.data.total} onClick={() => navigate({ search: (previous) => ({ ...previous, page: previous.page + 1 }) })}>下一页<ArrowRight /></button>
                </div>
              </footer>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
