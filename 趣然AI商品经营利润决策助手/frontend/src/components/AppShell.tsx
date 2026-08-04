import {
  AuditOutlined,
  DatabaseOutlined,
  HomeOutlined,
  LogoutOutlined,
  ProfileOutlined,
} from "@ant-design/icons";
import { Button, Layout, Menu, Skeleton, Space, Tag } from "antd";
import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";

import { api } from "../api";
import { useAuth } from "./AuthContext";

const { Sider } = Layout;

export function ProtectedShell({ children }: { children: ReactNode }) {
  const { status, loading, refresh } = useAuth();
  const [location, navigate] = useLocation();

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
      <Sider width={232} className="app-sider">
        <div className="brand">
          <div className="brand-title">趣然 AI 经营决策</div>
          <div className="brand-subtitle">商品经营与利润助手</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ padding: "12px 8px" }}
        />
      </Sider>
      <Layout className="main-layout">
        <header className="topbar">
          <div className="topbar-context">
            <span className="status-dot" />
            <span>实时连接</span>
            <span>·</span>
            <span>当前数据以最新发布批次为准</span>
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
