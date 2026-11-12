import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field, Input, SubmitButton } from "@/components/action-form";
import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");
  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters.">
      <ActionForm action={updatePassword} className="space-y-4">
        <Field label="New password" name="password"><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
        <Field label="Confirm password" name="confirm"><Input name="confirm" type="password" autoComplete="new-password" required /></Field>
        <SubmitButton>Update password</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
