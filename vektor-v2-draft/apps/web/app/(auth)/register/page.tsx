import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field, Input, SubmitButton } from "@/components/action-form";
import { signUp } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start a 14-day trial. You will create your company workspace next."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></>}
    >
      <ActionForm action={signUp} className="space-y-4">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <Field label="Full name" name="full_name"><Input name="full_name" autoComplete="name" required /></Field>
        <Field label="Work email" name="email"><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" name="password" help="At least 8 characters."><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
        <Field label="Confirm password" name="confirm"><Input name="confirm" type="password" autoComplete="new-password" required /></Field>
        <SubmitButton pendingLabel="Creating account...">Create account</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
