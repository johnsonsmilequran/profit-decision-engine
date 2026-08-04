import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { queryClient } from "./state.ts";
import { loadCurrentUser, loadWorkspace } from "./api.ts";
import { AuthPage } from "./pages/AuthPage.tsx";
import { ForbiddenPage } from "./pages/ForbiddenPage.tsx";
import { WorkspacePage } from "./pages/WorkspacePage.tsx";
import { BatchListPage } from "./pages/BatchListPage.tsx";
import { NewBatchPage } from "./pages/NewBatchPage.tsx";
import { BatchDetailPage } from "./pages/BatchDetailPage.tsx";
import { ActionListPage } from "./pages/ActionListPage.tsx";
import { DecisionDetailPage } from "./pages/DecisionDetailPage.tsx";
import { z } from "zod";

const rootRoute = createRootRoute({ component: Outlet });

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/dingtalk",
  component: AuthPage,
});

const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forbidden",
  beforeLoad: async ({ location }) => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: location.href } });
    return { user };
  },
  component: function ForbiddenRoute() {
    const { user } = forbiddenRoute.useRouteContext();
    return <ForbiddenPage user={user} />;
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: "/" } });
    throw redirect({ to: "/workspace" });
  },
  component: () => null,
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace",
  beforeLoad: async ({ location }) => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: location.href } });
    return { user };
  },
  component: function WorkspaceRoute() {
    const { user } = workspaceRoute.useRouteContext();
    return <WorkspacePage user={user} />;
  },
});

const batchSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  keyword: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["received", "validating", "rules_processing", "list_ready", "failed"]).optional().catch(undefined),
});
const batchesRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/batches", validateSearch: (search) => batchSearchSchema.parse(search),
  beforeLoad: async ({ location }) => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: location.href } });
    return { user };
  },
  component: function BatchesRoute() { const { user } = batchesRoute.useRouteContext(); return <BatchListPage user={user} />; },
});
const newBatchRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/batches/new",
  beforeLoad: async ({ location }) => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: location.href } });
    if (user.role !== "operator") throw redirect({ to: "/forbidden" });
    return { user };
  },
  component: function NewBatchRoute() { const { user } = newBatchRoute.useRouteContext(); return <NewBatchPage user={user} />; },
});
const batchDetailRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/batches/$batchId",
  validateSearch: (search) => z.object({ duplicate: z.enum(["1"]).optional().catch(undefined) }).parse(search),
  beforeLoad: async ({ location }) => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: location.href } });
    return { user };
  },
  component: function BatchDetailRoute() { const { user } = batchDetailRoute.useRouteContext(); return <BatchDetailPage user={user} />; },
});

const actionsIndexRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/actions",
  beforeLoad: async ({ location }) => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: location.href } });
    const workspace = await queryClient.fetchQuery({ queryKey: ["workspace"], queryFn: loadWorkspace });
    if (workspace.latestBatch) throw redirect({ to: "/action-lists/$batchId", params: { batchId: workspace.latestBatch.id }, search: { page: 1 } });
    throw redirect({ to: "/workspace" });
  }, component: () => null,
});
const actionSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1), keyword: z.string().trim().max(100).optional().catch(undefined),
  action: z.enum(["clearance", "stop_loss", "observe", "increase_investment", "restock", "block_restock"]).optional().catch(undefined),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional().catch(undefined),
  executionStatus: z.enum(["awaiting_review", "pending_execution", "executed", "result_recorded", "closed_by_rejection"]).optional().catch(undefined),
});
const actionListRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/action-lists/$batchId", validateSearch: (search) => actionSearchSchema.parse(search),
  beforeLoad: async ({ location }) => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: location.href } });
    return { user };
  }, component: function ActionListRoute() { const { user } = actionListRoute.useRouteContext(); return <ActionListPage user={user} />; },
});
const decisionDetailRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/decisions/$decisionId",
  beforeLoad: async ({ location }) => {
    const user = await queryClient.fetchQuery({ queryKey: ["current-user"], queryFn: loadCurrentUser, staleTime: 30_000 });
    if (!user) throw redirect({ to: "/auth/dingtalk", search: { return_to: location.href } });
    return { user };
  }, component: function DecisionDetailRoute() { const { user } = decisionDetailRoute.useRouteContext(); return <DecisionDetailPage user={user} />; },
});

const routeTree = rootRoute.addChildren([indexRoute, authRoute, forbiddenRoute, workspaceRoute, batchesRoute, newBatchRoute, batchDetailRoute, actionsIndexRoute, actionListRoute, decisionDetailRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
