/**
 * FILE: src/pages/Deposit.tsx
 * PURPOSE: Deposit page: wraps <MoneyForm kind="deposit"> with a page header.
 * WHERE USED: route /deposit.
 */
import { MoneyForm } from "../components/wallet/MoneyForm";
import { PageHeader } from "../components/ui/Card";

export default function Deposit() {
  return (
    <>
      <PageHeader title="Deposit" subtitle="Add money to your wallet. It shows up instantly and is recorded in the ledger." />
      <MoneyForm kind="deposit" />
    </>
  );
}
