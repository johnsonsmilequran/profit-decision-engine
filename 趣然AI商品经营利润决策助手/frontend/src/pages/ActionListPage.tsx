import { ReloadOutlined, RightOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Empty, Input, Pagination, Select, Skeleton, Space } from "antd";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

import { api } from "../api";
import { useAuth } from "../components/AuthContext";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import type { Batch, Decision } from "../types";

interface ActionList {
  items: Decision[];
  page: number;
  page_size: number;
}

interface BatchDetailSummary {
  batch: Batch;
}

export function ActionListPage() {
  const [, navigate] = useLocation();
  const { status } = useAuth();
  const procurement = status?.role === "procurement";
  const [mainAction, setMainAction] = useState<string>();
  const [replenishment, setReplenishment] = useState<string>();
  const [review, setReview] = useState<string>();
  const [execution, setExecution] = useState<string>();
  const [batchFilter, setBatchFilter] = useState<string>();
  const [store, setStore] = useState<string>();
  const [owner, setOwner] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const queryString = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (mainAction) queryString.set("action", mainAction);
  if (review) queryString.set("review_state", review);
  const query = useQuery({
    queryKey: ["actions", mainAction, review, page, pageSize],
    queryFn: () => api<ActionList>(`/actions?${queryString}`),
  });
  const source = query.data?.items ?? [];
  const activeBatchId = batchFilter ?? source[0]?.batch_id;
  const batchQuery = useQuery({
    queryKey: ["action-list-batch", activeBatchId],
    queryFn: () => api<BatchDetailSummary>(`/batches/${activeBatchId}`),
    enabled: Boolean(activeBatchId) && !procurement,
  });
  const rows = useMemo(
    () =>
      source.filter(
        (item) =>
          (!keyword ||
            `${item.spu_id}${item.spu_name}${item.store}${item.operator_ref}`
              .toLowerCase()
              .includes(keyword.trim().toLowerCase())) &&
          (!batchFilter || item.batch_id === batchFilter) &&
          (!replenishment || item.replenishment_action === replenishment) &&
          (!store || item.store === store) &&
          (!owner || item.operator_ref === owner) &&
          (!execution || item.actions.some((lane) => lane.execution_state === execution)),
      ),
    [batchFilter, execution, keyword, owner, replenishment, source, store],
  );
  const uniqueOptions = (values: Array<string | undefined>) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].map((value) => ({
      value,
      label: value,
    }));
  const urgentCount = source.filter((item) =>
    ["clearance", "stop_loss"].includes(item.main_action ?? ""),
  ).length;
  const pendingCount = source.filter((item) => item.review_state === "pending").length;
  const blockedCount = source.filter((item) =>
    item.actions.some((lane) => ["blocked", "failed"].includes(lane.execution_state)),
  ).length;

  return (
    <>
      <PageHeader
        kicker="PAGE-F05-02 · 唯一行动清单"
        title="行动清单"
        description="固定规则生成唯一清单；卡片同时呈现经营、审核与分轨执行状态，筛选不会改写原始决策。"
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => void query.refetch()}>
            刷新状态
          </Button>
        }
      />
      {!procurement && activeBatchId ? (
        <Card className="batch-banner" size="small">
          <div>
            <span className="eyebrow">当前批次</span>
            <strong className="mono">{activeBatchId}</strong>
          </div>
          <div>
            <span className="muted">数据期间</span>
            <strong>
              {batchQuery.data
                ? `${batchQuery.data.batch.period_start} 至 ${batchQuery.data.batch.period_end}`
                : "读取中"}
            </strong>
          </div>
          <Button onClick={() => navigate(`/batches/${activeBatchId}`)}>查看批次</Button>
        </Card>
      ) : null}
      <div className="metric-grid metric-grid-four">
        <MetricCard label="行动总数" value={source.length} hint="当前页可见决策" />
        <MetricCard label="清仓 / 止损" value={urgentCount} hint="优先处理高风险动作" />
        <MetricCard
          label="待主管审核"
          value={procurement ? "—" : pendingCount}
          hint="审核通过后才可执行"
        />
        <MetricCard label="执行阻塞" value={blockedCount} hint="需检查经营或采购轨道" />
      </div>
      <Alert
        type="info"
        showIcon
        className="section-card"
        message={procurement ? "采购任务处理指引" : "清单处理指引"}
        description={
          procurement
            ? "仅处理与当前账号关联的补货或禁止补货任务；完成后记录真实结果。"
            : "先处理清仓与止损，再完成审核；审核结果不会自动代替经营或采购执行。"
        }
      />
      <Card className="section-card">
        <div className="filter-bar action-filters">
          <Input
            allowClear
            placeholder="SPU / 店铺 / 责任运营"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select
            allowClear
            placeholder="全部批次"
            value={batchFilter}
            onChange={setBatchFilter}
            options={uniqueOptions(source.map((item) => item.batch_id))}
          />
          {!procurement ? (
            <Select
              allowClear
              placeholder="经营动作"
              value={mainAction}
              onChange={(value) => {
                setMainAction(value);
                setPage(1);
              }}
              options={[
                { value: "clearance", label: "清仓" },
                { value: "stop_loss", label: "止损" },
                { value: "observe", label: "观察" },
                { value: "invest", label: "加投" },
              ]}
            />
          ) : null}
          <Select
            allowClear
            placeholder="库存动作"
            value={replenishment}
            onChange={setReplenishment}
            options={[
              { value: "replenish", label: "补货" },
              { value: "forbid", label: "禁止补货" },
            ]}
          />
          <Select
            allowClear
            placeholder="店铺"
            value={store}
            onChange={setStore}
            options={uniqueOptions(source.map((item) => item.store))}
          />
          {!procurement ? (
            <Select
              allowClear
              placeholder="责任运营"
              value={owner}
              onChange={setOwner}
              options={uniqueOptions(source.map((item) => item.operator_ref))}
            />
          ) : null}
          {!procurement ? (
            <Select
              allowClear
              placeholder="审核状态"
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
          ) : null}
          <Select
            allowClear
            placeholder="执行状态"
            value={execution}
            onChange={setExecution}
            options={uniqueOptions(
              source.flatMap((item) => item.actions.map((lane) => lane.execution_state)),
            )}
          />
        </div>
        {query.isLoading ? (
          <Skeleton active />
        ) : rows.length ? (
          <div className="action-card-list">
            {rows.map((item) => (
              <Card
                key={item.decision_id}
                className="action-card"
                hoverable
                onClick={() => navigate(`/actions/${item.decision_id}`)}
              >
                <div className="action-card-main">
                  <div>
                    <strong>{item.spu_name}</strong>
                    <div className="mono muted">
                      {item.spu_id} · {item.store}
                    </div>
                  </div>
                  <Space wrap>
                    {!procurement && item.main_action ? (
                      <StatusTag value={item.main_action} />
                    ) : null}
                    <StatusTag value={item.replenishment_action} />
                    {!procurement && item.review_state ? (
                      <StatusTag
                        value={
                          item.review_state === "pending" ? "awaiting_review" : item.review_state
                        }
                      />
                    ) : null}
                  </Space>
                </div>
                <div className="action-card-meta">
                  {!procurement ? <span>责任运营：{item.operator_ref || "未关联"}</span> : null}
                  {item.actions.map((lane) => (
                    <span key={lane.action_id}>
                      {lane.owner_role === "operator" ? "经营" : "采购"}轨道：
                      <StatusTag value={lane.execution_state} />
                    </span>
                  ))}
                  <Button type="link" icon={<RightOutlined />}>
                    查看建议
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty description="当前筛选下没有需要处理的行动" />
        )}
        <div className="action-pagination">
          <span className="muted">每页</span>
          <Select
            value={pageSize}
            onChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            options={[20, 50, 100].map((value) => ({ value, label: `${value} 条` }))}
          />
          <Pagination
            current={page}
            pageSize={pageSize}
            total={Math.max(rows.length, page * pageSize)}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      </Card>
    </>
  );
}
