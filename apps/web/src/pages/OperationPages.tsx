import { ArrowLeft, CheckCircle, GitBranch, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import type { CurrentUser, DecisionDetail, OutcomeAvailability } from "../api.ts";
import { ApiRequestError, executeAction, loadDecisionDetail, recordOutcome, reviewDecision } from "../api.ts";
import { AppShell } from "../components/AppShell.tsx";

const actionLabel: Record<string, string> = { clearance: "清仓", stop_loss: "止损", observe: "观察", increase_investment: "加投", restock: "补货", block_restock: "禁止补货" };
const statusLabel: Record<string, string> = { pending: "待审核", approved: "已通过", rejected: "已驳回", awaiting_review: "等待审核", pending_execution: "待执行", executed: "已执行", result_recorded: "已记录结果", closed_by_rejection: "驳回关闭" };
type StandardDetail = Extract<DecisionDetail, { currentRole: "operator" | "manager" }>;
type ProcurementDetail = Extract<DecisionDetail, { currentRole: "procurement" }>;

function localDateTime(): string {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return now.toISOString().slice(0, 16);
}
function toIso(value: string): string { return new Date(value).toISOString(); }
function MutationError({ error }: { error: Error | null }) {
  if (!error) return null;
  const conflict = error instanceof ApiRequestError && error.status === 409;
  return <div className={`notice notice--error ${conflict ? "notice--conflict" : ""}`} role="alert"><strong>{conflict ? "状态已变化，请确认最新结果" : "提交未成功"}</strong><p>{error.message}</p>{conflict && <span>当前输入已保留；请在新标签核对详情后再刷新本页。</span>}</div>;
}
function Summary({ data, procurement = false }: { data: StandardDetail | ProcurementDetail; procurement?: boolean }) {
  const d = data.decision;
  const mainAction = !procurement && "main_action" in d ? d.main_action : null;
  return <section className="panel operation-summary"><div><small>操作对象</small><h2>{d.link_name}</h2><p><code>{d.spu_id}</code> · {d.shop} · 规则 <code>{d.rule_version}</code></p></div><div className="operation-tracks">{mainAction && <span><small>经营动作</small><strong>{actionLabel[mainAction] ?? mainAction}</strong></span>}<GitBranch /><span><small>库存动作</small><strong>{actionLabel[d.inventory_action] ?? d.inventory_action}</strong></span></div></section>;
}
function LoadingPage({ user, pageId, children }: { user: CurrentUser; pageId: string; children: (data: DecisionDetail) => React.ReactNode }) {
  const decisionId = pageId === "PAGE-F06-01" ? useParams({ from: "/decisions/$decisionId/review" }).decisionId
    : pageId === "PAGE-F06-02" ? useParams({ from: "/decisions/$decisionId/operations-action/execute" }).decisionId
    : pageId === "PAGE-F06-03" ? useParams({ from: "/decisions/$decisionId/procurement-action/execute" }).decisionId
    : useParams({ from: "/decisions/$decisionId/operations-outcome" }).decisionId;
  const query = useQuery({ queryKey: ["decision-operation", decisionId], queryFn: () => loadDecisionDetail(decisionId) });
  return <AppShell user={user}><div className="workspace operation-page" data-page-id={pageId}><div className="breadcrumb"><a className="text-link" href={`/decisions/${decisionId}`}><ArrowLeft />返回建议详情</a></div>{query.isLoading && <section className="panel loading-panel">正在校验角色、对象与当前版本…</section>}{query.isError && <section className="panel error-panel"><h2>当前表单不可用</h2><p>{query.error.message}</p><a className="button button--secondary" href={`/decisions/${decisionId}`}>返回建议详情</a></section>}{query.data && children(query.data)}</div></AppShell>;
}

type ReviewFields = { result: "approved" | "rejected" | ""; note: string };
function ReviewForm({ data }: { data: StandardDetail }) {
  const d = data.decision;
  const key = useRef(crypto.randomUUID());
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ReviewFields>({ defaultValues: { result: "", note: "" } });
  const result = watch("result");
  const mutation = useMutation({ mutationFn: (fields: ReviewFields) => reviewDecision(d.decision_id, { result: fields.result as "approved" | "rejected", note: fields.note || undefined, version: d.review_version }, key.current), onSuccess: () => window.location.assign(`/decisions/${d.decision_id}`) });
  if (d.approval_status !== "pending") return <section className="panel error-panel"><h2>建议已经完成审核</h2><p>最新状态：{statusLabel[d.approval_status] ?? d.approval_status}。为防止覆盖，本页不再接受提交。</p><a className="button button--secondary" href={`/decisions/${d.decision_id}`}>查看最新状态</a></section>;
  return <><header className="page-heading"><div><h1>审核整条建议</h1><p>一次决定同时作用于全部既有责任动作，不会重新生成动作。</p></div><span className="pill pill--warn">review v{d.review_version}</span></header><Summary data={data} /><form className="panel operation-form" onSubmit={handleSubmit((fields) => mutation.mutate(fields))}><fieldset><legend>审核决定 *</legend><label className="choice-card"><input type="radio" value="approved" {...register("result", { required: "请选择通过或驳回" })} /><CheckCircle /><span><strong>通过建议</strong><small>同时激活经营与库存责任动作</small></span></label><label className="choice-card"><input type="radio" value="rejected" {...register("result", { required: "请选择通过或驳回" })} /><WarningCircle /><span><strong>驳回建议</strong><small>保留原规则与动作结论，关闭执行路径</small></span></label>{errors.result && <p className="field-error">{errors.result.message}</p>}</fieldset><div className="form-field"><label htmlFor="review-note">审核备注{result === "rejected" ? " *" : ""}</label><textarea id="review-note" {...register("note", { validate: (value) => result !== "rejected" || value.trim().length > 0 || "驳回建议时请填写原因" })} placeholder="补充审核说明" />{errors.note && <p className="field-error">{errors.note.message}</p>}</div><MutationError error={mutation.error} /><div className="form-actions"><a className="button button--secondary" href={`/decisions/${d.decision_id}`}>取消</a><button className="button button--primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? "提交中…" : "提交审核"}</button></div></form></>;
}

type ExecuteFields = { executedAt: string; note: string; result: string };
function ExecuteForm({ data, procurement }: { data: StandardDetail | ProcurementDetail; procurement: boolean }) {
  const d = data.decision;
  const action = procurement ? { id: (d as ProcurementDetail["decision"]).action_item_id, action_code: d.inventory_action, status: (d as ProcurementDetail["decision"]).status, version: (d as ProcurementDetail["decision"]).version }
    : (data as StandardDetail).actions.find((item) => item.action_track === "business");
  const key = useRef(crypto.randomUUID());
  const { register, handleSubmit, formState: { errors } } = useForm<ExecuteFields>({ defaultValues: { executedAt: localDateTime(), note: "", result: "" } });
  const mutation = useMutation({ mutationFn: (fields: ExecuteFields) => executeAction(action!.id, { executedAt: toIso(fields.executedAt), note: fields.note, result: fields.result, confirmation: procurement ? d.inventory_action as "restock" | "block_restock" : undefined, version: action!.version }, key.current), onSuccess: () => window.location.assign(`/decisions/${d.decision_id}`) });
  if (!action || action.status !== "pending_execution") return <section className="panel error-panel"><h2>动作当前不可执行</h2><p>{action ? `最新状态：${statusLabel[action.status] ?? action.status}` : "本建议没有当前角色负责的动作。"}</p><a className="button button--secondary" href={`/decisions/${d.decision_id}`}>查看最新状态</a></section>;
  return <><header className="page-heading"><div><h1>{procurement ? `${actionLabel[action.action_code]}处理记录` : `${actionLabel[action.action_code]}执行记录`}</h1><p>{procurement ? "仅记录采购计划人工处理事实，不代表外部采购系统回执。" : "记录 SPU 级线下经营动作，不修改冻结规则结论。"}</p></div><span className="pill pill--accent">action v{action.version}</span></header><Summary data={data} procurement={procurement} /><form className="panel operation-form" onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>{procurement && <section className="inventory-evidence"><div><small>仓内 / 在途</small><strong>{d.warehouse_inventory ?? "—"} / {d.in_transit_inventory ?? "—"}</strong></div><div><small>近 14 天销量</small><strong>{d.sold_count_14d ?? "不可用"}</strong></div><div><small>库存天数</small><strong>{d.stock_days ?? "不可用"}</strong></div></section>}<div className="form-field"><label htmlFor="executed-at">实际处理时间 *</label><input id="executed-at" type="datetime-local" {...register("executedAt", { required: "请填写有效执行时间" })} />{errors.executedAt && <p className="field-error">{errors.executedAt.message}</p>}</div><div className="form-field"><label htmlFor="execution-note">事实备注 *</label><textarea id="execution-note" {...register("note", { required: "请记录实际采取的动作", validate: (value) => value.trim().length > 0 || "备注不能仅为空白" })} placeholder={procurement ? "记录补货或停补处理事实" : "说明实际采取的经营动作"} />{errors.note && <p className="field-error">{errors.note.message}</p>}</div><div className="form-field"><label htmlFor="execution-result">最小处理结果 *</label><textarea id="execution-result" {...register("result", { required: "请填写本次处理结果", validate: (value) => value.trim().length > 0 || "结果不能仅为空白" })} placeholder={procurement && action.action_code === "block_restock" ? "例如：已知悉并停止新增补货" : "如实记录当前已完成事实"} />{errors.result && <p className="field-error">{errors.result.message}</p>}</div><MutationError error={mutation.error} /><div className="form-actions"><a className="button button--secondary" href={`/decisions/${d.decision_id}`}>取消</a><button className="button button--primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? "记录中…" : procurement ? "确认采购处理" : "确认经营执行"}</button></div></form></>;
}

type OutcomeFields = { periodStart: string; periodEnd: string; salesStatus: "provided" | "not_provided"; salesValue: string; profitStatus: "provided" | "not_provided"; profitValue: string; inventoryStatus: "provided" | "not_provided"; inventoryValue: string; note: string };
function availability(status: "provided" | "not_provided", value: string): OutcomeAvailability { return status === "provided" ? { status, value } : { status }; }
function OutcomeForm({ data }: { data: StandardDetail }) {
  const d = data.decision;
  const action = data.actions.find((item) => item.action_track === "business");
  const key = useRef(crypto.randomUUID());
  const { register, handleSubmit, watch, formState: { errors } } = useForm<OutcomeFields>({ defaultValues: { salesStatus: "not_provided", salesValue: "", profitStatus: "not_provided", profitValue: "", inventoryStatus: "not_provided", inventoryValue: "", note: "" } });
  const values = watch();
  const mutation = useMutation({ mutationFn: (fields: OutcomeFields) => recordOutcome(action!.id, { periodStart: fields.periodStart, periodEnd: fields.periodEnd, sales: availability(fields.salesStatus, fields.salesValue), profit: availability(fields.profitStatus, fields.profitValue), inventory: availability(fields.inventoryStatus, fields.inventoryValue), note: fields.note, version: action!.version }, key.current), onSuccess: () => window.location.assign(`/decisions/${d.decision_id}`) });
  if (!action || action.status !== "executed") return <section className="panel error-panel"><h2>经营结果当前不可登记</h2><p>必须先完成经营动作；当前状态：{action ? statusLabel[action.status] ?? action.status : "无经营动作"}。</p><a className="button button--secondary" href={`/decisions/${d.decision_id}`}>查看最新状态</a></section>;
  const metric = (keyName: "sales" | "profit" | "inventory", label: string) => { const status = values[`${keyName}Status`]; return <div className="outcome-metric"><label>{label} *</label><select {...register(`${keyName}Status`)}><option value="not_provided">未提供</option><option value="provided">已提供</option></select>{status === "provided" && <input aria-label={`${label}结果值`} {...register(`${keyName}Value`, { required: "已提供时必须填写有效结果" })} placeholder="输入未格式化数值或事实" />}{errors[`${keyName}Value`] && <p className="field-error">{errors[`${keyName}Value`]?.message}</p>}</div>; };
  return <><header className="page-heading"><div><h1>登记经营结果</h1><p>结果关联原建议和观察周期；未提供不等于 0。</p></div><span className="pill pill--accent">outcome v{action.version}</span></header><Summary data={data} /><form className="panel operation-form" onSubmit={handleSubmit((fields) => mutation.mutate(fields))}><div className="date-grid"><div className="form-field"><label htmlFor="period-start">观察开始日 *</label><input id="period-start" type="date" {...register("periodStart", { required: "请选择观察开始日" })} /></div><div className="form-field"><label htmlFor="period-end">观察结束日 *</label><input id="period-end" type="date" {...register("periodEnd", { required: "请选择观察结束日", validate: (value, form) => value >= form.periodStart || "结束日不能早于开始日" })} />{errors.periodEnd && <p className="field-error">{errors.periodEnd.message}</p>}</div></div><section className="outcome-grid">{metric("sales", "销售额")}{metric("profit", "利润")}{metric("inventory", "库存")}</section><div className="form-field"><label htmlFor="outcome-note">来源、口径或缺失说明 *</label><textarea id="outcome-note" {...register("note", { required: "请说明数据来源、口径或未提供原因" })} /></div><MutationError error={mutation.error} /><div className="form-actions"><a className="button button--secondary" href={`/decisions/${d.decision_id}`}>取消</a><button className="button button--primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? "记录中…" : "记录经营结果"}</button></div></form></>;
}

export function ReviewPage({ user }: { user: CurrentUser }) { return <LoadingPage user={user} pageId="PAGE-F06-01">{(data) => data.currentRole === "procurement" ? null : <ReviewForm data={data} />}</LoadingPage>; }
export function BusinessExecutePage({ user }: { user: CurrentUser }) { return <LoadingPage user={user} pageId="PAGE-F06-02">{(data) => data.currentRole === "procurement" ? null : <ExecuteForm data={data} procurement={false} />}</LoadingPage>; }
export function ProcurementExecutePage({ user }: { user: CurrentUser }) { return <LoadingPage user={user} pageId="PAGE-F06-03">{(data) => data.currentRole === "procurement" ? <ExecuteForm data={data} procurement /> : null}</LoadingPage>; }
export function OutcomePage({ user }: { user: CurrentUser }) { return <LoadingPage user={user} pageId="PAGE-F06-04">{(data) => data.currentRole === "procurement" ? null : <OutcomeForm data={data} />}</LoadingPage>; }
