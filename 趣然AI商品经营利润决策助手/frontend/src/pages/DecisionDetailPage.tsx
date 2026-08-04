import { CheckOutlined, CloseOutlined, HistoryOutlined } from "@ant-design/icons";
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
          <Card className="section-card" title="最近追溯事件">
            <Timeline
              items={(trace.data?.items ?? []).slice(0, 6).map((event) => ({
                children: (
                  <div className="trace-row">
                    <div className="trace-title">{event.event_type}</div>
                    <div className="trace-meta">
                      {event.actor_ref} · {new Date(event.occurred_at).toLocaleString("zh-CN")}
                    </div>
                    <div>
                      {event.from_state} → {event.to_state}
                    </div>
                    {event.note ? <div className="muted">{event.note}</div> : null}
                  </div>
                ),
              }))}
            />
            {!trace.data?.items.length ? <div className="muted">暂无审核或执行事件</div> : null}
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
