import {
  AuditOutlined,
  CompassOutlined,
  DatabaseOutlined,
  HomeOutlined,
  LogoutOutlined,
  ProfileOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Layout, Menu, Skeleton, Space, Tag } from "antd";
import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";

import { api } from "../api";
import { useAuth } from "./AuthContext";

const { Sider } = Layout;

export function ProtectedShell({ children }: { children: ReactNode }) {
  const { status, loading, refresh } = useAuth();
  const [location, navigate] = useLocation();
  const workspace = useQuery({
    queryKey: ["shell-workspace"],
    queryFn: () => api<{ batch: { batch_id: string } | null }>("/workspace"),
    enabled: Boolean(status?.authenticated),
  });

  useEffect(() => {
    if (!loading && !status?.authenticated) navigate("/login?reason=session", { replace: true });
  }, [loading, navigate, status?.authenticated]);

  if (loading) {
    return (
      <div className="forbidden-screen">
        <Skeleton active style={{ width: 540 }} />
      </div>
    );
  }
  if (!status?.authenticated) {
    return (
      <div className="forbidden-screen">
        <Skeleton active style={{ width: 540 }} />
      </div>
    );
  }

  const menuItems = [
    { key: "/workspace", icon: <HomeOutlined />, label: "工作台" },
    { key: "/actions", icon: <ProfileOutlined />, label: "行动清单" },
    ...(status.role === "procurement"
      ? []
      : [{ key: "/batches", icon: <DatabaseOutlined />, label: "数据批次" }]),
    { key: "/trace", icon: <AuditOutlined />, label: "追溯记录" },
  ];

  const selected = menuItems.find((item) => location.startsWith(item.key))?.key ?? "/workspace";

  async function logout() {
    await api<void>("/auth/logout", { method: "POST" });
    await refresh();
    navigate("/login", { replace: true });
  }

  return (
    <Layout className="app-shell">
      <Sider width={232} className="app-sider" theme="light">
        <div className="brand">
          <div className="brand-mark">
            <CompassOutlined />
          </div>
          <div>
            <div className="brand-title">趣然 AI 决策</div>
            <div className="brand-subtitle">经营利润工作台</div>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selected]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ padding: "12px 8px" }}
        />
        <div className="sidebar-source">
          <div>
            <span className="status-dot" /> 同源状态
          </div>
          <p>页面数据来自已发布批次，规则结论与执行结果全程留痕。</p>
        </div>
      </Sider>
      <Layout className="main-layout">
        <header className="topbar">
          <div className="topbar-context">
            <strong>玩具事业部</strong>
            <span className="topbar-divider" />
            <span>当前批次</span>
            <strong className="mono">{workspace.data?.batch?.batch_id ?? "暂无可用批次"}</strong>
            <Tag color="success" bordered={false}>
              清单可用
            </Tag>
          </div>
          <Space size={14}>
            <Tag color="blue">{status.role_label}</Tag>
            <div className="identity">
              <div className="identity-name">{status.actor_name}</div>
              <div className="identity-role">钉钉身份 · {status.actor_ref}</div>
            </div>
            <Button type="text" icon={<LogoutOutlined />} onClick={() => void logout()}>
              退出
            </Button>
          </Space>
        </header>
        <main className="content">{children}</main>
      </Layout>
    </Layout>
  );
}
