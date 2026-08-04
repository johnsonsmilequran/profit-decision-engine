import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { queryClient } from "./state";
import { loadCurrentUser } from "./api";
import { AuthPage } from "./pages/AuthPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { WorkspacePage } from "./pages/WorkspacePage";

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

const routeTree = rootRoute.addChildren([indexRoute, authRoute, forbiddenRoute, workspaceRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
