/** User hooks mapped to wallet-system-v1's real FastAPI API. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AdminAccount, AdminSettings, Limits, Rules, DailyFlow, DailySummaryRow, Dashboard, Page, Reconciliation, ReceiverLookup, StatementLine, Transaction, TransferPreview, TrialBalance, TxStatus, TxType, Wallet } from "../types/api";
interface BackendWallet { id:number; wallet_number:string; balance:string; reserved_balance:string; available_balance:string; status:"active"|"frozen"; created_at:string }
interface BackendHistoryLine { transaction_id:number; reference:string; transaction_type:string; status:string; created_at:string; amount:string; debit:string; credit:string; running_balance:string; description:string|null; sender_name?:string|null; receiver_name?:string|null; sender_wallet_number?:string|null; receiver_wallet_number?:string|null; reversal_of_transaction_id?:number|null; reversal_reason?:string|null; transfer_fee?:string|null }
interface BackendPage<T> { items:T[]; page:number; page_size:number; total:number }
interface BackendDeposit { transaction_reference:string; amount:string; wallet_number:string; new_balance:string; status:string }
interface BackendWithdrawal { id:number; reference:string; wallet_number:string; amount:string; status:string; balance:string; reserved_balance:string; available_balance:string; created_at:string; rejection_reason?:string|null }
interface BackendTransfer { reference:string; sender_wallet_number:string; receiver_wallet_number:string; amount:string; fee:string; total_debit:string; note?:string|null; status:string; ledger_transaction_reference:string; sender_balance:string; receiver_balance:string; created_at:string }
const txType=(v:string):TxType=>v.toUpperCase() as TxType;
const txStatus=(v:string):TxStatus=>v.toLowerCase()==="pending"?"PENDING":v.toLowerCase()==="rejected"?"REJECTED":"COMPLETED";
const normalizeWallet=(w:BackendWallet):Wallet=>({id:String(w.id),account_number:w.wallet_number,name:"Wallet holder",type:"WALLET",status:w.status.toUpperCase() as Wallet["status"],balance:String(w.balance),reserved_balance:String(w.reserved_balance),available_balance:String(w.available_balance),created_at:w.created_at});
const normalizeHistoryLine=(l:BackendHistoryLine,index:number):StatementLine=>{
 const raw=l.transaction_type.toLowerCase();
 const description=raw==="transfer"?(Number(l.debit)>0?(l.receiver_name?`Transfer to ${l.receiver_name}`:"Transfer sent"):(l.sender_name?`Transfer from ${l.sender_name}`:"Transfer received")):raw==="deposit"?"Deposit (cash in)":raw==="withdrawal"?"Withdrawal (cash out)":raw==="fee"?"Transfer fee":raw==="reversal"||raw==="adjustment"?"Reversal":raw.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
 return {entry_id:l.transaction_id * 1000 + index,created_at:l.created_at,type:txType(l.transaction_type),reference:l.reference,description,counterparty:l.receiver_name||l.sender_name||null,amount:String(l.amount),debit:Number(l.debit)>0?String(l.debit):null,credit:Number(l.credit)>0?String(l.credit):null,balance:String(l.running_balance),transaction_id:String(l.transaction_id),fee:(raw==="transfer"&&Number(l.debit)>Number(l.amount)?(Number(l.debit)-Number(l.amount)).toFixed(2):null),note:raw==="transfer"&&l.description&&!l.description.startsWith("Transfer from ")?l.description:null,reason:l.reversal_reason||null};
};
const normalizeTransaction=(t:BackendDeposit|BackendWithdrawal|BackendTransfer):Transaction=>{
 const a=t as unknown as Record<string,unknown>; const reference=String(a.reference??a.transaction_reference??""); const amount=String(a.amount??"0.00"); const status=txStatus(String(a.status??"completed")); const transfer="sender_wallet_number" in a; const withdrawal="wallet_number" in a && "id" in a && "available_balance" in a;
 return {id:String(a.id??reference),reference,type:transfer?"TRANSFER":withdrawal?"WITHDRAWAL":"DEPOSIT",status,amount,fee:String(a.fee??"0.00"),note:(a.note as string|null|undefined)??null,decision_note:(a.rejection_reason as string|null|undefined)??null,from_account:transfer?{account_number:String(a.sender_wallet_number),name:"You"}:null,to_account:transfer?{account_number:String(a.receiver_wallet_number),name:"Recipient"}:null,reversal_of:null,reversed_by:null,created_at:String(a.created_at??new Date().toISOString()),completed_at:null};
};
export const useWallet=()=>useQuery({queryKey:["wallet"],queryFn:async()=>normalizeWallet(await api<BackendWallet>("/wallets/me")),refetchOnWindowFocus:true});
export interface StatementFilters { date_from?:string; date_to?:string; type?:TxType|""; page:number; page_size?:number }
export const useStatement=(f:StatementFilters)=>useQuery({
  queryKey:["statement",f],
  queryFn:async()=>{
    const d=await api<BackendPage<BackendHistoryLine>>("/transactions/history",{query:{
      page:f.page,page_size:f.page_size??15,
      start_date:f.date_from,end_date:f.date_to,
      transaction_type:f.type?f.type.toLowerCase():undefined}});
      return {items:d.items.map(normalizeHistoryLine),
      page:d.page,page_size:d.page_size,total:d.total} as Page<StatementLine>},
      placeholderData:keepPreviousData});
export const useMyTransactions=(status?:TxStatus)=>useQuery({queryKey:["my-transactions",status],queryFn:async()=>{const rows=await api<BackendWithdrawal[]>("/withdrawals/me");const items=rows.map(normalizeTransaction).filter(t=>!status||t.status===status);return {items,total:items.length,page:1,page_size:items.length} as Page<Transaction>},refetchOnWindowFocus:true});
export const useActivity=(days=7)=>useQuery({queryKey:["activity",days],queryFn:async()=>{const start=new Date();start.setUTCDate(start.getUTCDate()-(days-1));start.setUTCHours(0,0,0,0);const d=await api<BackendPage<BackendHistoryLine>>("/transactions/history",{query:{page:1,page_size:100,start_date:start.toISOString()}});const m=new Map<string,{day:string;money_in:number;money_out:number}>();for(let i=0;i<days;i++){const day=new Date(start);day.setUTCDate(start.getUTCDate()+i);const key=day.toISOString().slice(0,10);m.set(key,{day:key,money_in:0,money_out:0})}for(const line of d.items){const row=m.get(line.created_at.slice(0,10));if(row){row.money_in+=Number(line.credit||0);row.money_out+=Number(line.debit||0)}}return [...m.values()].map(r=>({day:r.day,money_in:r.money_in.toFixed(2),money_out:r.money_out.toFixed(2)})) as DailyFlow[]}});
export const useReceiver=(accountNumber:string,enabled:boolean)=>useQuery({queryKey:["receiver",accountNumber],queryFn:async()=>{const r=await api<{receiver_wallet_number:string;receiver_name:string;wallet_status:string;can_receive:boolean}>(`/transfers/recipient/${encodeURIComponent(accountNumber)}`);return {account_number:r.receiver_wallet_number,name:r.receiver_name,status:r.wallet_status.toUpperCase() as ReceiverLookup["status"],can_receive:r.can_receive}},enabled,retry:false,staleTime:15000});
function useRefreshMoney(){const qc=useQueryClient();return ()=>{for(const key of ["wallet","statement","my-transactions","activity","limits","admin"])qc.invalidateQueries({queryKey:[key]})}}
interface MoneyInput {amount:string;note?:string;key:string}
export function useDeposit(){const refresh=useRefreshMoney();return useMutation({mutationFn:async({key,amount}:MoneyInput)=>normalizeTransaction(await api<BackendDeposit>("/deposits/",{method:"POST",body:{amount},idempotencyKey:key})),onSuccess:refresh})}
export function useWithdraw(){const refresh=useRefreshMoney();return useMutation({mutationFn:async({key,amount}:MoneyInput)=>normalizeTransaction(await api<BackendWithdrawal>("/withdrawals/",{method:"POST",body:{amount},idempotencyKey:key})),onSuccess:refresh})}
export const usePreviewTransfer=()=>useMutation({mutationFn:async(body:{to_account_number:string;amount:string})=>{
 const r=await api<{receiver_wallet_number:string;receiver_name:string;wallet_status:string;can_receive:boolean}>(`/transfers/recipient/${encodeURIComponent(body.to_account_number)}`);
 const wallet=await api<BackendWallet>("/wallets/me");
 const now=new Date();now.setUTCHours(0,0,0,0);const today=now.toISOString();
 let page=1;let totalRows=0;let used=0;do{const hist=await api<BackendPage<BackendHistoryLine>>("/transactions/history",{query:{page,page_size:100,start_date:today,transaction_type:"transfer"}});used+=hist.items.reduce((sum,x)=>sum+(Number(x.debit)>0?Number(x.amount||0):0),0);totalRows=hist.total;page++;}while((page-1)*100<totalRows&&page<10000);
 const amount=Math.round(Number(body.amount)*100)/100;const rawFee=Math.round(amount*0.5)/100;const fee=Math.max(0,rawFee);
 const totalDebit=Math.round((amount+fee)*100)/100;const dailyLimit=100000;
 return {receiver_name:r.receiver_name,receiver_account_number:r.receiver_wallet_number,amount:amount.toFixed(2),fee:fee.toFixed(2),total_debit:totalDebit.toFixed(2),balance_after:(Number(wallet.available_balance)-totalDebit).toFixed(2),daily_remaining:Math.max(0,dailyLimit-used-amount).toFixed(2),wallet_status:r.wallet_status.toUpperCase() as Wallet["status"],can_receive:r.can_receive} as TransferPreview;
 }});
export function useTransfer(){const refresh=useRefreshMoney();return useMutation({mutationFn:async({key,to_account_number,amount,note}:{to_account_number:string;amount:string;note?:string;key:string})=>normalizeTransaction(await api<BackendTransfer>("/transfers/",{method:"POST",body:{receiver_wallet_number:to_account_number,amount,note},idempotencyKey:key})),onSuccess:refresh})}

/* ------------------------------------------------------------------- admin: routes match wallet-system-v1 */
interface BackendUserWallet { wallet_id:number; wallet_number:string; balance:string; reserved_balance:string; available_balance:string; status:string; created_at:string }
interface BackendAdminUser { user_id:number; full_name:string; email:string; role:string; is_active:boolean; user_created_at:string; wallet:BackendUserWallet|null }
interface BackendAdminPage<T> { items:T[]; page:number; page_size:number; total:number }
interface BackendWithdrawal { id:number; reference:string; wallet_number:string; amount:string; status:string; balance:string; reserved_balance:string; available_balance:string; created_at:string; rejection_reason?:string|null; user_id?:number }
const mapAdminUser=(u:BackendAdminUser):AdminAccount=>({id:String(u.wallet?.wallet_id??u.user_id),account_number:u.wallet?.wallet_number??"No wallet",name:u.full_name,email:u.email,role:u.role.toUpperCase() as AdminAccount["role"],status:(u.wallet?.status??(u.is_active?"active":"frozen")).toUpperCase() as AdminAccount["status"],balance:u.wallet?.balance??"0.00",reserved_balance:u.wallet?.reserved_balance??"0.00",available_balance:u.wallet?.available_balance??"0.00",created_at:u.wallet?.created_at??u.user_created_at,type:"WALLET"});
const mapAdminWithdrawal=(w:BackendWithdrawal):Transaction=>({id:String(w.id),reference:w.reference,type:"WITHDRAWAL",status:txStatus(w.status),amount:w.amount,fee:"0.00",note:null,decision_note:w.rejection_reason??null,from_account:{account_number:w.wallet_number,name:`Wallet ${w.wallet_number}`},to_account:null,reversal_of:null,reversed_by:null,created_at:w.created_at,completed_at:null});
export const useAdminDashboard=(enabled=true)=>useQuery({queryKey:["admin","overview"],queryFn:async()=>{const [o,t,summary]=await Promise.all([api<any>("/admin/reports/overview"),api<any>("/admin/reports/trial-balance"),api<any>("/admin/reports/daily-summary")]);const fee=t.accounts?.find((a:any)=>String(a.account_name??a.name).toLowerCase().includes("fee"));const today=new Date().toISOString().slice(0,10);const todayTx=await api<any>("/transactions/admin/all",{query:{page:1,page_size:100,start_date:`${today}T00:00:00Z`,end_date:`${today}T23:59:59Z`}});let todayItems:any[]=[...(todayTx.items??[])];for(let page=2;page<=Math.ceil(Number(todayTx.total??0)/100);page++){const next=await api<any>("/transactions/admin/all",{query:{page,page_size:100,start_date:`${today}T00:00:00Z`,end_date:`${today}T23:59:59Z`}});todayItems.push(...(next.items??[]));}const feesToday=todayItems.reduce((sum,x)=>sum+Number(x.transfer_fee??0),0);const rows=summary.items??[];const totals:any={deposit:{count:0,volume:0},withdrawal:{count:0,volume:0},transfer:{count:0,volume:0},reversal:{count:0,volume:0},fee:{count:0,volume:0}};const todayTotals:any={deposit:{count:0,volume:0},withdrawal:{count:0,volume:0},transfer:{count:0,volume:0},reversal:{count:0,volume:0},fee:{count:0,volume:0}};for(const r of rows){let key=String(r.transaction_type).toLowerCase();if(key==="adjustment")key="reversal";if(!totals[key])continue;const count=Number(r.transaction_count??0),volume=Number(r.ledger_debit_volume??0);totals[key].count+=count;totals[key].volume+=volume;if(String(r.date).slice(0,10)===today){todayTotals[key].count+=count;todayTotals[key].volume+=volume;}}const pack=(x:any)=>({count:x.count,volume:x.volume.toFixed(2)});const todayCount=todayTotals.deposit.count+todayTotals.withdrawal.count+todayTotals.transfer.count+todayTotals.reversal.count;const todayVolume=todayTotals.deposit.volume+todayTotals.withdrawal.volume+todayTotals.transfer.volume+todayTotals.reversal.volume;const totalCashIn=totals.deposit.volume;const totalCashOut=totals.withdrawal.volume;return {total_money_in_system:(totalCashIn-totalCashOut).toFixed(2),fee_revenue_balance:String(fee?.normal_balance_amount??"0.00"),pending_withdrawals:{count:o.pending_withdrawals.count,volume:String(o.pending_withdrawals.amount)},active_accounts:o.wallets.active,frozen_accounts:o.wallets.frozen,ledger_balanced:t.balanced,ledger_net:String(t.difference),reconciliation_mismatches:0,total_cash_in:totals.deposit.volume.toFixed(2),total_cash_out:totals.withdrawal.volume.toFixed(2),today:{count:todayCount,volume:todayVolume.toFixed(2)},deposits:pack(todayTotals.deposit),withdrawals:pack(todayTotals.withdrawal),transfers:pack(todayTotals.transfer),reversals:pack(todayTotals.reversal),fees_collected:feesToday.toFixed(2)} as Dashboard},refetchInterval:30000,enabled});
export const useAdminAccounts=(p:{search:string;status:string;page:number})=>useQuery({queryKey:["admin","accounts",p],queryFn:async()=>{const d=await api<BackendAdminPage<BackendAdminUser>>("/admin/users",{query:{search:p.search||undefined,wallet_status:p.status?p.status.toLowerCase():undefined,page:p.page,page_size:12}});return {...d,items:d.items.map(mapAdminUser)} as Page<AdminAccount>},placeholderData:keepPreviousData});
export function useSetFrozen(){const qc=useQueryClient();return useMutation({mutationFn:({id,freeze}:{id:string;freeze:boolean;reason?:string})=>api<any>(`/admin/wallets/${id}/${freeze?"freeze":"unfreeze"}`,{method:"POST"}),onSuccess:()=>{qc.invalidateQueries({queryKey:["admin"]});qc.invalidateQueries({queryKey:["wallet"]})}})}
export const useAdminWithdrawals=()=>useQuery({queryKey:["admin","withdrawals"],queryFn:async()=>{const rows=await api<BackendWithdrawal[]>("/withdrawals/admin/pending");const items=rows.map(mapAdminWithdrawal);return {items,total:items.length,page:1,page_size:items.length} as Page<Transaction>},refetchInterval:20000});
export function useDecideWithdrawal(){const qc=useQueryClient();return useMutation({mutationFn:({id,action,reason}:{id:string;action:"approve"|"reject";reason?:string})=>api<any>(`/withdrawals/admin/${id}/${action}`,{method:"POST",...(action==="reject"?{body:{reason:reason||"Rejected by administrator"}}:{})}),onSuccess:()=>{qc.invalidateQueries({queryKey:["admin"]});qc.invalidateQueries({queryKey:["wallet"]})}})}
export interface AdminTxFilters {type?:TxType|"";status?:TxStatus|"";search?:string;date_from?:string;date_to?:string;page:number}
export const useAdminTransactions = (f: AdminTxFilters) => useQuery({
  queryKey: ["admin", "transactions", f],
  queryFn: async () => {
    const d = await api<any>("/transactions/admin/all", { query: {
      page: f.page, page_size: 15, search: f.search || undefined,
      transaction_type: f.type ? (f.type === "REVERSAL" ? "adjustment" : f.type.toLowerCase()) : undefined,
      status: f.status ? ({ COMPLETED: "posted", PENDING: "draft", REJECTED: "reversed" } as Record<string, string>)[f.status] : undefined,
      start_date: f.date_from, end_date: f.date_to,
    }});
    const referenceById = new Map<number, string>(
  d.items.map((x: any) => [Number(x.transaction_id), String(x.reference)])
);

const reversalIds = [
  ...new Set<number>(
    d.items
      .map((x: any) => Number(x.reversal_of_transaction_id))
      .filter((id: number) => Number.isFinite(id) && id > 0)
  ),
];

    if (reversalIds.some((id) => !referenceById.has(id))) {
      let lookupPage = 1;
      let lookupTotal = Number(d.total ?? 0);

      while (
        lookupPage <= Math.ceil(lookupTotal / 100) &&
        reversalIds.some((id) => !referenceById.has(id))
      ) {
        const result = await api<any>("/transactions/admin/all", {
          query: { page: lookupPage, page_size: 100 },
        });

        for (const row of result.items ?? []) {
          referenceById.set(Number(row.transaction_id), String(row.reference));
        }

        lookupTotal = Number(result.total ?? lookupTotal);
        lookupPage++;
      }
    }
    const items: Transaction[] = d.items.map((x: any) => {
      const rawType=String(x.transaction_type||"adjustment").toLowerCase();
      const type=(rawType==="adjustment"||rawType==="reversal"?"REVERSAL":rawType.toUpperCase()) as TxType;
      const participants=Array.isArray(x.participants)?x.participants:[];
      const participantAccount=(p:any)=>p?{account_number:String(p.wallet_number??""),name:String(p.full_name??p.email??"Wallet owner")}:null;
      const walletParticipant=participants[0]??null;
      let fromAccount=participantAccount(x.sender),toAccount=participantAccount(x.receiver);
      if(type==="DEPOSIT"){fromAccount=null;toAccount=participantAccount(walletParticipant);}
      else if(type==="WITHDRAWAL"){fromAccount=participantAccount(walletParticipant);toAccount=null;}
      else if(type==="REVERSAL"&&!fromAccount&&!toAccount){fromAccount=participantAccount(participants[0]);toAccount=participantAccount(participants[1]);}
      // Deposit/withdrawal amounts are not included in this backend's admin-list response.
      // Keep those as an em dash instead of falsely presenting them as zero.
      const rawAmount=x.transfer_amount;
      return {id:String(x.transaction_id),reference:String(x.reference),is_reversed:Boolean(x.is_reversed),type,
        status:(x.status==="reversed"?"REJECTED":x.status==="draft"?"PENDING":"COMPLETED") as TxStatus,
        amount:rawAmount==null?"":String(rawAmount),fee:String(x.transfer_fee??"0.00"),note:x.description??null,decision_note:x.reversal_reason??null,
        from_account:fromAccount,to_account:toAccount,reversal_of:x.reversal_of_transaction_id?referenceById.get(Number(x.reversal_of_transaction_id))??null:null,
        reversed_by:null,created_at:x.posted_at??x.created_at,completed_at:x.posted_at??null};
    });
    return { ...d, items } as Page<Transaction>;
  },
  placeholderData: keepPreviousData,
});

