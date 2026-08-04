import { PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, Select, Skeleton, Space, Table } from "antd";
import { useState } from "react";
import { useLocation } from "wouter";

import { api } from "../api";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import type { Batch } from "../types";

interface BatchList {
  items: Batch[];
  page: number;
  page_size: number;
  total: number;
}

export function BatchListPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<string>();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["batches", status, page],
    queryFn: () =>
      api<BatchList>(`/batches?page=${page}&page_size=20${status ? `&status=${status}` : ""}`),
  });

  return (
    <>
      <PageHeader
        kicker="PAGE-F01-01 · 数据批次"
        title="数据批次"
        description="每个批次固化自然月期间、业务截止日、源文件指纹和处理结果，新批次不覆盖历史。"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/batches/new")}>
            新建数据导入
          </Button>
        }
      />
      <Card className="section-card">
        <div className="filter-bar">
          <Select
            allowClear
            placeholder="全部处理状态"
            style={{ width: 180 }}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: "received", label: "已接收" },
              { value: "validating", label: "校验中" },
              { value: "rules_processing", label: "规则处理中" },
              { value: "ready", label: "已完成" },
              { value: "failed", label: "处理失败" },
            ]}
          />
          <span className="muted">按创建时间倒序，仅展示已持久化的真实批次</span>
        </div>
        {query.isLoading ? (
          <Skeleton active />
        ) : query.data?.items.length ? (
          <Table
            rowKey="batch_id"
            dataSource={query.data.items}
            pagination={{
              current: page,
              pageSize: 20,
              total: query.data.total,
              showSizeChanger: false,
              onChange: setPage,
            }}
            columns={[
              {
                title: "批次",
                dataIndex: "batch_id",
                render: (value: string, item) => (
                  <Space direction="vertical" size={0}>
                    <Button
                      type="link"
                      style={{ padding: 0 }}
                      onClick={() => navigate(`/batches/${value}`)}
                    >
                      {item.business_unit}
                    </Button>
                    <span className="mono muted">{value}</span>
                  </Space>
                ),
              },
              {
                title: "数据期间",
                render: (_, item) => (
                  <span>
                    {item.period_start}
                    <br />
                    <span className="muted">至 {item.period_end}</span>
                  </span>
                ),
              },
              { title: "业务截止日", dataIndex: "business_date" },
              { title: "源文件", dataIndex: "source_name", ellipsis: true },
              {
                title: "状态",
                dataIndex: "status",
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: "校验摘要",
                render: (_, item) => (
                  <span>
                    {item.valid_row_count} 有效 ·{" "}
                    <span className="danger-text">{item.rejected_row_count} 拒绝</span>
                    <br />
                    <span className="muted">
                      {item.degraded_field_count} 降级 · {item.warning_count} 警告
                    </span>
                  </span>
                ),
              },
              { title: "导入人", dataIndex: "created_by" },
            ]}
          />
        ) : (
          <Empty description="没有符合当前条件的数据批次" />
        )}
      </Card>
    </>
  );
}
