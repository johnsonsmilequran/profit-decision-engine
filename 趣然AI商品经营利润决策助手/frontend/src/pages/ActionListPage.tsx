import { ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, Input, Select, Skeleton, Space, Table } from "antd";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

import { api } from "../api";
import { useAuth } from "../components/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import type { Decision } from "../types";

interface ActionList {
  items: Decision[];
  page: number;
  page_size: number;
}

export function ActionListPage() {
  const [, navigate] = useLocation();
  const { status } = useAuth();
  const procurement = status?.role === "procurement";
  const [action, setAction] = useState<string>();
  const [review, setReview] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const queryString = new URLSearchParams({ page: String(page), page_size: "20" });
  if (action) queryString.set("action", action);
  if (review) queryString.set("review_state", review);
  const query = useQuery({
    queryKey: ["actions", action, review, page],
    queryFn: () => api<ActionList>(`/actions?${queryString}`),
  });
  const rows = useMemo(
    () =>
      query.data?.items.filter((item) =>
        `${item.spu_id}${item.spu_name}${item.store}${item.operator_ref}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase()),
      ) ?? [],
    [keyword, query.data?.items],
  );

  return (
    <>
      <PageHeader
        kicker="PAGE-F05-02 · 唯一行动清单"
        title="行动清单"
        description="只收录需要经营行动或补货/禁止补货的 SPU，固定规则优先级决定排序，筛选不改变原始清单。"
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => void query.refetch()}>
            刷新状态
          </Button>
        }
      />
      <Card className="section-card">
        <div className="filter-bar">
          <Input.Search
            allowClear
            placeholder="搜索 SPU、店铺或责任运营"
            style={{ width: 300 }}
            onSearch={setKeyword}
            onChange={(event) => {
              if (!event.target.value) setKeyword("");
            }}
          />
          <Select
            allowClear
            placeholder="全部动作"
            style={{ width: 170 }}
            value={action}
            onChange={(value) => {
              setAction(value);
              setPage(1);
            }}
            options={[
              ...(procurement
                ? []
                : [
                    { value: "clearance", label: "清仓" },
                    { value: "stop_loss", label: "止损" },
                    { value: "observe", label: "观察" },
                    { value: "invest", label: "加投" },
                  ]),
              { value: "replenish", label: "补货" },
              { value: "forbid", label: "禁止补货" },
            ]}
          />
          {procurement ? null : (
            <Select
              allowClear
              placeholder="全部审核状态"
              style={{ width: 180 }}
              value={review}
              onChange={(value) => {
                setReview(value);
                setPage(1);
              }}
              options={[
                { value: "pending", label: "待审核" },
                { value: "approved", label: "已通过" },
                { value: "rejected", label: "已驳回" },
              ]}
            />
          )}
          <span className="muted">
            {procurement
              ? "仅显示与当前账号关联的补货/禁止补货任务"
              : "排序：清仓 › 止损 › 观察 › 加投 › 补货"}
          </span>
        </div>
        {query.isLoading ? (
          <Skeleton active />
        ) : rows.length ? (
          <Table
            rowKey="decision_id"
            dataSource={rows}
            pagination={{ current: page, pageSize: 20, showSizeChanger: false, onChange: setPage }}
            columns={[
              {
                title: "SPU",
                dataIndex: "spu_name",
                render: (value: string, item) => (
                  <Space direction="vertical" size={0}>
                    <Button
                      type="link"
                      style={{ padding: 0, fontWeight: 600 }}
                      onClick={() => navigate(`/actions/${item.decision_id}`)}
                    >
                      {value}
                    </Button>
                    <span className="mono muted">{item.spu_id}</span>
                  </Space>
                ),
              },
              { title: "店铺", dataIndex: "store" },
              ...(procurement ? [] : [{ title: "责任运营", dataIndex: "operator_ref" }]),
              ...(procurement
                ? []
                : [
                    {
                      title: "经营动作",
                      dataIndex: "main_action",
                      render: (value: string) => <StatusTag value={value} />,
                    },
                  ]),
              {
                title: "库存动作",
                dataIndex: "replenishment_action",
                render: (value: string) => <StatusTag value={value} />,
              },
              ...(procurement
                ? []
                : [
                    {
                      title: "审核",
                      dataIndex: "review_state",
                      render: (value: string) => (
                        <StatusTag value={value === "pending" ? "awaiting_review" : value} />
                      ),
                    },
                  ]),
              {
                title: "执行轨道",
                render: (_, item) => (
                  <Space direction="vertical" size={3}>
                    {item.actions.map((lane) => (
                      <span key={lane.action_id}>
                        {lane.owner_role === "operator" ? "经营" : "采购"}：
                        <StatusTag value={lane.execution_state} />
                      </span>
                    ))}
                  </Space>
                ),
              },
              {
                title: "详情",
                width: 90,
                render: (_, item) => (
                  <Button onClick={() => navigate(`/actions/${item.decision_id}`)}>打开</Button>
                ),
              },
            ]}
          />
        ) : (
          <Empty description="当前筛选下没有需要处理的行动" />
        )}
      </Card>
    </>
  );
}
