/**
 * FILE: src/pages/admin/AdminReports.tsx
 * PURPOSE
 *   The three accounting reports in tabs:
 *     Daily summary   - per day: deposits, withdrawals, transfers, reversals, fees
 *     Trial balance   - every account's total debits/credits; both totals must be equal
 *     Reconciliation  - cached balance vs balance recalculated from the ledger; mismatches first
 * WHERE USED: route /admin/reports.   DATA: useDailySummary, useTrialBalance, useReconciliation.
 */
import { motion } from "framer-motion";
import { CheckCircle2, Download, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card, PageHeader } from "../../components/ui/Card";
import { Segmented } from "../../components/ui/Segmented";
import { Skeleton } from "../../components/ui/Spinner";
import { useDailySummary, useReconciliation, useTrialBalance } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { formatAmount, formatDate, formatDateTime } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { downloadReportPdf } from "../../lib/statementPdf";

type Tab = "daily" | "trial" | "recon";

function Table({ heads, children, right = [] }: { heads: string[]; children: ReactNode; right?: number[] }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[15px]">
      <thead className="bg-brand-50 text-sm text-brand-700"><tr>{heads.map((h, i) => <th key={h} className={cn("px-5 py-3 font-semibold", right.includes(i) && "text-right")}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table></div>
  );
}
const Row = ({ i, className, children }: { i: number; className?: string; children: ReactNode }) => (
  <motion.tr initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * i }} className={cn("border-t border-brand-100 transition-colors hover:bg-brand-50", className)}>{children}</motion.tr>
);
const Num = ({ v, bold }: { v: string | number; bold?: boolean }) => <td className={cn("tnum px-5 py-3.5 text-right", bold && "font-display font-semibold")}>{formatAmount(v)}</td>;

function Daily() {
  const q = useDailySummary(14);
  if (q.isError) return <Card className="m-5 !rounded-md !border-black !shadow-none"><p className="font-bold">Report could not be loaded</p><p className="mt-2 text-sm">{q.error instanceof Error ? q.error.message : "Check your admin access and backend."}</p></Card>;
  if (!q.data) return <Skeleton className="m-5 h-64" />;
  return (
    <>
    {/* <Explain title="Daily summary">
      <p>For each day: how many transactions completed and how much money moved, split by type. <b>Deposits</b> are cash in, <b>withdrawals</b> are cash out, <b>transfers</b> move money between members, and <b>fees</b> are what the platform earned on those transfers.</p>
    </Explain> */}
    <Table heads={["Day", "Deposits", "Withdrawals", "Transfers", "Reversals", "Transactions", "Volume"]} right={[1, 2, 3, 4, 5, 6, 7]}>
      {q.data.map((r, i) => (
        <Row key={r.day} i={i}>
          <td className="whitespace-nowrap px-5 py-3.5 font-semibold">{formatDate(r.day + "T00:00:00")}</td>
          {[r.deposits, r.withdrawals, r.transfers, r.reversals].map((c, k) => <td key={k} className="tnum px-5 py-3.5 text-right">{formatAmount(c.volume)}<span className="block text-xs text-brand-600">{c.count} tx</span></td>)}
          <td className="tnum px-5 py-3.5 text-right">{r.total_count}</td><Num v={r.total_volume} bold />
        </Row>
      ))}
    </Table>
    </>
  );
}

