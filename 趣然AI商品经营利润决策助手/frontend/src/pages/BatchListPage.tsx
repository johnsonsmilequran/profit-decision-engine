import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, DatePicker, Empty, Input, Select, Skeleton, Space, Table } from "antd";
import { useMemo, useState } from "react";
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
  const [keyword, setKeyword] = useState("");
  const [createdRange, setCreatedRange] = useState<[string, string]>();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["batches", status, page],
    queryFn: () =>
      api<BatchList>(`/batches?page=${page}&page_size=20${status ? `&status=${status}` : ""}`),
  });
  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter((item) => {
        const matchesKeyword =
          `${item.batch_id}${item.business_unit}${item.source_name}${item.created_by}`
            .toLowerCase()
            .includes(keyword.trim().toLowerCase());
        const createdDate = item.created_at.slice(0, 10);
        const matchesDate =
          !createdRange || (createdDate >= createdRange[0] && createdDate <= createdRange[1]);
        return matchesKeyword && matchesDate;
      }),
    [createdRange, keyword, query.data?.items],
  );

  return (
    <>
      <PageHeader
        kicker="PAGE-F01-01 · 数据批次"
        title="数据批次"
        description="每个批次固化自然月期间、业务截止日、源文件指纹和处理结果，新批次不覆盖历史。"
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void query.refetch()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/batches/new")}>
              新建数据导入
            </Button>
          </Space>
        }
      />
      <Card className="section-card">
        <div className="filter-bar">
          <Input.Search
            allowClear
            placeholder="搜索批次、事业部、源文件或提交人"
            style={{ width: 300 }}
            onSearch={setKeyword}
            onChange={(event) => !event.target.value && setKeyword("")}
          />
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
          <DatePicker.RangePicker
            placeholder={["创建开始日", "创建结束日"]}
            onChange={(value) =>
              setCreatedRange(
                value?.[0] && value[1]
                  ? [value[0].format("YYYY-MM-DD"), value[1].format("YYYY-MM-DD")]
                  : undefined,
              )
            }
          />
          <Button
            onClick={() => {
              setStatus(undefined);
              setKeyword("");
              setCreatedRange(undefined);
              setPage(1);
            }}
          >
            重置筛选
          </Button>
          <span className="muted">按创建时间倒序，仅展示已持久化的真实批次</span>
        </div>
        {query.isLoading ? (
          <Skeleton active />
        ) : rows.length ? (
          <Table
            rowKey="batch_id"
            dataSource={rows}
            scroll={{ x: 1560 }}
            pagination={{
              current: page,
              pageSize: 20,
              total: query.data?.total ?? rows.length,
              showSizeChanger: false,
              onChange: setPage,
            }}
            columns={[
              {
                title: "批次编号",
                dataIndex: "batch_id",
                width: 310,
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
              { title: "事业部", dataIndex: "business_unit", width: 120 },
              {
                title: "数据期间",
                width: 140,
                render: (_, item) => (
                  <span>
                    {item.period_start}
                    <br />
                    <span className="muted">至 {item.period_end}</span>
                  </span>
                ),
              },
              { title: "业务截止日", dataIndex: "business_date", width: 120 },
              { title: "源文件", dataIndex: "source_name", ellipsis: true, width: 190 },
              {
                title: "状态",
                dataIndex: "status",
                width: 90,
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: "清单状态",
                width: 110,
                render: (_, item) => (item.status === "ready" ? "已发布" : "未发布"),
              },
              { title: "有效 SPU", dataIndex: "valid_row_count", width: 100 },
              { title: "拒绝行", dataIndex: "rejected_row_count", width: 90 },
              { title: "降级字段", dataIndex: "degraded_field_count", width: 100 },
              { title: "提交人", dataIndex: "created_by", width: 120 },
              {
                title: "创建时间",
                dataIndex: "created_at",
                width: 170,
                render: (value: string) => new Date(value).toLocaleString("zh-CN"),
              },
            ]}
          />
        ) : (
          <Empty description="没有符合当前条件的数据批次" />
        )}
      </Card>
    </>
  );
}
