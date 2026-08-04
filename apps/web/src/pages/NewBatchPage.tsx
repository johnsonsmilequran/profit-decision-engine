import { FileXls, ShieldCheck, UploadSimple } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { CurrentUser } from "../api.ts";
import { ApiRequestError, importBatch } from "../api.ts";
import { AppShell } from "../components/AppShell.tsx";

interface BatchForm { businessUnit: string; periodStart: string; periodEnd: string; businessDate: string; file: FileList; }
export function isFullMonth(start: string, end: string): boolean {
  if (!/^\d{4}-\d{2}-01$/.test(start)) return false;
  const [year, month] = start.split("-").map(Number);
  const last = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return end === `${year}-${String(month).padStart(2, "0")}-${last}`;
}

export function NewBatchPage({ user }: { user: CurrentUser }) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string>();
  const { register, handleSubmit, watch, formState: { errors, isDirty } } = useForm<BatchForm>({ defaultValues: { businessUnit: "玩具事业部", periodStart: "", periodEnd: "", businessDate: "" } });
  const values = watch();
  const mutation = useMutation({ mutationFn: importBatch, onSuccess: (result) => navigate({ to: "/batches/$batchId", params: { batchId: result.batchId }, search: { duplicate: result.duplicate ? "1" : undefined } }), onError: (error) => setServerError(error instanceof ApiRequestError ? error.message : "网络异常，请重新选择文件后重试") });
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (isDirty && !mutation.isSuccess) event.preventDefault(); }; addEventListener("beforeunload", guard); return () => removeEventListener("beforeunload", guard); }, [isDirty, mutation.isSuccess]);
  function submit(data: BatchForm) {
    setServerError(undefined); const formData = new FormData();
    formData.set("businessUnit", data.businessUnit); formData.set("periodStart", data.periodStart); formData.set("periodEnd", data.periodEnd); formData.set("businessDate", data.businessDate); formData.set("file", data.file[0]!);
    mutation.mutate(formData);
  }
  return <AppShell user={user}><div className="workspace batch-page" data-page-id="PAGE-F01-02"><div className="breadcrumb">数据批次 / <span>新建数据导入</span></div><header className="page-heading"><div><h1>新建数据导入</h1><p>声明数据口径并上传数据支持部门提供的 XLSX 经营表。</p></div><span className="pill pill--accent">仅运营可用</span></header><div className="form-layout"><form className="panel form-panel" onSubmit={handleSubmit(submit)}><div className="form-field"><label htmlFor="business-unit">事业部 *</label><select id="business-unit" {...register("businessUnit", { required: true })}><option>玩具事业部</option></select></div><div className="form-field"><label>数据期间 *</label><div className="date-grid"><input aria-label="期间开始日" type="date" {...register("periodStart", { required: "请选择期间开始日", validate: (_, form) => isFullMonth(form.periodStart, form.periodEnd) || "请选择一个完整自然月" })} /><input aria-label="期间结束日" type="date" {...register("periodEnd", { required: "请选择期间结束日", validate: (_, form) => isFullMonth(form.periodStart, form.periodEnd) || "请选择一个完整自然月" })} /></div>{(errors.periodStart || errors.periodEnd) ? <p className="field-error">{errors.periodStart?.message ?? errors.periodEnd?.message}</p> : <small>必须是一个完整自然月；本批次作为上一个完整自然月使用。</small>}</div><div className="form-field"><label htmlFor="business-date">批次业务截止日 *</label><input id="business-date" type="date" {...register("businessDate", { required: "请选择业务截止日", validate: (value, form) => value >= form.periodEnd || "业务截止日不能早于数据期间结束日" })} />{errors.businessDate ? <p className="field-error">{errors.businessDate.message}</p> : <small>建立后冻结，用于新品是否上架满 2 个自然月的判断。</small>}</div><div className="form-field"><label htmlFor="xlsx-file">XLSX 经营表 *</label><label className="file-picker" htmlFor="xlsx-file"><FileXls /><strong>选择单个 XLSX 文件</strong><small>{values.file?.[0] ? `${values.file[0].name} · ${(values.file[0].size / 1024).toFixed(1)} KB` : "尚未选择文件"}</small></label><input className="visually-hidden-input" id="xlsx-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" {...register("file", { required: "请选择可读取的 XLSX 文件", validate: (files) => files?.length === 1 && files[0]!.name.toLowerCase().endsWith(".xlsx") || "请选择可读取的 XLSX 文件" })} />{errors.file && <p className="field-error">{errors.file.message}</p>}</div>{serverError && <div className="notice notice--error" role="alert">{serverError}</div>}<div className="form-actions"><a className="button button--secondary" href="/batches">取消</a><button className="button button--primary" disabled={mutation.isPending} type="submit"><UploadSimple />{mutation.isPending ? "正在建立批次…" : "导入并校验"}</button></div></form><aside className="form-aside"><section className="panel"><h2>提交前核对</h2><dl><div><dt>事业部</dt><dd>{values.businessUnit}</dd></div><div><dt>自然月期间</dt><dd><code>{values.periodStart || "待填写"}—{values.periodEnd || "待填写"}</code></dd></div><div><dt>业务截止日</dt><dd><code>{values.businessDate || "待填写"}</code></dd></div><div><dt>文件格式</dt><dd>{values.file?.[0] ? "XLSX" : "待选择"}</dd></div></dl></section><section className="panel principles"><h2><ShieldCheck />处理原则</h2><ul><li>源表合计行将被忽略，仅使用有效 SPU 明细重新汇总。</li><li>10—20 个 SPU 是首轮验收规模，不是导入硬限制。</li><li>相同指纹会返回原批次，不产生第二份清单。</li><li>库存或品退缺失按字段降级，不由 AI 猜值。</li></ul></section></aside></div></div></AppShell>;
}
