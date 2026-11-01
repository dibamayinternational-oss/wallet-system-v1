/**
 * FILE: src/types/api.ts
 * PURPOSE: TypeScript shapes of every API response (mirrors backend app/schemas).
 * NOTE: money is ALWAYS a string ("1250.50") - never a JS number - so no precision is lost.
 *       Only format it for display; never do arithmetic on floats for real decisions.
 */
export type Role = "USER" | "ADMIN";
export type AccountStatus = "ACTIVE" | "FROZEN";
export type TxType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "FEE" | "REVERSAL";
export type TxStatus = "PENDING" | "COMPLETED" | "REJECTED";

export interface User { id: string; email: string; full_name: string; role: Role; is_active: boolean; created_at: string }
export interface TokenResponse { access_token: string; token_type: "bearer" | string }
export interface Wallet { id: string; account_number: string; name: string; type: string; status: AccountStatus; balance: string; reserved_balance: string; available_balance: string; created_at: string }
export interface AccountRef { account_number: string; name: string; email: string | null }

export interface Transaction {
  id: string; reference: string; type: TxType; status: TxStatus; amount: string; fee: string;
  note: string | null; decision_note: string | null;
  from_account: AccountRef | null; to_account: AccountRef | null;
  reversal_of: string | null; reversed_by: string | null;
  created_at: string; completed_at: string | null;
  is_reversed?: boolean;
}
export interface StatementLine {
  entry_id: number; created_at: string; type: TxType; reference: string; description: string;
  counterparty: string | null; amount: string; debit: string | null; credit: string | null; balance: string; transaction_id: string; fee: string | null;  
  note: string | null; reason: string | null;
}
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface DailyFlow { day: string; money_in: string; money_out: string }

export interface AppConfig {
  currency: string; withdrawal_approval_limit: string; daily_transfer_limit: string;
  transfer_fee_percent: string; transfer_fee_min: string; transfer_fee_max: string; max_transaction_amount: string;
}
export interface ReceiverLookup { account_number: string; name: string; status: AccountStatus; can_receive?: boolean }
export interface TransferPreview { receiver_name: string; receiver_account_number: string; amount: string; fee: string; total_debit: string; balance_after: string; daily_remaining: string; wallet_status: AccountStatus; can_receive: boolean }

export interface AdminAccount extends Wallet { email: string | null; role: Role | null }
export interface CountVolume { count: number; volume: string }
export interface Dashboard {
  today: CountVolume; deposits: CountVolume; withdrawals: CountVolume; transfers: CountVolume; reversals: CountVolume;
  fees_collected: string; total_money_in_system: string; total_user_balances: string; fee_revenue_balance: string;
  total_cash_in: string; total_cash_out: string; pending_withdrawals: CountVolume; active_accounts: number; frozen_accounts: number;
  ledger_net: string; ledger_balanced: boolean; reconciliation_mismatches: number;
}
export interface DailySummaryRow {
  day: string; deposits: CountVolume; withdrawals: CountVolume; transfers: CountVolume; reversals: CountVolume;
  fees: string; total_count: number; total_volume: string;
}
export interface TrialBalanceRow { account_id: string; account_number: string; name: string; type: string; total_debits: string; total_credits: string; ledger_balance: string }
export interface TrialBalance { generated_at: string; rows: TrialBalanceRow[]; total_debits: string; total_credits: string; balanced: boolean }
export interface ReconciliationRow { account_id: string; account_number: string; name: string; status: AccountStatus; cached_balance: string; ledger_balance: string; difference: string; matches: boolean }
export interface Reconciliation { generated_at: string; checked_accounts: number; mismatch_count: number; ok: boolean; rows: ReconciliationRow[] }

export type NotificationKind =
  | "MONEY_RECEIVED" | "WITHDRAWAL_APPROVED" | "WITHDRAWAL_REJECTED"
  | "TRANSACTION_REVERSED" | "ACCOUNT_FROZEN" | "ACCOUNT_UNFROZEN";
export interface AppNotification {
  id: string; kind: NotificationKind; message: string; is_read: boolean; created_at: string;
  data: { amount?: string; reference?: string; counterparty?: string; note?: string | null; reason?: string | null; net?: string; original?: string; reversal?: string };
}

export interface Rules {
  withdrawal_approval_limit: string; daily_transfer_limit: string; max_transaction_amount: string;
  transfer_fee_percent: string; transfer_fee_min: string; transfer_fee_max: string;
}
export interface AdminSettings { rules: Rules; defaults: Rules; updated_at: string | null; updated_by: string | null }
export interface Limits extends Rules { currency: string; daily_used: string; daily_remaining: string }
