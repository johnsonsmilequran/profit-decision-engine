import { CheckOutlined, CloseOutlined, HistoryOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Skeleton,
  Space,
  Tabs,
  Timeline,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

import { ApiError, api } from "../api";
import { useAuth } from "../components/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import type { ActionItem, Decision, TraceEvent } from "../types";

interface TraceList {
  items: TraceEvent[];
}
interface ReviewValues {
  note?: string;
}
interface ActionValues {
  note: string;
  result?: string;
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: unknown, maximumFractionDigits = 1): string {
  const parsed = numberValue(value);
  return parsed === null
    ? display(value)
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(parsed);
}

function formatCurrency(value: unknown): string {
  const parsed = numberValue(value);
  return parsed === null
    ? display(value)
    : new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        maximumFractionDigits: 2,
      }).format(parsed);
}

function formatPercent(value: unknown): string {
  const parsed = numberValue(value);
  return parsed === null
    ? display(value)
    : new Intl.NumberFormat("zh-CN", {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(parsed);
}

const evidenceLabels: Record<string, string> = {
  spu_id: "SPU",
  spu_name: "商品",
  net_sales: "净销售额",
  profit_rate: "经营准利润率",
  return_rate_7d: "最近 7 天品退率",
  inventory_days: "库存可售天数",
  quality_flags: "数据质量提示",
};

function evidenceValue(key: string, value: unknown): string {
  if (key === "net_sales") return formatCurrency(value);
  if (key === "profit_rate" || key === "return_rate_7d") return formatPercent(value);
  if (key === "inventory_days") return `${formatNumber(value)} 天`;
  if (Array.isArray(value)) return value.length ? value.map(display).join("、") : "无";
  return display(value);
}

function humanDisplay(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    const first = entries[0];
    if (entries.length === 1 && first?.[0] === "summary") return display(first[1]);
    return entries
      .map(([key, item]) => `${evidenceLabels[key] ?? key}：${evidenceValue(key, item)}`)
      .join("；");
  }
  return display(value);
}

function ruleDescription(rule: string, decision: Decision): string {
  const sales = formatCurrency(decision.net_sales);
  const profit = formatPercent(decision.profit_rate);
  const returns = formatPercent(decision.return_rate_7d);
  const days = `${formatNumber(decision.inventory_days)} 天`;
  const descriptions: Record<string, string> = {
    "non-new-sales-below-20000": `非新品且净销售额 ${sales}＜¥20,000.00，分类为淘汰品并优先清仓。`,
    "loss-action-forbids-replenishment": "清仓/止损动作优先级已生效，库存动作原子设为禁止补货。",
    "large_hit-fixed-priority": `大爆品按清仓＞止损＞观察＞加投顺序判定；当前利润率 ${profit}、品退率 ${returns}。`,
    "small_hit-fixed-priority": `小爆品按清仓＞止损＞观察＞加投顺序判定；当前利润率 ${profit}、品退率 ${returns}。`,
    "inventory-days-boundary-30": `当前库存可售 ${days}，以 30 天为补货边界。`,
    "new-product-no-replenishment-v1": "新品阶段不生成补货结论，避免用短周期销量推导采购动作。",
    "classification-input-invalid": "分类必要输入不可用，本批次不生成经营结论。",
    "profit-rate-unavailable": "经营准利润率不可用，停止依赖利润率的动作判断。",
  };
  return descriptions[rule] ?? `规则 ${rule} 已按 ${decision.rule_version ?? "固化版本"} 执行。`;
}

function traceEventLabel(eventType: string): string {
  return (
    {
      review_approve: "主管通过",
      review_reject: "主管驳回",
      action_executed: "动作执行",
      action_result_recorded: "结果回填",
      result_recorded: "结果回填",
    }[eventType] ?? eventType
  );
}

export function DecisionDetailPage() {
  const { decisionId = "" } = useParams<{ decisionId: string }>();
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const { status } = useAuth();
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | null>(null);
  const [action, setAction] = useState<ActionItem | null>(null);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["decision", decisionId],
    queryFn: () => api<Decision>(`/decisions/${decisionId}`),
    retry: false,
  });
  const trace = useQuery({
    queryKey: ["decision-trace", decisionId],
    queryFn: () => api<TraceList>(`/trace?decision_id=${decisionId}`),
    enabled: query.isSuccess,
  });
  const refresh = async () => {
    await Promise.all([
      query.refetch(),
      trace.refetch(),
      client.invalidateQueries({ queryKey: ["actions"] }),
    ]);
  };
  const reviewMutation = useMutation({
    mutationFn: ({ mode, values }: { mode: "approve" | "reject"; values: ReviewValues }) =>
      api(`/decisions/${decisionId}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision: mode,
          version: query.data?.review_version,
          note: values.note ?? "",
        }),
      }),
    onSuccess: async () => {
      setReviewMode(null);
      setError("");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "审核提交失败"),
  });
  const actionMutation = useMutation({
    mutationFn: (values: ActionValues) =>
      api(`/actions/${action?.action_id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          version: action?.execution_version,
          note: values.note,
          result: values.result ? { summary: values.result } : null,
        }),
      }),
    onSuccess: async () => {
      setAction(null);
      setError("");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "动作提交失败"),
  });

  useEffect(() => {
    if (query.error instanceof ApiError && [403, 404].includes(query.error.status))
      navigate("/forbidden", { replace: true });
  }, [navigate, query.error]);
  if (query.isLoading || !query.data) return <Skeleton active paragraph={{ rows: 16 }} />;
  const decision = query.data;
  const procurement = status?.role === "procurement";
  const evidence = decision.four_elements ?? {};
  const metricItems = procurement
    ? [
        ["warehouse", "仓内库存", formatNumber(decision.warehouse_qty)],
        ["transit", "在途库存", formatNumber(decision.in_transit_qty)],
        ["sales14", "最近 14 天销量", formatNumber(decision.sales_units_14d)],
        ["days", "库存可售天数", `${formatNumber(decision.inventory_days)} 天`],
      ]
    : [
        ["sales", "上一完整自然月净销售额", formatCurrency(decision.net_sales)],
        ["profit", "经营准利润率", formatPercent(decision.profit_rate)],
        ["promotion", "推广费用", formatCurrency(decision.promotion_expense)],
        ["return", "最近 7 天品退率", formatPercent(decision.return_rate_7d)],
        ["rule", "规则版本", decision.rule_version ?? "—"],
        ["rules", "触发规则", decision.triggered_rules?.join("、") || "—"],
      ];

  return (
    <>
      <div className="breadcrumb-row">
        <Button type="link" onClick={() => navigate("/actions")}>
          行动清单
        </Button>
        <span>/</span>
        <span>{decision.spu_name || decision.spu_id}</span>
      </div>
      <PageHeader
        kicker="PAGE-F05-03 · 固化建议快照"
        title={decision.spu_name || decision.spu_id}
        description={`SPU ${decision.spu_id} · 批次 ${decision.batch_id}`}
        actions={
          <Space>
            {decision.review_state ? (
              <StatusTag
                value={
                  decision.review_state === "pending" ? "awaiting_review" : decision.review_state
                }
              />
            ) : null}
            <Button
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/trace?decision_id=${decision.decision_id}`)}
            >
              全部追溯
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>
              刷新状态
            </Button>
          </Space>
        }
      />
      {error ? (
        <Alert
          type="error"
          showIcon
          message={error}
          description="如状态已被其他人更新，请刷新后重新核对。"
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => void refresh()}>
              刷新
            </Button>
          }
        />
      ) : null}
      <Card className="detail-hero">
        <Space size={10} wrap>
          {!procurement && decision.category ? <StatusTag value={decision.category} /> : null}
          {!procurement && decision.main_action ? <StatusTag value={decision.main_action} /> : null}
          <StatusTag value={decision.replenishment_action} />
        </Space>
        <Typography.Title level={3} style={{ margin: "14px 0 4px" }}>
          {procurement
            ? `采购结论：${decision.replenishment_label}`
            : `经营建议：${decision.main_action_label ?? "—"} · ${decision.replenishment_label}`}
        </Typography.Title>
        <div className="muted">
          结论由固定规则生成，AI
          仅做解释，不能改写动作。执行状态是本产品内人工记录，不代表外部系统回执。
        </div>
      </Card>
      {!procurement ? (
        <Card className="section-card detail-context" style={{ marginTop: 16 }}>
          <div>
            <span>店铺 / 平台</span>
            <strong>
              {decision.store || "—"} · {decision.platform || "—"}
            </strong>
          </div>
          <div>
            <span>数据期间</span>
            <strong>
              {decision.period_start || "—"} 至 {decision.period_end || "—"}
            </strong>
          </div>
          <div>
            <span>业务截止日</span>
            <strong>{decision.business_date || "—"}</strong>
          </div>
          <div>
            <span>规则快照</span>
            <strong>{decision.rule_version || "—"}</strong>
          </div>
        </Card>
      ) : null}
      <div className="detail-grid" style={{ marginTop: 16 }}>
        <div className="detail-stack">
          {!procurement ? (
            <Card className="section-card" title="结构化建议四要素">
              <div className="four-elements">
                {[
                  ["具体对象", evidence.object],
                  ["发现问题", evidence.problem],
                  ["关键依据", evidence.evidence],
                  ["推荐动作", evidence.action],
                ].map(([label, value]) => (
                  <div className="element-block" key={label as string}>
                    <div className="element-label">{label as string}</div>
                    <div className="element-content" style={{ whiteSpace: "pre-wrap" }}>
                      {humanDisplay(value)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          <Card className="section-card" title="关键指标与数据质量">
            <div className={`evidence-metrics ${procurement ? "procurement" : ""}`}>
              {metricItems.map(([key, label, value]) => (
                <div className={`evidence-metric ${key === "rules" ? "wide" : ""}`} key={key}>
                  <div className="element-label">{label}</div>
                  <div className="evidence-value">{value}</div>
                </div>
              ))}
            </div>
          </Card>
          {!procurement ? (
            <Card className="section-card" title="固定规则路径">
              <div className="rule-path">
                {(decision.triggered_rules ?? []).map((rule, index) => (
                  <div className="rule-step" key={rule}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{ruleDescription(rule, decision)}</strong>
                      <div className="mono muted">{rule}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          {!procurement ? (
            <Card className="section-card" title="AI 解释状态">
              <Alert
                showIcon
                type={decision.ai?.status === "generated" ? "success" : "info"}
                message={
                  decision.ai?.status === "generated"
                    ? "AI 增强解释已生成"
                    : "AI 解释暂不可用，固定规则建议可继续处理"
                }
                description={
                  decision.ai?.content
                    ? display(decision.ai.content)
                    : "结构化四要素、审核和执行均不受影响。"
                }
              />
            </Card>
          ) : null}
          <Card className="section-card" title="执行轨道">
            {decision.actions.map((lane) => (
              <div
                key={lane.action_id}
                className={`action-lane ${lane.owner_role === "procurement" ? "procurement" : ""}`}
                style={{ marginBottom: 18 }}
              >
                <Space>
                  <strong>{lane.owner_role === "operator" ? "经营动作" : "采购动作"}</strong>
                  <StatusTag value={lane.action_value} />
                  <StatusTag value={lane.execution_state} />
                </Space>
                <div className="muted" style={{ marginTop: 7 }}>
                  责任角色：{lane.owner_role === "operator" ? "运营" : "采购计划"} · 版本{" "}
                  {lane.execution_version}
                </div>
                {lane.execution_note ? (
                  <div style={{ marginTop: 6 }}>备注：{lane.execution_note}</div>
                ) : null}
                {lane.result ? (
                  <div style={{ marginTop: 6 }}>结果：{humanDisplay(lane.result)}</div>
                ) : null}
                {lane.owner_role === status?.role &&
                ["pending", "executed"].includes(lane.execution_state) ? (
                  <Button
                    type="primary"
                    ghost
                    style={{ marginTop: 10 }}
                    onClick={() => setAction(lane)}
                  >
                    {lane.execution_state === "pending" ? "确认执行" : "记录结果"}
                  </Button>
                ) : null}
              </div>
            ))}
          </Card>
        </div>
        <div className="detail-stack">
          <Card className="section-card" title="审核结果">
            <Space>
              {decision.review_state ? (
                <StatusTag
                  value={
                    decision.review_state === "pending" ? "awaiting_review" : decision.review_state
                  }
                />
              ) : null}
              {decision.reviewed_by ? (
                <span className="muted">
                  {decision.reviewed_by} ·{" "}
                  {decision.reviewed_at
                    ? new Date(decision.reviewed_at).toLocaleString("zh-CN")
                    : ""}
                </span>
              ) : null}
            </Space>
            {decision.review_note ? (
              <div style={{ marginTop: 10 }}>审核备注：{decision.review_note}</div>
            ) : null}
            {status?.role === "supervisor" && decision.review_state === "pending" ? (
              <Space style={{ marginTop: 14 }}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => setReviewMode("approve")}
                >
                  通过整条建议
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={() => setReviewMode("reject")}>
                  驳回
                </Button>
              </Space>
            ) : null}
          </Card>
          <Card className="section-card" title="审核 / 经营 / 采购时间线">
            <Tabs
              items={[
                ["review", "审核", (event: TraceEvent) => event.event_type.startsWith("review_")],
                ["operation", "经营", (event: TraceEvent) => event.action === decision.main_action],
                [
                  "procurement",
                  "采购",
                  (event: TraceEvent) => event.action === decision.replenishment_action,
                ],
              ].map(([key, label, predicate]) => {
                const events = (trace.data?.items ?? []).filter(
                  predicate as (event: TraceEvent) => boolean,
                );
                return {
                  key: key as string,
                  label: `${label as string} ${events.length}`,
                  children: events.length ? (
                    <Timeline
                      items={events.map((event) => ({
                        children: (
                          <div className="trace-row">
                            <div className="trace-title">{traceEventLabel(event.event_type)}</div>
                            <div className="trace-meta">
                              {event.actor_ref} ·{" "}
                              {new Date(event.occurred_at).toLocaleString("zh-CN")}
                            </div>
                            <div>
                              <StatusTag value={event.from_state} /> →{" "}
                              <StatusTag value={event.to_state} />
                            </div>
                            {event.note ? <div className="muted">{event.note}</div> : null}
                          </div>
                        ),
                      }))}
                    />
                  ) : (
                    <div className="muted">本轨暂无事件</div>
                  ),
                };
              })}
            />
          </Card>
        </div>
      </div>
      <Modal
        title={reviewMode === "approve" ? "通过整条建议" : "驳回整条建议"}
        open={Boolean(reviewMode)}
        footer={null}
        onCancel={() => setReviewMode(null)}
        destroyOnHidden
      >
        <Form<ReviewValues>
          layout="vertical"
          onFinish={(values) => reviewMode && reviewMutation.mutate({ mode: reviewMode, values })}
        >
          <div className="review-confirm-summary">
            <div>
              <span>审核对象</span>
              <strong>
                {decision.spu_name} · {decision.spu_id}
              </strong>
            </div>
            <div>
              <span>整条建议</span>
              <Space wrap>
                <StatusTag value={decision.main_action ?? "undetermined"} />
                <StatusTag value={decision.replenishment_action} />
              </Space>
            </div>
          </div>
          <Alert
            type={reviewMode === "reject" ? "warning" : "info"}
            showIcon
            style={{ marginBottom: 16 }}
            message={
              reviewMode === "reject"
                ? "驳回后两条动作轨道均不能执行"
                : "通过后经营与采购轨道分别进入可执行状态"
            }
            description="审核只改变本产品内的建议状态，不会自动执行经营动作，也不会直接向采购或外部系统下单。"
          />
          <Form.Item
            name="note"
            label={reviewMode === "reject" ? "驳回原因" : "审核备注"}
            rules={reviewMode === "reject" ? [{ required: true, whitespace: true }] : []}
          >
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
          <Button
            type="primary"
            danger={reviewMode === "reject"}
            htmlType="submit"
            loading={reviewMutation.isPending}
            block
          >
            确认提交
          </Button>
        </Form>
      </Modal>
      <Modal
        title={action?.execution_state === "pending" ? "确认执行动作" : "记录动作结果"}
        open={Boolean(action)}
        footer={null}
        onCancel={() => setAction(null)}
        destroyOnHidden
      >
        <Form<ActionValues> layout="vertical" onFinish={(values) => actionMutation.mutate(values)}>
          <Form.Item name="note" label="执行备注" rules={[{ required: true, whitespace: true }]}>
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
          {action?.execution_state === "executed" ? (
            <Form.Item
              name="result"
              label="结果记录"
              rules={[{ required: true, whitespace: true }]}
            >
              <Input.TextArea rows={3} placeholder="记录观察周期、经营结果或采购结果" />
            </Form.Item>
          ) : null}
          <Button type="primary" htmlType="submit" loading={actionMutation.isPending} block>
            提交本轨动作
          </Button>
        </Form>
      </Modal>
    </>
  );
}
