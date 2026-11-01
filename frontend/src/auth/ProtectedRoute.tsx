/**
 * FILE: src/auth/ProtectedRoute.tsx
 * PURPOSE: Route guards. <RequireAuth> sends anonymous visitors to /login;
 *          <RequireAdmin> also blocks non-admins. (UI convenience only - the REAL
 *          protection is on the server, which re-checks the role on every request.)
 * WHERE USED: route table in App.tsx.
 */
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FullScreenLoader } from "../components/ui/Spinner";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullScreenLoader />;
  if (status === "anon") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}

/** Wallet pages are for members. Administrators have no wallet, so they are sent to /admin. */
export function RequireMember() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Navigate to="/admin" replace /> : <Outlet />;
}

export function GuestOnly() {
  const { status } = useAuth();
  if (status === "loading") return <FullScreenLoader />;
  return status === "authed" ? <Navigate to="/" replace /> : <Outlet />;
}
