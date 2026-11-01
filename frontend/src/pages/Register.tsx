/**
 * FILE: src/pages/Register.tsx
 * PURPOSE: Create an account. The backend creates the user AND their wallet (WAL-xxxxxx) in
 *          one step and signs them in. A live strength meter fills as the password improves.
 * WHERE USED: route /register.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { ApiError } from "../lib/api";
import { registerSchema, type RegisterForm } from "../schemas";
import { AuthLayout } from "./AuthLayout";

function strength(p: string): number {
  let s = 0;
  if (p.length >= 10) s++;
  if (p.length >= 14) s++;
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) s++;
  return s;
}

export default function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });
  const score = strength(watch("password") ?? "");

  const onSubmit = handleSubmit(async (v) => {
    setServerError("");
    try { await signUp(v.email, v.full_name, v.password); navigate("/", { replace: true }); }
    catch (e) { setServerError(e instanceof ApiError ? e.message : "Could not create your account."); }
  });

  return (
    <AuthLayout title="Create your wallet" subtitle="It takes a minute. You get a wallet number right away." footer={<>Already have one? <Link to="/login" className="font-semibold text-brand-800 underline-offset-4 hover:underline">Sign in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" autoComplete="name" error={errors.full_name?.message} {...register("full_name")} />
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <div>
          <Field label="Password" type="password" autoComplete="new-password" error={errors.password?.message} hint="10+ characters with a letter and a number" {...register("password")} />
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <motion.span key={i} className="h-1.5 flex-1 rounded-full" animate={{ backgroundColor: i < score ? (score < 3 ? "#d9a300" : "#2f7d5b") : "#e6edfd", scaleY: i < score ? 1.35 : 1 }} />
            ))}
          </div>
        </div>
        {serverError && <p key={serverError} className="animate-shake rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad" role="alert">{serverError}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={<UserPlus className="size-5" />}>Create wallet</Button>
      </form>
    </AuthLayout>
  );
}
