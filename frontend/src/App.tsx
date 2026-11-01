/**
 * FILE: src/App.tsx
 * PURPOSE: The route table. Pages are lazy-loaded (code splitting) so the first screen loads
 *          fast; admin pages are only downloaded by admins who open them.
 *            /login /register      guests only
 *            /, /deposit ...       signed-in users (inside AppShell)
 *            /admin/*              admins only (server re-checks the role on every call)
 * WHERE USED: rendered by main.tsx.
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { GuestOnly, RequireAdmin, RequireAuth, RequireMember } from "./auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { Skeleton } from "./components/ui/Spinner";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Deposit = lazy(() => import("./pages/Deposit"));
const Withdraw = lazy(() => import("./pages/Withdraw"));
const Transfer = lazy(() => import("./pages/Transfer"));
const History = lazy(() => import("./pages/History"));
const Limits = lazy(() => import("./pages/Limits"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminAccounts = lazy(() => import("./pages/admin/AdminAccounts"));
const AdminWithdrawals = lazy(() => import("./pages/admin/AdminWithdrawals"));
const AdminTransactions = lazy(() => import("./pages/admin/AdminTransactions"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));

const Fallback = () => <div className="space-y-4 p-8"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;

export default function App() {

  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route element={<RequireMember />}>
              <Route index element={<Dashboard />} />
              <Route path="deposit" element={<Deposit />} />
              <Route path="withdraw" element={<Withdraw />} />
              <Route path="transfer" element={<Transfer />} />
              <Route path="history" element={<History />} />
              <Route path="info" element={<Limits />} />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/accounts" element={<AdminAccounts />} />
              <Route path="admin/withdrawals" element={<AdminWithdrawals />} />
              <Route path="admin/transactions" element={<AdminTransactions />} />
              <Route path="admin/reports" element={<AdminReports />} />
              <Route path="admin/audit-logs" element={<AdminAuditLogs />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
