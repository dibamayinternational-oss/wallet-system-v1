import { motion } from "framer-motion";
import { Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CircleDollarSign, Coins, Hourglass, ShieldAlert, ShieldCheck, Snowflake, Users } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Card, PageHeader, Reveal } from "../../components/ui/Card";
import { CountUp } from "../../components/ui/RollingNumber";
import { Skeleton } from "../../components/ui/Spinner";
import { BarChart } from "../../components/wallet/BarChart";
import { useAdminDashboard, useDailySummary, useReconciliation } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { formatAmount, formatMoney } from "../../lib/format";

function Stat({ icon: Icon, label, value, sub, tone = "base", to }: { icon: ComponentType<{className?:string}>; label:string; value:ReactNode; sub?:ReactNode; tone?:"base"|"dark"|"warn"; to?:string }) {
 const body=<Card interactive className={cn("h-full !p-5",tone==="dark"&&"!border-brand-900 !bg-brand-900 text-brand-50",tone==="warn"&&"!border-warn/30 !bg-warn-soft")}><div className="mb-4 flex items-center justify-between"><p className={cn("text-sm font-semibold",tone==="dark"?"text-brand-300":"text-brand-700")}>{label}</p><span className={cn("grid size-9 place-items-center rounded-xl",tone==="dark"?"bg-white/10":"bg-brand-100 text-brand-800")}><Icon className="size-[18px]"/></span></div><p className="tnum font-display text-3xl font-semibold">{value}</p>{sub&&<p className={cn("mt-1 text-sm",tone==="dark"?"text-brand-300":"text-brand-600")}>{sub}</p>}</Card>;
 return to?<Link to={to} className="block h-full">{body}</Link>:body;
}
export default function AdminDashboard(){
 const q=useAdminDashboard(); const [chartDays,setChartDays]=useState<7|30>(7); const chartQuery=useDailySummary(chartDays); const recon=useReconciliation();
 if(!q.data) return <><PageHeader title="Control room" subtitle="Live view of money, approvals and ledger health."/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({length:8},(_,i)=><Skeleton key={i} className="h-36 rounded-3xl" />)}</div></>;
 const d=q.data; const healthy=d.ledger_balanced&&(recon.data?.mismatch_count??0)===0;
 const chart=[...(chartQuery.data??[])].reverse().map(r=>({label:new Date(r.day+"T00:00:00").toLocaleDateString("en-GB",chartDays===7?{weekday:"short"}:{day:"2-digit",month:"short"}),a:Number(r.deposits.volume),b:Number(r.withdrawals.volume),c:Number(r.transfers.volume)}));
 return <><PageHeader title="Control room" subtitle="Live view of money, approvals and ledger health."/>
 <Reveal><motion.div className={cn("mb-6 flex flex-wrap items-center gap-4 rounded-3xl p-5 sm:p-6",healthy?"bg-ok-soft text-ok":"bg-bad-soft text-bad")} layout><span className="relative grid size-14 place-items-center"><span className={cn("absolute inset-0 animate-pulse-ring rounded-full",healthy?"bg-ok/40":"bg-bad/40")}/><span className={cn("relative grid size-14 place-items-center rounded-full text-white",healthy?"bg-ok":"bg-bad")}>{healthy?<ShieldCheck className="size-7"/>:<ShieldAlert className="size-7"/>}</span></span><div className="min-w-0 flex-1"><p className="font-display text-2xl font-semibold">{healthy?"Ledger is healthy":"Attention: review ledger health"}</p><p className="text-[15px]">Ledger net {formatAmount(d.ledger_net)} · {recon.data?.mismatch_count??"…"} reconciliation mismatch(es)</p></div><Link to="/admin/reports" className="rounded-xl bg-white/70 px-4 py-2 text-sm font-semibold transition hover:bg-white">Open reports</Link></motion.div></Reveal>
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{[
 <Stat key="a" tone="dark" icon={CircleDollarSign} label="Total money in the system" value={<CountUp value={Number(d.total_money_in_system)} format={formatMoney}/>} sub={<>Cash in {formatMoney(d.total_cash_in)} − cash out {formatMoney(d.total_cash_out)}</>}/>,
 <Stat key="h" tone="dark" icon={Coins} label="Fee income" value={<CountUp value={Number(d.fee_revenue_balance)} format={formatMoney}/>} />,
 <Stat key="b" icon={ArrowLeftRight} label="Transactions today" value={<CountUp value={d.today.count}/>} sub={`${formatMoney(d.today.volume)} volume`}/>,
 <Stat key="c" tone={d.pending_withdrawals.count?"warn":"base"} icon={Hourglass} to="/admin/withdrawals" label="Pending approvals" value={<CountUp value={d.pending_withdrawals.count}/>} sub={`${formatMoney(d.pending_withdrawals.volume)} waiting`}/>,
 <Stat key="d" icon={Users} to="/admin/accounts" label="Active accounts" value={<CountUp value={d.active_accounts}/>} sub={<span className="inline-flex items-center gap-1"><Snowflake className="size-3.5"/>{d.frozen_accounts} frozen</span>}/>,
 <Stat key="e" icon={ArrowDownToLine} label="Cash in today (deposits)" value={<CountUp value={Number(d.deposits.volume)} format={formatMoney}/>} sub={`${d.deposits.count} deposits · all-time ${formatMoney(d.total_cash_in)}`}/>,
 <Stat key="f" icon={ArrowUpFromLine} label="Cash out today (withdrawals)" value={<CountUp value={Number(d.withdrawals.volume)} format={formatMoney}/>} sub={`${d.withdrawals.count} withdrawals · all-time ${formatMoney(d.total_cash_out)}`}/>,
 <Stat key="g" icon={ArrowLeftRight} label="Transfers today" value={<CountUp value={Number(d.transfers.volume)} format={formatMoney}/>} sub={`${d.transfers.count} transactions · ${d.reversals.count} reversals`}/>,
 <Stat key="audit" icon={Activity} to="/admin/audit-logs" label="Audit trail" value="View logs" sub="Review administrative actions"/>
 ].map((el,i)=><Reveal key={i} index={i+1}>{el}</Reveal>)}</div>
 <Reveal index={10} className="mt-6">
    <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Transaction volume</h2>
            <div 
            className="inline-flex rounded-xl border border-brand-200 bg-brand-50 p-1" aria-label="Chart date range">
                {([7,30] as const).map(days=><button key={days} type="button" onClick={()=>setChartDays(days)} aria-pressed={chartDays===days} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition",chartDays===days?"bg-brand-900 text-white shadow-sm":"text-brand-700 hover:bg-white")}>Last {days} days</button>)}</div></div><p className="mb-5 text-sm text-brand-600">Daily deposit, withdrawal and transfer volume</p>{chartQuery.data?<BarChart rows={chart} aLabel="Deposits" bLabel="Withdrawals" cLabel="Transfers" height={210}/>:<Skeleton className="h-56"/>}</Card>
                </Reveal>
 </>;
}
