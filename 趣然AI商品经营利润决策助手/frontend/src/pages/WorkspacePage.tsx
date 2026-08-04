import {
  ArrowRightOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, Skeleton, Space, Table, Typography } from "antd";
import { useLocation } from "wouter";

import { api } from "../api";
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
  const query = useQuery({
    queryKey: ["workspace"],
    queryFn: () => api<WorkspaceData>("/workspace"),
  });
  const data = query.data;

  if (query.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />;

  return (
    <>
      <PageHeader
        kicker="PAGE-F05-01 · 本周经营协作"
        title={`${data?.role_label ?? "当前角色"}工作台`}
        description="用同一批次事实追踪待审核建议、高优先级行动与跨角色执行阻塞。"
        actions={
          data?.role === "operator" ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/batches/new")}>
              导入本周数据
            </Button>
          ) : null
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
          <Card
            className="section-card"
            title="需要优先关注"
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
          <div className="workspace-support">
            <Card className="section-card" title="最近动态">
              <Space direction="vertical" size={12}>
                <div>
                  <ClockCircleOutlined /> 批次已完成校验与规则处理
                  <div className="muted mono">{data.batch.batch_id}</div>
                </div>
                <div>
                  当前角色有 {data.items.length} 条优先事项可继续查看，状态更新会追加追溯记录。
                </div>
              </Space>
            </Card>
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
