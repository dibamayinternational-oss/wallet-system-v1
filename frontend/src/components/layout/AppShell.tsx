/**
 * FILE: src/components/layout/AppShell.tsx
 * PURPOSE
 *   The frame around every signed-in page.
 *   DESKTOP (>= 1024px): sidebar stays put. It has its own scrolling area, and the footer
 *     (fee income / user + sign out) is pinned at the bottom, so sign out is ALWAYS reachable.
 *     A button collapses it to an icon rail (remembered between visits).
 *   MOBILE / small windows: a top bar with a menu button. The menu is an overlay drawer that
 *     closes when you pick a page, tap outside, or press Esc.
 *   Members see wallet navigation; notification UI is intentionally omitted.
 *   ADMINS see only the administration menu (they have no wallet) and the platform's FEE INCOME.
 * WHERE USED: parent route of every page in App.tsx.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ChartColumn, ChevronsLeft, ChevronsRight, Coins, Gauge, Hourglass,
  LayoutDashboard, LogOut, Menu, ReceiptText, ScrollText, Send, ShieldCheck, Users, X,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useAdminDashboard } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { formatMoney } from "../../lib/format";
import { RollingNumber } from "../ui/RollingNumber";

interface Item { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean }

const WALLET: Item[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/deposit", label: "Deposit", icon: ArrowDownToLine },
  { to: "/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { to: "/transfer", label: "Send money", icon: Send },
  { to: "/history", label: "History", icon: ReceiptText },
  { to: "/info", label: "Limits & fees", icon: Gauge },
];
const ADMIN: Item[] = [
  { to: "/admin", label: "Control room", icon: ShieldCheck, end: true },
  { to: "/admin/accounts", label: "Accounts", icon: Users },
  { to: "/admin/withdrawals", label: "Approvals", icon: Hourglass },
  { to: "/admin/transactions", label: "All transactions", icon: ArrowLeftRight },
  { to: "/admin/reports", label: "Reports", icon: ChartColumn },
  { to: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
];

const PREF_KEY = "maypay.sidebar";
function useCollapsedPref(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(PREF_KEY) === "collapsed"; } catch { return false; } });
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(PREF_KEY, c ? "open" : "collapsed"); } catch { /* storage blocked */ } return !c; });
  return [collapsed, toggle];
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <motion.div whileHover={{ rotate: 12, scale: 1.08 }} className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-400 text-brand-950">
        <svg viewBox="0 0 24 24" className="size-6" fill="currentColor"><path d="M4 7h16v3H4z" /><path d="M4 14h16v3H4z" opacity=".55" /><circle cx="18" cy="15.5" r="2.4" fill="var(--color-cream-200)" /></svg>
      </motion.div>
      {!compact && <div><p className="font-display text-xl font-semibold leading-none text-white">MayPay</p><p className="mt-0.5 text-xs text-brand-300">Digital wallet</p></div>}
    </div>
  );
}

function NavItem({ item, badge, collapsed, onNavigate }: { item: Item; badge?: number; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} title={collapsed ? item.label : undefined} className="group relative block rounded-xl">
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId={`nav-pill-${collapsed ? "c" : "e"}`} className="absolute inset-0 rounded-xl bg-white/12 ring-1 ring-white/15" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className={cn("relative flex items-center gap-3 py-2.5 text-[15px] font-medium transition-colors", collapsed ? "justify-center px-0" : "px-3.5", isActive ? "text-white" : "text-brand-300 group-hover:text-white")}>
            <item.icon className="size-[18px] shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!!badge && (collapsed
              ? <span className="absolute right-2 top-1.5 size-2.5 rounded-full bg-cream-300" />
              : <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto grid min-w-5 place-items-center rounded-full bg-cream-300 px-1.5 text-xs font-bold text-brand-950">{badge}</motion.span>)}
          </span>
        </>
      )}
    </NavLink>
  );
}

function FeeIncome({ collapsed }: { collapsed: boolean }) {
  const { data } = useAdminDashboard(true);
  if (collapsed) return <div title={data ? `Fee income ${formatMoney(data.fee_revenue_balance)}` : "Fee income"} className="mx-auto grid size-11 place-items-center rounded-xl bg-white/10 text-cream-300"><Coins className="size-5" /></div>;
  return (
    <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between text-brand-300"><p className="text-xs font-semibold">Fee income</p><Coins className="size-4 text-cream-300" /></div>
      <p className="mt-1 font-display text-2xl font-semibold text-white">{data ? <RollingNumber value={data.fee_revenue_balance} /> : "…"}</p>
      <p className="mt-0.5 text-xs text-brand-300">Earned from transfer fees</p>
    </div>
  );
}

