/**
 * Authentication state for the existing wallet-system-v1 backend.
 * The backend returns the token separately from the user profile and has no refresh
 * or logout endpoint. Tokens therefore stay in memory and a reload requires sign-in.
 */
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken, setOnAuthLost } from "../lib/api";
import type { Role, TokenResponse, User } from "../types/api";

type Status = "loading" | "authed" | "anon";

interface BackendUser {
  id: number;
  full_name: string;
  email: string;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
}

interface AuthValue {
  user: User | null;
  status: Status;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, full_name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function normalizeUser(value: BackendUser): User {
  return {
    id: String(value.id),
    full_name: value.full_name,
    email: value.email,
    // The rest of this starter frontend uses uppercase role labels internally.
    role: value.role.toUpperCase() as Role,
    is_active: value.is_active,
    created_at: value.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const queryClient = useQueryClient();

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anon");
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setOnAuthLost(clear);
    // This backend has no refresh endpoint, and the token is intentionally memory-only.
    setStatus("anon");
    return () => setOnAuthLost(null);
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api<TokenResponse>("/auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
      auth: false,
    });

    setAccessToken(session.access_token);
    try {
      const profile = await api<BackendUser>("/auth/me");
      setUser(normalizeUser(profile));
      setStatus("authed");
    } catch (error) {
      setAccessToken(null);
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, full_name: string, password: string) => {
    // Registration returns UserResponse, not TokenResponse, so sign in separately.
    await api<BackendUser>("/auth/register", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), full_name: full_name.trim(), password },
      auth: false,
    });
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    // The current backend has no /auth/logout route; clear the client session only.
    clear();
  }, [clear]);

  const value = useMemo<AuthValue>(() => ({
    user,
    status,
    isAdmin: user?.role === "ADMIN",
    login,
    register,
    logout,
  }), [user, status, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
