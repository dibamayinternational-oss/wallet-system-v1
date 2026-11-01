/**
 * FILE: src/pages/Withdraw.tsx
 * PURPOSE: Withdrawal page: wraps <MoneyForm kind="withdraw">. Large amounts become PENDING
 *          (admin approval) - the form warns about it before you submit.
 * WHERE USED: route /withdraw.
 */
import { MoneyForm } from "../components/wallet/MoneyForm";
import { PageHeader } from "../components/ui/Card";

export default function Withdraw() {
  return (
    <>
      <PageHeader title="Withdraw" subtitle="Take money out of your wallet. Regular withdrawals complete immediately." />
      <MoneyForm kind="withdraw" />
    </>
  );
}