export function useReverse() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<any>(`/admin/transactions/${id}/reverse`, {
        method: "POST",
        body: { reason: reason || "Reversed by administrator" },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}
// export function useReverse(){const qc=useQueryClient();return useMutation({mutationFn:({id,reason}:{id:string;reason:string})=>api<any>(`/transactions/${id}/reverse`,{method:"POST",body:{reason}}),onSuccess:()=>qc.invalidateQueries({queryKey:["admin"]})})}
export const useDailySummary=(days=14)=>useQuery({queryKey:["admin","daily-summary",days],queryFn:async()=>{const end=new Date();const start=new Date();start.setDate(start.getDate()-(days-1));const d=await api<any>("/admin/reports/daily-summary",{query:{start_date:start.toISOString().slice(0,10),end_date:end.toISOString().slice(0,10)}});const map=new Map<string,any>();for(const x of d.items){if(!map.has(x.date))map.set(x.date,{day:x.date,deposits:{count:0,volume:"0.00"},withdrawals:{count:0,volume:"0.00"},transfers:{count:0,volume:"0.00"},reversals:{count:0,volume:"0.00"},fees:"0.00",total_count:0,total_volume:0});const r=map.get(x.date);const key=x.transaction_type==="deposit"?"deposits":x.transaction_type==="withdrawal"?"withdrawals":x.transaction_type==="transfer"?"transfers":(x.transaction_type==="reversal"||x.transaction_type==="adjustment")?"reversals":null;if(key){r[key]={count:x.transaction_count,volume:String(x.ledger_debit_volume)};}r.total_count+=x.transaction_count;r.total_volume+=Number(x.ledger_debit_volume);if(x.transaction_type==="fee")r.fees=String(x.ledger_debit_volume)}return [...map.values()].sort((a,b)=>b.day.localeCompare(a.day)) as DailySummaryRow[]}});
export const useTrialBalance=()=>useQuery({queryKey:["admin","trial-balance"],queryFn:async()=>{
 const d=await api<any>("/admin/reports/trial-balance");
 const first=await api<any>("/admin/users",{query:{page:1,page_size:100}});const users=[...(first.items??[])];
 for(let page=2;page<=Math.ceil(Number(first.total??0)/Math.max(1,Number(first.page_size??100)));page++){const next=await api<any>("/admin/users",{query:{page,page_size:100}});users.push(...(next.items??[]));}
 const ownerByWallet=new Map<string,string>();for(const u of users){if(u.wallet?.wallet_number)ownerByWallet.set(String(u.wallet.wallet_number).trim().toUpperCase(),String(u.full_name||u.email||u.wallet.wallet_number));}
 return {generated_at:new Date().toISOString(),rows:d.accounts.map((a:any)=>{const owner=ownerByWallet.get(String(a.account_code).trim().toUpperCase());return {account_id:String(a.account_id),account_number:a.account_code,name:owner??(String(a.account_name).startsWith("Wallet ")?String(a.account_name).slice(7):a.account_name),type:owner?"WALLET":"SYSTEM",total_debits:String(a.total_debits),total_credits:String(a.total_credits),ledger_balance:String(a.normal_balance_amount)}}),total_debits:String(d.total_debits),total_credits:String(d.total_credits),balanced:d.balanced} as TrialBalance
}});
export const useReconciliation=()=>useQuery({queryKey:["admin","reconciliation"],queryFn:async()=>{const [first,usersPage]=await Promise.all([api<any>("/admin/reports/reconciliation",{query:{page:1,page_size:500,only_mismatches:"false"}}),api<any>("/admin/users",{query:{page:1,page_size:100}})]);const items=[...(first.items??[])];for(let page=2;page<=Math.ceil(Number(first.total_wallets_in_result??0)/500);page++){const next=await api<any>("/admin/reports/reconciliation",{query:{page,page_size:500,only_mismatches:"false"}});items.push(...(next.items??[]));}const users=[...(usersPage.items??[])];for(let page=2;page<=Math.ceil(Number(usersPage.total??0)/Math.max(1,Number(usersPage.page_size??100)));page++){const next=await api<any>("/admin/users",{query:{page,page_size:100}});users.push(...(next.items??[]));}const ownerByWallet=new Map<string,string>();for(const u of users){if(u.wallet?.wallet_number)ownerByWallet.set(String(u.wallet.wallet_number).trim().toUpperCase(),String(u.full_name||u.email||u.wallet.wallet_number));}return {generated_at:new Date().toISOString(),checked_accounts:first.total_wallets_in_result??items.length,mismatch_count:items.filter((r:any)=>!r.matches).length,ok:items.every((r:any)=>r.matches),rows:items.map((r:any)=>({account_id:String(r.wallet_id),account_number:r.wallet_number,name:ownerByWallet.get(String(r.wallet_number))??r.wallet_number,status:r.status.toUpperCase(),cached_balance:String(r.cached_balance),ledger_balance:String(r.ledger_balance),difference:String(r.difference),matches:r.matches}))} as Reconciliation}});
// The backend currently has no notification or runtime-settings endpoints. Keep these disabled
// rather than repeatedly calling routes that do not exist.
export const useUnreadCount=(_enabled:boolean)=>useQuery({queryKey:["notifications","unread"],queryFn:async()=>({unread:0}),enabled:false});
export const useNotifications=(_enabled:boolean)=>useQuery({queryKey:["notifications"],queryFn:async()=>({items:[],total:0,page:1,page_size:20}),enabled:false});
export function useMarkRead(){return useMutation({mutationFn:async(_id:string)=>undefined})}
export function useMarkAllRead(){return useMutation({mutationFn:async()=>undefined})}
export const useLimits=()=>useQuery({queryKey:["limits"],queryFn:async()=>{
 const now=new Date();now.setUTCHours(0,0,0,0);let page=1;let total=0;let used=0;do{const history=await api<BackendPage<BackendHistoryLine>>("/transactions/history",{query:{page,page_size:100,start_date:now.toISOString(),transaction_type:"transfer"}});used+=history.items.reduce((sum,x)=>sum+(Number(x.debit)>0?Number(x.amount||0):0),0);total=history.total;page++;}while((page-1)*100<total&&page<10000);const limit=100000;
 return {currency:"BDT",withdrawal_approval_limit:"100000.00",daily_transfer_limit:limit.toFixed(2),max_transaction_amount:"100000.00",transfer_fee_percent:"0.5",transfer_fee_min:"0.00",transfer_fee_max:"100000.00",daily_used:used.toFixed(2),daily_remaining:Math.max(0,limit-used).toFixed(2)} as Limits;
},refetchInterval:30000});
export const useAdminSettings=()=>useQuery({queryKey:["admin","settings"],queryFn:async()=>({rules:{withdrawal_approval_limit:"100000.00",daily_transfer_limit:"100000.00",max_transaction_amount:"100000.00",transfer_fee_percent:"0.5",transfer_fee_min:"0.00",transfer_fee_max:"100000.00"},defaults:{withdrawal_approval_limit:"100000.00",daily_transfer_limit:"100000.00",max_transaction_amount:"100000.00",transfer_fee_percent:"0.5",transfer_fee_min:"0.00",transfer_fee_max:"100000.00"},updated_at:null,updated_by:null} as AdminSettings)});
export function useUpdateSettings(){return useMutation({mutationFn:async(_body:Partial<Rules>&{reason?:string})=>{throw new Error("Changing limits is not implemented by the backend yet. This admin feature is in progress.")}})}
