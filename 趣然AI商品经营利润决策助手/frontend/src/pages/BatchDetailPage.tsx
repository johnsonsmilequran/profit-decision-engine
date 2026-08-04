import { ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Descriptions, Skeleton, Space, Table, Tabs } from "antd";
import { useLocation, useParams } from "wouter";

import { api } from "../api";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import type { Batch, Decision, ImportIssue, Snapshot } from "../types";

interface BatchDetail {
  batch: Batch;
  issues: ImportIssue[];
  snapshots: Snapshot[];
  decisions: Decision[];
}

export function BatchDetailPage() {
  const { batchId = "" } = useParams<{ batchId: string }>();
  const [, navigate] = useLocation();
  const query = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => api<BatchDetail>(`/batches/${batchId}`),
    enabled: Boolean(batchId),
    refetchInterval: (state) =>
      ["received", "validating", "rules_processing"].includes(state.state.data?.batch.status ?? "")
        ? 1500
        : false,
  });
  if (query.isLoading || !query.data) return <Skeleton active paragraph={{ rows: 14 }} />;
  const { batch, issues, snapshots, decisions } = query.data;
  const issueColumns = [
    { title: "源行", dataIndex: "source_row", width: 74 },
    { title: "字段", dataIndex: "field", width: 150 },
    { title: "原值", dataIndex: "original_value", width: 180, ellipsis: true },
    { title: "原因", dataIndex: "message" },
    {
      title: "是否继续",
      dataIndex: "continues_processing",
      width: 110,
      render: (value: boolean) => (value ? "是" : <span className="danger-text">否</span>),
    },
  ];

  return (
    <>
      <PageHeader
        kicker="PAGE-F01-03 · 批次校验与规则结果"
        title={batch.business_unit}
        description={`批次 ${batch.batch_id} · ${batch.period_start} 至 ${batch.period_end}`}
        actions={
          <Space>
            <StatusTag value={batch.status} />
            <Button icon={<ReloadOutlined />} onClick={() => void query.refetch()}>
              刷新
            </Button>
          </Space>
        }
      />
      {batch.status === "failed" ? (
        <Alert
          type="error"
          showIcon
          message="批次处理失败"
          description={batch.error_message}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {["received", "validating", "rules_processing"].includes(batch.status) ? (
        <Alert
          type="info"
          showIcon
          message="系统正在校验数据并运行固定规则"
          description="本页会自动刷新；清单只会发布一次。"
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <div className="metric-grid">
        <MetricCard label="有效 SPU" value={batch.valid_row_count} hint="已进入指标与规则处理" />
        <MetricCard label="拒绝行" value={batch.rejected_row_count} hint="身份缺失或批次内重复" />
        <MetricCard
          label="降级字段"
          value={batch.degraded_field_count}
          hint="只停止依赖该字段的判断"
        />
        <MetricCard label="普通警告" value={batch.warning_count} hint="保留质量标记并继续处理" />
      </div>
      <Card className="section-card" title="批次固化信息">
        <Descriptions
          column={4}
          size="small"
          items={[
            { key: "date", label: "业务截止日", children: batch.business_date },
            { key: "source", label: "源文件", children: batch.source_name },
            { key: "creator", label: "导入人", children: batch.created_by },
            {
              key: "created",
              label: "建立时间",
              children: new Date(batch.created_at).toLocaleString("zh-CN"),
            },
          ]}
        />
      </Card>
      <Card className="section-card">
        <Tabs
          items={[
            {
              key: "decisions",
              label: `规则结果 ${decisions.length}`,
              children: (
                <Table
                  rowKey="decision_id"
                  dataSource={decisions}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: "SPU",
                      dataIndex: "spu_name",
                      render: (value: string, item) => (
                        <Button
                          type="link"
                          style={{ padding: 0 }}
                          onClick={() => navigate(`/actions/${item.decision_id}`)}
                        >
                          {value || item.spu_id}
                        </Button>
                      ),
                    },
                    {
                      title: "类型",
                      dataIndex: "category",
                      render: (value: string) => <StatusTag value={value} />,
                    },
                    {
                      title: "经营动作",
                      dataIndex: "main_action",
                      render: (value: string) => <StatusTag value={value} />,
                    },
                    {
                      title: "库存动作",
                      dataIndex: "replenishment_action",
                      render: (value: string) => <StatusTag value={value} />,
                    },
                    {
                      title: "审核",
                      dataIndex: "review_state",
                      render: (value: string) => (
                        <StatusTag value={value === "pending" ? "awaiting_review" : value} />
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: "rejected",
              label: `拒绝行 ${issues.filter((item) => item.severity === "rejected").length}`,
              children: (
                <Table
                  rowKey={(item) => `${item.source_row}-${item.field}-${item.code}`}
                  dataSource={issues.filter((item) => item.severity === "rejected")}
                  columns={issueColumns}
                  pagination={false}
                />
              ),
            },
            {
              key: "degraded",
              label: `字段降级 ${issues.filter((item) => item.severity === "degraded").length}`,
              children: (
                <Table
                  rowKey={(item) => `${item.source_row}-${item.field}-${item.code}`}
                  dataSource={issues.filter((item) => item.severity === "degraded")}
                  columns={issueColumns}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: "warnings",
              label: `普通警告 ${issues.filter((item) => item.severity === "warning").length}`,
              children: (
                <Table
                  rowKey={(item) => `${item.source_row}-${item.field}-${item.code}`}
                  dataSource={issues.filter((item) => item.severity === "warning")}
                  columns={issueColumns}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: "snapshots",
              label: `SPU 快照 ${snapshots.length}`,
              children: (
                <Table
                  rowKey="spu_id"
                  dataSource={snapshots}
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: "SPU",
                      dataIndex: "spu_name",
                      fixed: "left",
                      width: 200,
                      render: (value: string, item) => (
                        <span>
                          {value}
                          <br />
                          <span className="mono muted">{item.spu_id}</span>
                        </span>
                      ),
                    },
                    { title: "店铺", dataIndex: "store" },
                    { title: "平台", dataIndex: "platform" },
                    { title: "责任运营", dataIndex: "operator_ref" },
                    { title: "净销售额", dataIndex: "net_sales" },
                    { title: "经营准利润率", dataIndex: "profit_rate" },
                    { title: "7 日品退率", dataIndex: "return_rate_7d" },
                    { title: "库存可售天数", dataIndex: "inventory_days" },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
