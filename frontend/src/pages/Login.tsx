/**
 * FILE: src/pages/Login.tsx
 * PURPOSE: Sign-in form (email + password). Validates with Zod, shows server errors inline
 *          (wrong password, too many attempts), and returns you to the page you came from.
 * WHERE USED: route /login.   TAKES: user input.   GIVES: a signed-in session.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { ApiError } from "../lib/api";
import { loginSchema, type LoginForm } from "../schemas";
import { AuthLayout } from "./AuthLayout";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try { await login(values.email, values.password); navigate(from, { replace: true }); }
    catch (e) { setServerError(e instanceof ApiError ? e.message : "Sign in failed. Try again."); }
  });

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to see your wallet." footer={<>New here? <Link to="/register" className="font-semibold text-brand-800 underline-offset-4 hover:underline">Create a wallet</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" type="email" autoComplete="email" leading={<Mail className="size-4" />} error={errors.email?.message} {...register("email")} />
        <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        {serverError && <p key={serverError} className="animate-shake rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad" role="alert">{serverError}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={<LogIn className="size-5" />}>Sign in</Button>
      </form>
    </AuthLayout>
  );
}
