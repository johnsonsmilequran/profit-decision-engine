import { LockOutlined } from "@ant-design/icons";
import { Button, Card, Space, Typography } from "antd";
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
      <Card className="forbidden-card">
        <div className="forbidden-icon">
          <LockOutlined />
        </div>
        <Typography.Title level={2}>
          {noRole ? "未配置有效业务角色" : "无法查看该内容"}
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
        <div className="login-footer">
          {status?.support_guidance ?? "如需开通或调整角色，请联系公司 IT。"}
        </div>
      </Card>
    </div>
  );
}
