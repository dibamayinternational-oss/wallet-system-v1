/**
 * FILE: src/pages/Dashboard.tsx
 * PURPOSE: Home screen after sign in: wallet card, quick actions, 7-day money in/out chart,
 *          recent activity and a notice when withdrawals await approval.
 * WHERE USED: route "/".   DATA: useWallet, useActivity, useStatement, useMyTransactions.
 */
import { ArrowDownToLine, ArrowUpFromLine, Hourglass, ReceiptText, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Card, Reveal } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Spinner";
import { ActivityRow } from "../components/wallet/ActivityRow";
import { BarChart } from "../components/wallet/BarChart";
import { WalletCard } from "../components/wallet/WalletCard";
import { useActivity, useMyTransactions, useStatement, useWallet } from "../hooks/queries";
import { formatMoney } from "../lib/format";

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

const ACTIONS = [
  { to: "/deposit", label: "Deposit", hint: "Add money", icon: ArrowDownToLine },
  { to: "/withdraw", label: "Withdraw", hint: "Take money out", icon: ArrowUpFromLine },
  { to: "/transfer", label: "Send money", hint: "To another wallet", icon: Send },
];

export default function Dashboard() {
  const { user } = useAuth();
  const wallet = useWallet();
  const activity = useActivity(7);
  const recent = useStatement({ page: 1, page_size: 6 });
  const pending = useMyTransactions("PENDING");

  const rows = (activity.data ?? []).map((d) => ({
    label: new Date(d.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }),
    a: Number(d.money_in), b: Number(d.money_out),
  }));

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-3xl font-semibold sm:text-4xl">{greeting()}, {user?.full_name.split(" ")[0]}</h1>
        <p className="mt-1 text-brand-700">Here is where your money stands today.</p>
      </Reveal>

      {!!pending.data?.total && (
        <Reveal index={1}>
          <Link to="/history" className="flex items-center gap-3 rounded-2xl bg-warn-soft px-5 py-4 text-warn transition hover:brightness-95">
            <Hourglass className="size-5 animate-pulse" />
            <p className="font-semibold">
              {pending.data.total} withdrawal{pending.data.total > 1 ? "s" : ""} waiting for admin approval
              <span className="font-normal"> · {formatMoney(pending.data.items.reduce((s, t) => s + Number(t.amount), 0))} total</span>
            </p>
          </Link>
        </Reveal>
      )}

      {wallet.isError && <Card className="!border-bad/30 !bg-bad-soft"><p className="font-semibold text-bad">Your wallet could not be loaded.</p><p className="mt-1 text-sm text-bad">{wallet.error instanceof Error ? wallet.error.message : "Check that the backend is running and you are signed in."}</p></Card>}
      {activity.isError && <Card className="!border-warn/30 !bg-warn-soft"><p className="font-semibold text-warn">Activity could not be loaded.</p><p className="mt-1 text-sm text-warn">{activity.error instanceof Error ? activity.error.message : "Try refreshing the page."}</p></Card>}

      <div className="grid grid-cols-1 gap-6">
        <div className="grid min-w-0 grid-cols-1 items-center gap-6 xl:grid-cols-[27rem_minmax(0,1fr)]">
          {wallet.data ? <WalletCard wallet={{ ...wallet.data, name: user?.full_name ?? "Wallet holder" }} /> : <Skeleton className="aspect-[1.586/1] w-full max-w-[27rem] rounded-[1.6rem]" />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
            {ACTIONS.map((a, i) => (
              <Reveal key={a.to} index={i + 2}>
                <Link to={a.to} className="group block">
                  <Card interactive className="flex items-center gap-4 !p-4 sm:flex-col sm:items-start sm:gap-5 xl:flex-row xl:items-center xl:gap-4">
                    <span className="grid size-12 place-items-center rounded-2xl bg-brand-800 text-brand-50 transition-all duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 group-hover:bg-brand-700">
                      <a.icon className="size-6" />
                    </span>
                    <div><p className="font-display text-lg font-semibold">{a.label}</p><p className="text-sm text-brand-600">{a.hint}</p></div>
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
          <Reveal index={3} className="min-w-0">
            <Card>
              <h2 className="mb-1 text-xl font-semibold">Last 7 days</h2>
              <p className="mb-5 text-sm text-brand-600">Money in and out of your wallet</p>
              {activity.data ? <BarChart rows={rows} aLabel="Money in" bLabel="Money out" /> : <Skeleton className="h-52" />}
            </Card>
          </Reveal>
          <Reveal index={4} className="min-w-0">
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recent activity</h2>
                <Link to="/history" className="text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">See all</Link>
              </div>
              {recent.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
                : recent.data?.items.length ? <ul>{recent.data.items.map((l, i) => <ActivityRow key={l.entry_id} line={l} index={i} />)}</ul>
                : <EmptyState icon={<ReceiptText className="size-7" />} title="No activity yet" text="Make a deposit and it will show up here." />}
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
