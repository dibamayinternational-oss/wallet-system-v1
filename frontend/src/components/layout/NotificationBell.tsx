import { Bell, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStatement } from "../../hooks/queries";
import { TYPE_LABEL, formatDateTime } from "../../lib/format";

/** The backend has no notifications API yet, so show recent transaction activity here. */
export function NotificationBell() {
  const [open,setOpen]=useState(false);
  const q=useStatement({page:1,page_size:8});
  return <div className="relative">
    <button type="button" onClick={()=>setOpen(v=>!v)} aria-label="Recent activity" aria-expanded={open} className="relative grid size-10 place-items-center rounded-xl border border-gray-300 bg-white text-black hover:bg-gray-50"><Bell className="size-5"/></button>
    {open&&<div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-300 bg-white text-black shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3"><h2 className="font-bold">Recent activity</h2><button onClick={()=>setOpen(false)} className="text-sm text-gray-500">Close</button></div>
      {q.isLoading&&<p className="p-4 text-sm text-gray-500">Loading activity…</p>}
      {q.isError&&<p className="p-4 text-sm text-red-700">{q.error instanceof Error?q.error.message:"Could not load activity."}</p>}
      {!q.isLoading&&!q.isError&&q.data?.items.length===0&&<p className="p-4 text-sm text-gray-600">No transactions yet.</p>}
      <ul>{q.data?.items.map(item=><li key={item.entry_id} className="border-b border-gray-100 last:border-0"><Link onClick={()=>setOpen(false)} to="/history" className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50"><span className="min-w-0 flex-1"><span className="block font-semibold">{TYPE_LABEL[item.type]??item.type}</span><span className="block text-xs text-gray-500">{formatDateTime(item.created_at)}</span><span className="block truncate font-mono text-xs text-gray-600">{item.reference}</span></span><ChevronRight className="mt-1 size-4 shrink-0"/></Link></li>)}</ul>
      <Link to="/history" onClick={()=>setOpen(false)} className="block border-t border-gray-200 px-4 py-3 text-sm font-bold underline">View all history</Link>
      <p className="px-4 pb-3 text-xs text-gray-500">Live notifications are not supported by the current backend; this menu shows recent transaction activity.</p>
    </div>}
  </div>;
}
