import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field, Input, SubmitButton } from "@/components/action-form";
import { requestPasswordReset } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we will send you a link to choose a new password."
      footer={<Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link>}
    >
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <Field label="Email" name="email"><Input name="email" type="email" autoComplete="email" required /></Field>
        <SubmitButton pendingLabel="Sending...">Send reset link</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
