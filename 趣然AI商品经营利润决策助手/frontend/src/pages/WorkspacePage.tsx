import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, Skeleton, Space, Table, Typography } from "antd";
import { useLocation } from "wouter";

import { api } from "../api";
import { useAuth } from "../components/AuthContext";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import type { Batch, Decision } from "../types";

interface WorkspaceData {
  role: string;
  role_label: string;
  batch: Batch | null;
  metrics: { label: string; value: number }[];
  items: Decision[];
}

export function WorkspacePage() {
  const [, navigate] = useLocation();
  const { status } = useAuth();
  const query = useQuery({
    queryKey: ["workspace"],
    queryFn: () => api<WorkspaceData>("/workspace"),
  });
  const data = query.data;

  if (query.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />;

  return (
    <>
      <PageHeader
        kicker="OPERATING OVERVIEW"
        title={`早上好，${status?.actor_name ?? "同事"}`}
        description={`你当前以${data?.role_label ?? "当前角色"}身份查看本周任务。先处理高优先级待办，再关注跨角色未闭环事项。`}
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void query.refetch()}>
              刷新状态
            </Button>
            {data?.role === "operator" ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/batches/new")}
              >
                导入本周数据
              </Button>
            ) : null}
          </Space>
        }
      />

      {!data?.batch ? (
        <div className="empty-panel">
          <Empty
            image={<DatabaseOutlined style={{ fontSize: 46, color: "#8aa0b7" }} />}
            description={
              <div>
                <Typography.Title level={4}>尚无可用数据批次</Typography.Title>
                <div className="muted">运营导入完整自然月 XLSX 后，系统会自动校验并生成清单。</div>
              </div>
            }
          >
            {data?.role === "operator" ? (
              <Button type="primary" onClick={() => navigate("/batches/new")}>
                新建数据导入
              </Button>
            ) : null}
          </Empty>
        </div>
      ) : (
        <>
          <Card className="section-card batch-banner">
            <div>
              <span>当前发布批次</span>
              <strong className="mono">{data.batch.batch_id}</strong>
            </div>
            <div>
              <span>完整自然月期间</span>
              <strong>
                {data.batch.period_start} 至 {data.batch.period_end}
              </strong>
            </div>
            <div>
              <span>业务截止日</span>
              <strong>{data.batch.business_date}</strong>
            </div>
            <div>
              <span>规则快照</span>
              <strong>RULE-V1.0</strong>
            </div>
            <Button onClick={() => navigate(`/batches/${data.batch?.batch_id}`)}>查看批次</Button>
          </Card>
          <div className="metric-grid">
            {data.metrics.slice(0, 3).map((metric) => (
              <MetricCard key={metric.label} {...metric} hint={`批次 ${data.batch?.batch_id}`} />
            ))}
          </div>
          <div className="workspace-primary">
            <Card
              className="section-card workspace-table"
              title={
                <div>
                  <strong>待审核与高优先级建议</strong>
                  <span>按清仓、止损、观察、加投、补货固定层级排序</span>
                </div>
              }
              extra={
                <Button type="link" onClick={() => navigate("/actions")}>
                  查看全部 <ArrowRightOutlined />
                </Button>
              }
            >
              <Table
                rowKey="decision_id"
                dataSource={data.items}
                pagination={false}
                locale={{ emptyText: "本批次暂无需要行动的建议" }}
                columns={[
                  {
                    title: "SPU",
                    dataIndex: "spu_name",
                    render: (value: string, item) => (
                      <Space direction="vertical" size={0}>
                        <Button
                          type="link"
                          style={{ padding: 0 }}
                          onClick={() => navigate(`/actions/${item.decision_id}`)}
                        >
                          {value}
                        </Button>
                        <span className="mono muted">{item.spu_id}</span>
                      </Space>
                    ),
                  },
                  {
                    title: data.role === "procurement" ? "店铺" : "店铺 / 责任运营",
                    render: (_, item) => (
                      <span>
                        {item.store || "—"}
                        {data.role === "procurement" ? null : (
                          <>
                            <br />
                            <span className="muted">{item.operator_ref || "—"}</span>
                          </>
                        )}
                      </span>
                    ),
                  },
                  ...(data.role === "procurement"
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
                  ...(data.role === "procurement"
                    ? []
                    : [
                        {
                          title: "审核状态",
                          dataIndex: "review_state",
                          render: (value: string) => (
                            <StatusTag value={value === "pending" ? "awaiting_review" : value} />
                          ),
                        },
                      ]),
                  {
                    title: "动作进度",
                    render: (_, item) =>
                      item.actions.length
                        ? item.actions.map((action) => (
                            <StatusTag key={action.action_id} value={action.execution_state} />
                          ))
                        : "—",
                  },
                ]}
              />
            </Card>
            <Card
              className="section-card workspace-activity"
              title="最近状态"
              extra={
                <Button
                  type="link"
                  onClick={() => navigate(`/trace?batch_id=${data.batch?.batch_id}`)}
                >
                  查看追溯
                </Button>
              }
            >
              <div className="activity-list">
                <div>
                  <CheckCircleOutlined />
                  <span>
                    <strong>批次校验与规则处理已完成</strong>
                    <small className="mono">{data.batch.batch_id}</small>
                  </span>
                </div>
                <div>
                  <ClockCircleOutlined />
                  <span>
                    <strong>{data.items.length} 条优先事项等待继续处理</strong>
                    <small>状态变化会写入追溯记录</small>
                  </span>
                </div>
                <div>
                  <DatabaseOutlined />
                  <span>
                    <strong>当前页面使用不可变批次快照</strong>
                    <small>RULE-V1.0 · {data.batch.business_date}</small>
                  </span>
                </div>
                <div>
                  <CheckCircleOutlined />
                  <span>
                    <strong>经营与采购动作按角色分轨</strong>
                    <small>结果分别记录、共同闭环</small>
                  </span>
                </div>
              </div>
            </Card>
          </div>
          <div className="workspace-support">
            <Card className="section-card" title="快捷入口">
              <Space wrap>
                <Button type="primary" onClick={() => navigate("/actions")}>
                  打开行动清单
                </Button>
                <Button onClick={() => navigate(`/trace?batch_id=${data.batch?.batch_id}`)}>
                  查看批次追溯
                </Button>
              </Space>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
