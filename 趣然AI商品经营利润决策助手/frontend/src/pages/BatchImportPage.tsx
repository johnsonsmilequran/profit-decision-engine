import { CheckCircleOutlined, FileExcelOutlined, InboxOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  message,
  Space,
  Steps,
  Upload,
} from "antd";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useLocation } from "wouter";

import { ApiError, api } from "../api";
import { PageHeader } from "../components/PageHeader";
import type { Batch } from "../types";

interface FormValues {
  business_unit: string;
  period: [Dayjs, Dayjs];
  business_date: Dayjs;
}

export function BatchImportPage() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File>();
  const [confirmValues, setConfirmValues] = useState<FormValues>();
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!file) throw new Error("请选择 XLSX 经营表。");
      const body = new FormData();
      body.set("business_unit", values.business_unit);
      body.set("period_start", values.period[0].format("YYYY-MM-DD"));
      body.set("period_end", values.period[1].format("YYYY-MM-DD"));
      body.set("business_date", values.business_date.format("YYYY-MM-DD"));
      body.set("file", file);
      return api<{ idempotent: boolean; batch: Batch }>("/batches", { method: "POST", body });
    },
    onSuccess: (result) => {
      if (result.idempotent) void message.info("相同数据已存在，已返回原批次。");
      navigate(`/batches/${result.batch.batch_id}`, { replace: true });
    },
    onError: (caught) =>
      setError(caught instanceof ApiError || caught instanceof Error ? caught.message : "导入失败"),
  });

  return (
    <>
      <PageHeader
        kicker="PAGE-F01-02 · 数据导入"
        title="新建数据导入"
        description="提交后自动校验、运行固定规则并生成唯一行动清单，无需再次点击“生成”。"
      />
      <Alert
        showIcon
        type="info"
        message="只接收上一个完整自然月的 SPU 经营表"
        description="必须包含唯一 SPU 身份、商品名称、店铺、平台和责任运营。原 XLSX 在入库快照后从临时目录清理。"
        style={{ marginBottom: 16 }}
      />
      <div className="import-layout">
        <Card className="section-card" title="批次信息与 XLSX 文件">
          <Form<FormValues>
            layout="vertical"
            initialValues={{ business_unit: "玩具事业部" }}
            onFinish={(values) => {
              setError("");
              setConfirmValues(values);
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 16 }}>
              <Form.Item name="business_unit" label="事业部" rules={[{ required: true }]}>
                <Input maxLength={80} />
              </Form.Item>
              <Form.Item name="period" label="数据期间（完整自然月）" rules={[{ required: true }]}>
                <DatePicker.RangePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="business_date" label="业务截止日" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </div>
            <Form.Item label="XLSX 经营表" required>
              <Upload.Dragger
                accept=".xlsx"
                maxCount={1}
                beforeUpload={(selected) => {
                  setFile(selected);
                  return false;
                }}
                onRemove={() => {
                  setFile(undefined);
                }}
                fileList={file ? [file as never] : []}
              >
                <p>
                  <InboxOutlined style={{ fontSize: 38, color: "#075ead" }} />
                </p>
                <p>
                  <strong>点击或拖拽 XLSX 文件到此处</strong>
                </p>
                <p className="muted">单文件最大 10 MB，不支持 XLS、CSV 或压缩包</p>
              </Upload.Dragger>
            </Form.Item>
            {file ? (
              <Alert
                type="success"
                showIcon
                icon={<FileExcelOutlined />}
                message={`已选择 ${file.name}`}
                style={{ marginBottom: 16 }}
              />
            ) : null}
            {error ? (
              <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
            ) : null}
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={mutation.isPending}
                disabled={!file}
              >
                导入并处理
              </Button>
              <Button onClick={() => navigate("/batches")}>取消</Button>
            </Space>
          </Form>
        </Card>
        <div className="detail-stack">
          <Card className="section-card" title="准备状态">
            <Space direction="vertical" size={10}>
              <span>
                <CheckCircleOutlined className="success-text" /> 完整自然月期间与截止日
              </span>
              <span>
                <CheckCircleOutlined className="success-text" /> 唯一 SPU、店铺、平台与责任运营
              </span>
              <span>
                <CheckCircleOutlined className="success-text" /> 单个 XLSX，最大 10 MB
              </span>
            </Space>
          </Card>
          <Card className="section-card" title="自动处理步骤">
            <Steps
              direction="vertical"
              size="small"
              current={mutation.isPending ? 1 : 0}
              items={[
                { title: "上传并固化批次" },
                { title: "校验身份与字段" },
                { title: "计算指标与固定规则" },
                { title: "发布唯一行动清单" },
              ]}
            />
          </Card>
        </div>
      </div>
      <Modal
        title="确认批次信息"
        open={Boolean(confirmValues)}
        okText="确认导入并处理"
        cancelText="返回修改"
        confirmLoading={mutation.isPending}
        onCancel={() => setConfirmValues(undefined)}
        onOk={() => confirmValues && mutation.mutate(confirmValues)}
      >
        {confirmValues ? (
          <div className="confirm-summary">
            <div>事业部：{confirmValues.business_unit}</div>
            <div>
              数据期间：{confirmValues.period[0].format("YYYY-MM-DD")} 至{" "}
              {confirmValues.period[1].format("YYYY-MM-DD")}
            </div>
            <div>业务截止日：{confirmValues.business_date.format("YYYY-MM-DD")}</div>
            <div>文件：{file?.name}</div>
            <Alert type="info" showIcon message="确认一次后将自动完成四步处理，不需要再次生成。" />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
