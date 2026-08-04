import { ClockCounterClockwise, ListChecks, SquaresFour, Stack, TrendUp } from "@phosphor-icons/react";
import type { PropsWithChildren } from "react";
import type { CurrentUser } from "../api.ts";

const roleLabel: Record<CurrentUser["role"], string> = {
  operator: "运营",
  manager: "运营主管",
  procurement: "采购计划",
};

export function AppShell({ user, children }: PropsWithChildren<{ user: CurrentUser }>) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand brand--dark">
          <span className="brand__mark"><TrendUp weight="bold" /></span>
          <span><strong>趣然经营助手</strong><small>玩具事业部</small></span>
        </div>
        <nav aria-label="主导航">
          <a href="/"><SquaresFour />工作台</a>
          <a href="/batches"><Stack />数据批次</a>
          <a href="/actions"><ListChecks />{user.role === "procurement" ? "采购待办" : "行动清单"}</a>
          <a href="/history"><ClockCounterClockwise />历史追溯</a>
        </nav>
        <div className="sidebar__user"><strong>{user.displayName}</strong><small>{roleLabel[user.role]}</small></div>
      </aside>
      <main className="shell-main">{children}</main>
    </div>
  );
}
