import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, Input, Select, Skeleton, Space, Table } from "antd";
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

export function TracePage() {
  const [, navigate] = useLocation();
  const [params] = useSearchParams();
  const decisionId = params.get("decision_id") ?? "";
  const [operator, setOperator] = useState("");
  const [eventType, setEventType] = useState<string>();
  const query = useQuery({
    queryKey: ["trace", decisionId],
    queryFn: () =>
      api<TraceList>(`/trace${decisionId ? `?decision_id=${encodeURIComponent(decisionId)}` : ""}`),
  });
  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter(
        (item) =>
          (!operator || item.actor_ref.toLowerCase().includes(operator.toLowerCase())) &&
          (!eventType || item.event_type === eventType),
      ),
    [eventType, operator, query.data?.items],
  );
  const eventOptions = [...new Set((query.data?.items ?? []).map((item) => item.event_type))].map(
    (value) => ({ value, label: value }),
  );

  return (
    <>
      <PageHeader
        kicker="PAGE-F08-01 · 规则与数据溯源"
        title="追溯记录"
        description={
          query.data?.role === "procurement"
            ? "追踪本人采购动作与结果，定位原批次和 SPU；仅显示完成采购任务所需信息。"
            : "从每次成功审核、分轨执行与结果反向定位原批次、SPU、规则版本和操作人；新批次不覆盖历史快照。"
        }
      />
      <Card className="section-card">
        <div className="filter-bar">
          <Input
            allowClear
            placeholder="筛选操作人"
            style={{ width: 230 }}
            value={operator}
            onChange={(event) => setOperator(event.target.value)}
          />
          <Select
            allowClear
            placeholder="全部事件类型"
            style={{ width: 230 }}
            value={eventType}
            onChange={setEventType}
            options={eventOptions}
          />
          {decisionId ? (
            <span className="muted">
              已锁定建议 <span className="mono">{decisionId}</span>
            </span>
          ) : (
            <span className="muted">显示当前角色有权查看的最近 100 条事件</span>
          )}
        </div>
        {query.isLoading ? (
          <Skeleton active />
        ) : rows.length ? (
          <Table
            rowKey="event_id"
            dataSource={rows}
            pagination={{ pageSize: 20 }}
            columns={[
              {
                title: "发生时间",
                dataIndex: "occurred_at",
                width: 180,
                render: (value: string) => new Date(value).toLocaleString("zh-CN"),
              },
              { title: "事件", dataIndex: "event_type", width: 150 },
              {
                title: "SPU / 批次",
                render: (_, item) => (
                  <Space direction="vertical" size={0}>
                    <span>{item.spu_id}</span>
                    <span className="mono muted">{item.batch_id}</span>
                  </Space>
                ),
              },
              {
                title: "状态变化",
                render: (_, item) => (
                  <Space>
                    <StatusTag value={item.from_state} />→<StatusTag value={item.to_state} />
                  </Space>
                ),
              },
              { title: "操作人", dataIndex: "actor_ref" },
              ...(query.data?.role === "procurement"
                ? []
                : [{ title: "规则版本", dataIndex: "rule_version" }]),
              {
                title: "备注",
                dataIndex: "note",
                ellipsis: true,
                render: (value: string | null) => value || "—",
              },
              {
                title: "建议",
                width: 90,
                render: (_, item) => (
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
