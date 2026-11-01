/**
 * MayPay-style statement modal adapted to wallet-system-v1's existing API.
 * The PDF is assembled in the frontend; no backend endpoint or backend file is changed.
 * An empty period means all available dates. Export always includes every transaction type.
 */
import { motion } from "framer-motion";
import { Download, FileDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../lib/api";
import { downloadStatementPdf } from "../../lib/statementPdf";
import { cn } from "../../lib/cn";
import { useWallet } from "../../hooks/queries";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAY = 86_400_000;
function presets(today: Date) {
  return [
    { label: "This month", from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) },
    { label: "Last month", from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) },
    { label: "Last 90 days", from: iso(new Date(today.getTime() - 89 * DAY)), to: iso(today) },
    { label: "This year", from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) },
  ];
}
type HistoryRow = {
  created_at: string; transaction_type: string; reference: string;
  debit: string | number | null; credit: string | number | null;
  running_balance: string | number; amount?: string | number; description?: string | null; note?: string | null;
};
type HistoryPage = { items: HistoryRow[]; total: number };

export function StatementDownload({ initialFrom, initialTo }: { initialFrom?: string; initialTo?: string }) {
  const today = new Date();
  const quick = presets(today);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(initialFrom || "");
  const [to, setTo] = useState(initialTo || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const { user } = useAuth();
  const wallet = useWallet();

  const validate = () => {
    if (from && to && to < from) return "The end date must be on or after the start date.";
    if (from && to && (new Date(to).getTime() - new Date(from).getTime()) / DAY > 365) return "Choose a period of one year or less.";
    return "";
  };
  const choosePreset = (p: {from:string;to:string}) => { setFrom(p.from); setTo(p.to); setError(""); };

  const download = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    try {
      const rows: HistoryRow[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await api<HistoryPage>("/transactions/history", {
          query: {
            page, page_size: 100,
            start_date: from ? `${from}T00:00:00Z` : undefined,
            end_date: to ? `${to}T23:59:59Z` : undefined,
          },
        });
        rows.push(...result.items);
        total = result.total;
        page += 1;
      } while (rows.length < total && page < 10000);

      downloadStatementPdf({
        title: "MayPay Account Statement",
        customer: user?.full_name ?? "Wallet holder",
        walletNumber: wallet.data?.account_number ?? "Unavailable",
        from: from || "All available dates",
        to: to || "All available dates",
        rows: rows.map((row) => ({
          date: row.created_at,
          type: (() => { const raw=row.transaction_type.toLowerCase(); const fee=raw==="transfer"&&Number(row.debit)>Number(row.amount)?(Number(row.debit)-Number(row.amount)).toFixed(2):""; const label=raw==="deposit"?"Deposit (cash in)":raw==="withdrawal"?"Withdrawal (cash out)":raw==="transfer"?(fee?`Transfer fee ${fee}`:"Transfer"):raw==="fee"?"Transfer fee":raw==="reversal"||raw==="adjustment"?"Reversal":raw.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase()); return label; })(),
          reference: row.reference,
          debit: row.debit == null ? "-" : String(row.debit),
          credit: row.credit == null ? "-" : String(row.credit),
          balance: String(row.running_balance),
          note: String(row.note ?? row.description ?? "").slice(0, 100),
        })),
      });
      toast.success("Statement PDF downloaded");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the statement.");
    } finally { setBusy(false); }
  };

  const inputCls = "h-12 w-full min-w-0 rounded-xl border border-brand-200 bg-white px-3.5 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-300/40";
  return <>
    <Button variant="secondary" icon={<FileDown className="size-[18px]" />} onClick={() => { setError(""); setOpen(true); }}>Download statement</Button>
    <Modal open={open} onClose={() => setOpen(false)} title="Download statement" description="Choose a period, or leave both dates empty for all available history. The PDF includes every transaction type, notes where available, and the running balance.">
      <div className="mb-4 flex flex-wrap gap-2">
        {quick.map((p, i) => <motion.button key={p.label} type="button" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:.04*i}} whileTap={{scale:.95}} onClick={() => choosePreset(p)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",from===p.from&&to===p.to?"bg-brand-800 text-white":"bg-brand-100 text-brand-800 hover:bg-brand-200")}>{p.label}</motion.button>)}
        <button type="button" onClick={() => {setFrom("");setTo("");setError("");}} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold",!from&&!to?"bg-brand-800 text-white":"bg-brand-100 text-brand-800 hover:bg-brand-200")}>All dates</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-brand-800">From (optional)</span><input type="date" value={from} max={to||iso(today)} onChange={e=>{setFrom(e.target.value);setError("");}} className={inputCls}/></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-brand-800">To (optional)</span><input type="date" value={to} min={from||undefined} max={iso(today)} onChange={e=>{setTo(e.target.value);setError("");}} className={inputCls}/></label>
      </div>
      {error && <p className="animate-shake pt-3 text-sm font-medium text-bad" role="alert">{error}</p>}
      <div className="mt-6 flex justify-end gap-3"><Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button><Button loading={busy} icon={<Download className="size-[18px]"/>} onClick={download}>Download PDF</Button></div>
    </Modal>
  </>;
}
