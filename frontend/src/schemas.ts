/**
 * FILE: src/schemas.ts
 * PURPOSE: Zod validation rules used by React Hook Form. They mirror the backend rules
 *          (2 decimals max, > 0, password policy) so users get instant feedback; the
 *          server still re-validates everything - the browser is never trusted.
 * WHERE USED: Login/Register/Deposit/Withdraw/Transfer/Admin forms.
 */
import { z } from "zod";

export const amountSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Use numbers only, with up to 2 decimals")
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

export const noteSchema = z.string().trim().max(255, "Keep the note under 255 characters").optional();

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("That email looks wrong"),
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100, "Name must be 100 characters or fewer"),
  email: z.string().trim().email("That email looks wrong"),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .regex(/[A-Za-z]/, "Add at least one letter")
    .regex(/\d/, "Add at least one number"),
});

export const accountNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^WAL-\d{4,12}$/, "Account numbers look like WAL-100001");

export const moneyFormSchema = z.object({ amount: amountSchema, note: noteSchema });
export const transferFormSchema = z.object({ to_account_number: accountNumberSchema, amount: amountSchema, note: noteSchema });
export const reasonSchema = z.object({ reason: z.string().trim().min(3, "Give a short reason (3+ characters)").max(255) });

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type MoneyForm = z.infer<typeof moneyFormSchema>;
export type TransferForm = z.infer<typeof transferFormSchema>;
export type ReasonForm = z.infer<typeof reasonSchema>;

const limitField = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Use numbers with up to 2 decimals").refine((v) => Number(v) > 0, "Must be greater than zero");
const feeField = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Use numbers with up to 2 decimals");
const percentField = z.string().trim().regex(/^\d{1,3}(\.\d{1,3})?$/, "Use up to 3 decimals").refine((v) => Number(v) <= 100, "Cannot be more than 100");

/** Admin settings form. The cross-field checks mirror the server so mistakes show up instantly. */
export const rulesFormSchema = z
  .object({
    withdrawal_approval_limit: limitField,
    daily_transfer_limit: limitField,
    max_transaction_amount: limitField,
    transfer_fee_percent: percentField,
    transfer_fee_min: feeField,
    transfer_fee_max: feeField,
    reason: z.string().trim().max(255).optional(),
  })
  .superRefine((v, ctx) => {
    if (Number(v.transfer_fee_min) > Number(v.transfer_fee_max))
      ctx.addIssue({ code: "custom", path: ["transfer_fee_min"], message: "Cannot be higher than the maximum fee" });
    if (Number(v.withdrawal_approval_limit) > Number(v.max_transaction_amount))
      ctx.addIssue({ code: "custom", path: ["withdrawal_approval_limit"], message: "Cannot be higher than the maximum per transaction" });
  });
export type RulesForm = z.infer<typeof rulesFormSchema>;