function UserChip({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const avatar = <div className="grid size-10 shrink-0 place-items-center rounded-full bg-cream-200 font-display font-semibold text-brand-900">{user.full_name[0]?.toUpperCase()}</div>;
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2" title={user.full_name}>
        {avatar}
        <button onClick={logout} className="grid size-10 place-items-center rounded-xl text-brand-300 transition hover:bg-white/10 hover:text-white" aria-label="Sign out"><LogOut className="size-[18px]" /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/8 p-3">
      {avatar}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{user.full_name}</p><p className="truncate text-xs text-brand-300">{user.role === "ADMIN" ? "Administrator" : "Member"}</p></div>
      <button onClick={logout} className="rounded-lg p-2 text-brand-300 transition hover:bg-white/10 hover:text-white" aria-label="Sign out"><LogOut className="size-[18px]" /></button>
    </div>
  );
}

/** Same content for the desktop sidebar and the mobile drawer. Only the NAV area scrolls. */
function SidebarBody({ collapsed, onNavigate, headerAction }: { collapsed: boolean; onNavigate?: () => void; headerAction?: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const pending = useAdminDashboard(isAdmin).data?.pending_withdrawals.count;
  const items = isAdmin ? ADMIN : WALLET;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex shrink-0 items-center p-4", collapsed ? "justify-center" : "justify-between")}>
        <Brand compact={collapsed} />
        {headerAction}
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3" aria-label="Main">
        {!collapsed && <p className="px-3.5 pb-1 pt-2 text-xs font-semibold text-brand-400">{isAdmin ? "Administration" : "My wallet"}</p>}
        {items.map((i) => <NavItem key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} badge={i.to === "/admin/withdrawals" ? pending : undefined} />)}
      </nav>
      <div className="shrink-0 space-y-3 border-t border-white/10 p-3">
        {isAdmin && <FeeIncome collapsed={collapsed} />}
        <UserChip collapsed={collapsed} />
      </div>
    </div>
  );
}

export function AppShell() {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  // const { isAdmin } = useAuth();
  const [collapsed, toggle] = useCollapsedPref();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]); // always close the drawer after navigating
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="min-h-dvh lg:flex">
      {/* desktop sidebar */}
      <motion.aside initial={false} animate={{ width: collapsed ? 84 : 288 }} transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="sticky top-0 hidden h-dvh shrink-0 overflow-hidden bg-brand-900 lg:block">
        <SidebarBody collapsed={collapsed} headerAction={!collapsed && (
          <button onClick={toggle} className="rounded-lg p-2 text-brand-300 transition hover:bg-white/10 hover:text-white" aria-label="Collapse sidebar"><ChevronsLeft className="size-5" /></button>
        )} />
      </motion.aside>
      {collapsed && (
        <button onClick={toggle} className="fixed left-[60px] top-5 z-30 hidden size-8 place-items-center rounded-full bg-brand-800 text-white shadow-lift ring-2 ring-cream-100 transition hover:scale-110 lg:grid" aria-label="Expand sidebar"><ChevronsRight className="size-4" /></button>
      )}

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-brand-900 px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setDrawer(true)} className="grid size-10 place-items-center rounded-xl text-white transition hover:bg-white/10" aria-label="Open menu"><Menu className="size-6" /></button>
          <Brand />
        </div>
      </header>

      {/* mobile drawer (overlay) */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} className="fixed inset-0 z-40 bg-brand-950/50 backdrop-blur-sm lg:hidden" />
            <motion.aside key="dr" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 h-dvh w-[19rem] max-w-[85vw] bg-brand-900 shadow-lift lg:hidden" role="dialog" aria-label="Menu">
              <SidebarBody collapsed={false} onNavigate={() => setDrawer(false)} headerAction={
                <button onClick={() => setDrawer(false)} className="rounded-lg p-2 text-brand-300 transition hover:bg-white/10 hover:text-white" aria-label="Close menu"><X className="size-5" /></button>
              } />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: "easeOut" }} className="w-full min-w-0">
              {outlet}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
