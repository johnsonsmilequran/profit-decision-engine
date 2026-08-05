import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, Spin } from "antd";
import zhCN from "antd/locale/zh_CN";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Redirect, Route, Router, Switch } from "wouter";

import { ProtectedShell } from "./components/AppShell";
import { AuthProvider } from "./components/AuthContext";
import "./styles.css";

const WorkspacePage = lazy(() =>
  import("./pages/WorkspacePage").then((module) => ({ default: module.WorkspacePage })),
);
const ActionListPage = lazy(() =>
  import("./pages/ActionListPage").then((module) => ({ default: module.ActionListPage })),
);
const DecisionDetailPage = lazy(() =>
  import("./pages/DecisionDetailPage").then((module) => ({ default: module.DecisionDetailPage })),
);
const BatchListPage = lazy(() =>
  import("./pages/BatchListPage").then((module) => ({ default: module.BatchListPage })),
);
const BatchImportPage = lazy(() =>
  import("./pages/BatchImportPage").then((module) => ({ default: module.BatchImportPage })),
);
const BatchDetailPage = lazy(() =>
  import("./pages/BatchDetailPage").then((module) => ({ default: module.BatchDetailPage })),
);
const TracePage = lazy(() =>
  import("./pages/TracePage").then((module) => ({ default: module.TracePage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const ForbiddenPage = lazy(() =>
  import("./pages/ForbiddenPage").then((module) => ({ default: module.ForbiddenPage })),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function BusinessRoutes() {
  return (
    <ProtectedShell>
      <Switch>
        <Route path="/workspace" component={WorkspacePage} />
        <Route path="/actions/:decisionId" component={DecisionDetailPage} />
        <Route path="/actions" component={ActionListPage} />
        <Route path="/batches/new" component={BatchImportPage} />
        <Route path="/batches/:batchId" component={BatchDetailPage} />
        <Route path="/batches" component={BatchListPage} />
        <Route path="/trace" component={TracePage} />
        <Route path="/">
          <Redirect to="/workspace" />
        </Route>
        <Route>
          <Redirect to="/forbidden" />
        </Route>
      </Switch>
    </ProtectedShell>
  );
}

function Application() {
  return (
    <Router>
      <Suspense
        fallback={
          <div className="forbidden-screen">
            <Spin size="large" />
          </div>
        }
      >
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/forbidden" component={ForbiddenPage} />
          <Route path="/" nest>
            <BusinessRoutes />
          </Route>
        </Switch>
      </Suspense>
    </Router>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("页面根节点不存在");

createRoot(rootElement).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#075ead",
          colorText: "#132238",
          colorTextSecondary: "#465870",
          colorBorder: "#cbd5e1",
          colorBgLayout: "#f4f7fb",
          borderRadius: 8,
          fontSize: 14,
        },
        components: {
          Table: { cellPaddingBlock: 11 },
          Menu: {
            itemBg: "transparent",
            itemColor: "#465870",
            itemSelectedBg: "#e8f2fd",
            itemSelectedColor: "#075ead",
            itemBorderRadius: 7,
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Application />
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  </StrictMode>,
);