function Trial() {
  const q = useTrialBalance();
  if (q.isError) return <Card className="m-5 !rounded-md !border-black !shadow-none"><p className="font-bold">Report could not be loaded</p><p className="mt-2 text-sm">{q.error instanceof Error ? q.error.message : "Check your admin access and backend."}</p></Card>;
  if (!q.data) return <Skeleton className="m-5 h-64" />;
  const d = q.data;
  return (
    <>
      {/* <Explain title="What is a trial balance?">
        <p>Every transaction is written in the ledger as <b>two equal sides</b>: a <b>debit</b> (money leaving one account) and a <b>credit</b> (money arriving in another). This report adds up every debit and every credit of every account in the whole system.</p>
        <p>The two grand totals must be <b>exactly equal</b>. If they are, no money was created or lost by mistake anywhere. Think of counting a till at the end of the day: what came in must match what went out plus what is left.</p>
      </Explain> */}
      <div className={cn("m-5 flex items-center gap-3 rounded-2xl p-4 font-semibold", d.balanced ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
        {d.balanced ? <CheckCircle2 className="size-5" /> : <ShieldAlert className="size-5" />}
        {d.balanced ? "Total debits equal total credits: the ledger sums to zero." : "Debits and credits differ. Investigate immediately."}
        <span className="ml-auto text-sm font-normal">Generated {formatDateTime(d.generated_at)}</span>
      </div>
      <Table heads={["Ledger Account", "Wallet Number", "Debits", "Credits", "Ledger balance"]} right={[3, 4, 5]}>
        {d.rows.map((r, i) => (
          <Row key={r.account_id} i={i}>
            <td className="px-5 py-3.5 font-mono text-sm">{r.account_number}</td>
            <td className="px-5 py-3.5 font-semibold">
  {r.name.startsWith("liability - ") ? r.name.slice(11) : r.name}
</td>
            {/* <td className="px-5 py-3.5 font-semibold">{r.name}</td> */}
            {/* <td className="px-5 py-3.5 font-semibold">{r.name.startsWith("%liability -") ? r.name.slice(11,21):r.name}</td> */}
            {/* <td className="px-5 py-3.5"><Badge tone={r.type === "SYSTEM" ? "dark" : "neutral"}>{r.type === "SYSTEM" ? "System" : "Wallet"}</Badge></td> */}
            <Num v={r.total_debits} /><Num v={r.total_credits} /><Num v={r.ledger_balance} bold />
          </Row>
        ))}
        <tr className="border-t-2 border-brand-300 bg-brand-100 font-display text-lg font-semibold"><td className="px-5 py-4" colSpan={2}>Totals</td><Num v={d.total_debits} bold /><Num v={d.total_credits} bold /><td /></tr>
      </Table>
      {/* <p className="px-5 py-4 te xt-sm text-brand-600"><b>Cash In</b> is debited by every deposit. <b>Cash Out</b> is credited by every withdrawal. Member wallets and Fee Revenue are credited when money arrives.</p> */}
    </>
  );
}

function Recon() {
  const q = useReconciliation();
  if (q.isError) return <Card className="m-5 !rounded-md !border-black !shadow-none"><p className="font-bold">Report could not be loaded</p><p className="mt-2 text-sm">{q.error instanceof Error ? q.error.message : "Check your admin access and backend."}</p></Card>;
  if (!q.data) return <Skeleton className="m-5 h-64" />;
  const d = q.data;
  return (
    <>
      {/* <Explain title="What is reconciliation?">
        <p>For speed, every walCash In is debited by every deposit. Cash Out is credited by every withdrawal. Member wallets and Fee Revenue are credited when money arrives.let keeps a ready-made <b>balance</b> number. The <b>ledger</b> is the real record of every movement. Reconciliation takes each wallet, <b>re-adds all of its ledger entries from scratch</b>, and compares the result with the stored balance.</p>
        <p><b>Match</b> = the stored balance is trustworthy. <b>Mismatch</b> = something changed a balance outside the normal flow (a bug or a manual edit) and needs investigating. Mismatches are listed first.</p>
      </Explain> */}
      <div className={cn("m-5 flex items-center gap-3 rounded-2xl p-4 font-semibold", d.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
        {d.ok ? <CheckCircle2 className="size-5" /> : <ShieldAlert className="size-5" />}
        {d.ok ? `All ${d.checked_accounts} accounts match the ledger.` : `${d.mismatch_count} of ${d.checked_accounts} accounts do not match the ledger.`}
        <span className="ml-auto text-sm font-normal">Generated {formatDateTime(d.generated_at)}</span>
      </div>
      <Table heads={["Account", "Name", "Cached balance", "Ledger balance", "Difference", "Result"]} right={[2, 3, 4]}>
        {d.rows.map((r, i) => (
          <Row key={r.account_id} i={i} className={cn(!r.matches && "bg-bad-soft/50")}>
            <td className="px-5 py-3.5 font-mono text-sm">{r.account_number}</td><td className="px-5 py-3.5 font-semibold">{r.name}</td>
            <Num v={r.cached_balance} /><Num v={r.ledger_balance} /><Num v={r.difference} bold />
            <td className="px-5 py-3.5">{r.matches ? <Badge tone="ok" dot>Match</Badge> : <Badge tone="bad" dot>Mismatch</Badge>}</td>
          </Row>
        ))}
      </Table>
    </>
  );
}

export default function AdminReports() {
  const [tab, setTab] = useState<Tab>("daily");
  const daily=useDailySummary(14); const trial=useTrialBalance(); const recon=useReconciliation();
  const download=()=>{
    if(tab==="daily"&&daily.data) downloadReportPdf("Daily summary",`Posted ledger activity · ${new Date().toLocaleString()}`, ["Date","Deposits","Withdrawals","Transfers","Reversals","Fees","Count","Volume"],daily.data.map(r=>[r.day,r.deposits.volume,r.withdrawals.volume,r.transfers.volume,r.reversals.volume,r.fees,String(r.total_count),String(r.total_volume)]),"maypay-daily-summary.pdf");
    if(tab==="trial"&&trial.data) downloadReportPdf("Trial balance",`Generated ${formatDateTime(trial.data.generated_at)} · Balanced: ${trial.data.balanced?"Yes":"No"}`, ["Ledger Account","Wallet Number","Debits","Credits","Balance"],trial.data.rows.map(r=>[r.account_number,r.type === "SYSTEM" ? r.name : `User: ${r.name}`,r.total_debits,r.total_credits,r.ledger_balance]),"maypay-trial-balance.pdf");
    if(tab==="recon"&&recon.data) downloadReportPdf("Reconciliation report",`Generated ${formatDateTime(recon.data.generated_at)} · ${recon.data.checked_accounts} wallets · mismatches ${recon.data.mismatch_count}`, ["Wallet","Owner","Status","Cached","Ledger","Difference","Match"],recon.data.rows.map(r=>[r.account_number,r.name,r.status,r.cached_balance,r.ledger_balance,r.difference,r.matches?"YES":"NO"]),"maypay-reconciliation-report.pdf");
  };
  const ready=tab==="daily"?!!daily.data:tab==="trial"?!!trial.data:!!recon.data;
  return <><PageHeader title="Reports" subtitle="Daily summary, trial balance and wallet-to-ledger reconciliation."/><Card className="!p-0 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 p-4 sm:p-5"><Segmented value={tab} onChange={setTab} options={[{value:"daily",label:"Daily summary"},{value:"trial",label:"Trial balance"},{value:"recon",label:"Reconciliation"}]}/><Button variant="secondary" size="sm" disabled={!ready} icon={<Download className="size-4"/>} onClick={download}>Download PDF</Button></div>{tab==="daily"?<Daily/>:tab==="trial"?<Trial/>:<Recon/>}</Card></>;
}
