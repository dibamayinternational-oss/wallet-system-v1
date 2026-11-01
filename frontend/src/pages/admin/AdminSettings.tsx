import { Clock3 } from "lucide-react";
import { Card, PageHeader } from "../../components/ui/Card";

export default function AdminSettings() {
  return <>
    <PageHeader title="System limits & fees" subtitle="Runtime rule editing is not available in the current backend yet." />
    <Card className="max-w-3xl !rounded-md !border-black !shadow-none">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-1 size-6 shrink-0" />
        <div>
          <h2 className="text-xl font-bold">Working on this feature…</h2>
          {/* <p className="mt-2 text-sm leading-6">The current backend reads these values from environment configuration at startup. It does not expose an admin API to change them safely while running. This page is intentionally read-only instead of showing a Save button that cannot work.</p>
          <p className="mt-3 text-sm font-semibold">To change them today, update the backend environment settings and restart the API.</p> */}
          <div className="mt-5 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b-2 border-black"><th className="py-2 pr-5">Setting</th><th className="py-2">Fees</th></tr></thead><tbody>
            {[["WITHDRAWAL_APPROVAL_LIMIT","100000.00"],["TRANSFER_FEE_RATE","0.005 (0.5%)"],["TRANSFER_DAILY_LIMIT","100000.00"]].map(([k,v])=><tr key={k} className="border-b border-gray-300"><td className="py-3 pr-5 font-mono">{k}</td><td className="py-3 font-mono">{v}</td></tr>)}
          </tbody></table></div>
          {/* <p className="mt-4 flex items-start gap-2 text-xs text-gray-600"><AlertCircle className="size-4 shrink-0" />These are code defaults. If your backend .env overrides them, the active values may differ.</p> */}
        </div>
      </div>
    </Card>
  </>;
}
