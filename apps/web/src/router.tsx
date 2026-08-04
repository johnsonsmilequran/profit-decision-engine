import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { queryClient } from "./state";
import { loadCurrentUser } from "./api";
import { AuthPage } from "./pages/AuthPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { BatchListPage } from "./pages/BatchListPage";
import { NewBatchPage } from "./pages/NewBatchPage";
import { BatchDetailPage } from "./pages/BatchDetailPage";
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

const routeTree = rootRoute.addChildren([indexRoute, authRoute, forbiddenRoute, workspaceRoute, batchesRoute, newBatchRoute, batchDetailRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
