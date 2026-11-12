import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field, Input, SubmitButton } from "@/components/action-form";
import { createOrganization, signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create your fleet workspace" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { count } = await supabase.from("organization_memberships").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("status", "active");
  if ((count ?? 0) > 0) redirect("/overview");

  return (
    <AuthShell
      title="Create your fleet workspace"
      subtitle="Each company gets its own private workspace. You will be its owner."
      footer={<form action={signOut}><button className="text-sm text-muted hover:text-ink hover:underline">Sign out</button></form>}
    >
      <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand">
        Joining a colleague&apos;s company instead? Open the invitation link they sent you - you do not need to create a workspace.
      </p>
      <ActionForm action={createOrganization} resetOnSuccess={false} className="space-y-4">
        <Field label="Company name" name="name"><Input name="name" required autoComplete="organization" /></Field>
        <Field label="Company email" name="contact_email"><Input name="contact_email" type="email" defaultValue={user.email ?? ""} /></Field>
        <Field label="Phone" name="contact_phone"><Input name="contact_phone" type="tel" placeholder="+263 ..." /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country code" name="country"><Input name="country" defaultValue="ZW" maxLength={2} required /></Field>
          <Field label="Currency" name="currency"><Input name="currency" defaultValue="USD" maxLength={3} required /></Field>
        </div>
        <SubmitButton pendingLabel="Creating workspace...">Create workspace</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
