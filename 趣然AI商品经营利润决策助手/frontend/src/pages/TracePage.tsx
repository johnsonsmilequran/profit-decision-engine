import { useQuery } from "@tanstack/react-query";
import { Button, Card, DatePicker, Empty, Input, Select, Skeleton, Space, Table } from "antd";
import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "wouter";

import { api } from "../api";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import type { TraceEvent } from "../types";

interface TraceList {
  items: TraceEvent[];
  role: string;
}

const eventLabels: Record<string, string> = {
  review: "主管审核",
  reviewed: "主管审核",
  review_approve: "主管通过",
  review_reject: "主管驳回",
  execution: "动作执行",
  executed: "动作执行",
  action_executed: "动作执行",
  result_recorded: "结果回填",
  action_result_recorded: "结果回填",
  procurement_result: "采购结果回填",
  decision_created: "建议生成",
};

export function TracePage() {
  const [, navigate] = useLocation();
  const [params] = useSearchParams();
  const decisionId = params.get("decision_id") ?? "";
  const initialBatch = params.get("batch_id") ?? "";
  const [batchId, setBatchId] = useState(initialBatch);
  const [spuId, setSpuId] = useState("");
  const [action, setAction] = useState<string>();
  const [state, setState] = useState<string>();
  const [actor, setActor] = useState("");
  const [dateRange, setDateRange] = useState<[string, string]>();
  const [eventType, setEventType] = useState<string>();
  const [pageSize, setPageSize] = useState(20);
  const query = useQuery({
    queryKey: ["trace", decisionId],
    queryFn: () =>
      api<TraceList>(`/trace${decisionId ? `?decision_id=${encodeURIComponent(decisionId)}` : ""}`),
  });
  const source = query.data?.items ?? [];
  const rows = useMemo(
    () =>
      source.filter((item) => {
        const day = item.occurred_at.slice(0, 10);
        return (
          (!batchId || item.batch_id.toLowerCase().includes(batchId.toLowerCase())) &&
          (!spuId || item.spu_id.toLowerCase().includes(spuId.toLowerCase())) &&
          (!action || item.action === action) &&
          (!state || item.to_state === state || item.from_state === state) &&
          (!actor || item.actor_ref.toLowerCase().includes(actor.toLowerCase())) &&
          (!dateRange || (day >= dateRange[0] && day <= dateRange[1])) &&
          (!eventType || item.event_type === eventType)
        );
      }),
    [action, actor, batchId, dateRange, eventType, source, spuId, state],
  );
  const options = (values: Array<string | undefined>) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].map((value) => ({
      value,
      label: value,
    }));

  return (
    <>
      <PageHeader
        kicker="PAGE-F08-01 · 规则与数据溯源"
        title="追溯记录"
        description={
          query.data?.role === "procurement"
            ? "追踪本人采购动作与结果，定位原批次和 SPU；仅显示完成采购任务所需信息。"
            : "从审核、分轨执行与结果反向定位原批次、SPU、规则版本和操作人；历史快照不可覆盖。"
        }
      />
      <Card className="section-card">
        <div className="filter-bar trace-filters">
          <Input
            allowClear
            placeholder="批次编号"
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
          />
          <Input
            allowClear
            placeholder="SPU 编号"
            value={spuId}
            onChange={(event) => setSpuId(event.target.value)}
          />
          <Select
            allowClear
            placeholder="经营 / 库存动作"
            value={action}
            onChange={setAction}
            options={options(source.map((item) => item.action))}
          />
          <Select
            allowClear
            placeholder="状态"
            value={state}
            onChange={setState}
            options={options(source.flatMap((item) => [item.from_state, item.to_state]))}
          />
          <Input
            allowClear
            placeholder="操作人"
            value={actor}
            onChange={(event) => setActor(event.target.value)}
          />
          <DatePicker.RangePicker
            style={{ width: "100%" }}
            onChange={(dates) =>
              setDateRange(
                dates?.[0] && dates[1]
                  ? [dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD")]
                  : undefined,
              )
            }
          />
          <Select
            allowClear
            placeholder="事件类型"
            value={eventType}
            onChange={setEventType}
            options={options(source.map((item) => item.event_type)).map((item) => ({
              ...item,
              label: eventLabels[item.value] ?? item.value,
            }))}
          />
        </div>
        {decisionId ? (
          <div className="trace-lock muted">
            已锁定建议 <span className="mono">{decisionId}</span>
          </div>
        ) : null}
        {query.isLoading ? (
          <Skeleton active />
        ) : rows.length ? (
          <Table
            rowKey="event_id"
            dataSource={rows}
            scroll={{ x: 1420 }}
            pagination={{
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ["20", "50", "100"],
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            columns={[
              {
                title: "发生时间",
                dataIndex: "occurred_at",
                width: 180,
                fixed: "left",
                render: (value: string) => new Date(value).toLocaleString("zh-CN"),
              },
              {
                title: "事件",
                dataIndex: "event_type",
                width: 140,
                render: (value: string) => eventLabels[value] ?? value,
              },
              {
                title: "动作",
                dataIndex: "action",
                width: 130,
                render: (value: string) => (value ? <StatusTag value={value} /> : "—"),
              },
              { title: "SPU", dataIndex: "spu_id", width: 130 },
              {
                title: "批次",
                dataIndex: "batch_id",
                width: 220,
                render: (value: string) => (
                  <Button
                    type="link"
                    className="mono"
                    style={{ padding: 0 }}
                    onClick={() => navigate(`/batches/${value}`)}
                  >
                    {value}
                  </Button>
                ),
              },
              {
                title: "状态变化",
                width: 210,
                render: (_, item) => (
                  <Space>
                    <StatusTag value={item.from_state} />→<StatusTag value={item.to_state} />
                  </Space>
                ),
              },
              { title: "操作人", dataIndex: "actor_ref", width: 150 },
              ...(query.data?.role === "procurement"
                ? []
                : [{ title: "规则版本", dataIndex: "rule_version", width: 140 }]),
              {
                title: "备注",
                dataIndex: "note",
                width: 240,
                ellipsis: true,
                render: (value: string | null) => value || "—",
              },
              {
                title: "建议",
                width: 100,
                fixed: "right" as const,
                render: (_: unknown, item: TraceEvent) => (
                  <Button type="link" onClick={() => navigate(`/actions/${item.decision_id}`)}>
                    打开
                  </Button>
                ),
              },
            ]}
          />
        ) : (
          <Empty description="当前权限与筛选条件下暂无追溯事件" />
        )}
      </Card>
    </>
  );
}
