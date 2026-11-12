import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { acceptInvitationAction } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  return (
    <AuthShell title="Join your team on VEKTOR" subtitle={`You are signed in as ${user.email}. Accept the invitation to open the workspace.`}>
      <ActionForm action={acceptInvitationAction} resetOnSuccess={false}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton pendingLabel="Joining...">Accept invitation</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-xs text-muted">The invitation must have been sent to {user.email}. If it was sent to another address, sign out and sign in with that one.</p>
    </AuthShell>
  );
}
