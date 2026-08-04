import { LockOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Collapse, Space, Typography } from "antd";
import { useLocation, useSearchParams } from "wouter";

import { useAuth } from "../components/AuthContext";

export function ForbiddenPage() {
  const [, navigate] = useLocation();
  const { status, refresh } = useAuth();
  const [params] = useSearchParams();
  const reason = params.get("reason");
  const noRole = reason === "role";

  async function retry() {
    const result = await refresh();
    const data = (result as { data?: { authenticated?: boolean } }).data;
    navigate(data?.authenticated ? "/workspace" : "/login", { replace: true });
  }

  return (
    <div className="forbidden-screen">
      <div className="forbidden-brand">
        <span className="brand-mark">趣然</span>
        <span>AI 商品经营利润决策助手</span>
      </div>
      <Card className="forbidden-card">
        <div className="forbidden-icon">
          <LockOutlined />
        </div>
        <Typography.Title level={2}>当前无法访问此内容</Typography.Title>
        <Typography.Title level={5} className="forbidden-reason">
          {noRole ? "未配置唯一有效的业务角色" : "当前角色没有该对象的查看权限"}
        </Typography.Title>
        <Typography.Paragraph className="muted">
          {noRole
            ? "钉钉身份已确认，但当前没有唯一有效的业务角色。请联系 IT 处理后重新登录。"
            : "当前身份无权访问该对象。为保护经营数据，系统不会返回对象名称、状态或摘要。"}
        </Typography.Paragraph>
        <Space style={{ marginTop: 14 }}>
          {status?.authenticated ? (
            <Button type="primary" onClick={() => navigate("/workspace")}>
              返回工作台
            </Button>
          ) : null}
          <Button onClick={() => void retry()}>重新检查权限</Button>
          <Button type="link" onClick={() => navigate("/login")}>
            重新登录
          </Button>
        </Space>
        <Collapse
          ghost
          className="support-collapse"
          items={[
            {
              key: "support",
              label: "联系 IT 处理",
              children: (
                <Alert
                  type="info"
                  showIcon
                  message={status?.support_guidance ?? "请联系公司 IT 开通或调整角色。"}
                  description="处理完成后返回本页点击“重新检查权限”，无需重复提交业务数据。"
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
