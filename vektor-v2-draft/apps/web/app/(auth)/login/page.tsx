import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field, Input, SubmitButton } from "@/components/action-form";
import { Notice } from "@/components/ui";
import { signIn } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell
      title="Sign in to VEKTOR"
      subtitle="Welcome back. Enter your details to open your fleet workspace."
      footer={<>New to VEKTOR? <Link href="/register" className="font-medium text-brand hover:underline">Create an account</Link></>}
    >
      {sp.error === "link" && <div className="mb-4"><Notice tone="amber">That link has expired or was already used. Please sign in or request a new one.</Notice></div>}
      <ActionForm action={signIn} resetOnSuccess={false} className="space-y-4">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <Field label="Email" name="email"><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" name="password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
        <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-medium text-brand hover:underline">Forgot password?</Link></div>
        <SubmitButton pendingLabel="Signing in...">Sign in</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
