import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";

import { loadAuth } from "../api";
import type { AuthStatus } from "../types";

interface AuthContextValue {
  status?: AuthStatus;
  loading: boolean;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["auth"],
    queryFn: loadAuth,
    retry: false,
    staleTime: 30_000,
  });
  return (
    <AuthContext.Provider
      value={{ status: query.data, loading: query.isLoading, refresh: query.refetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider 未初始化");
  return context;
}
