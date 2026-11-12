"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton } from "@/components/action-form";
import { buttonClass, inputClass } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { changeMemberRole, inviteMember, revokeInvitation, setMemberStatus, transferOwnership } from "@/app/(app)/team/actions";

export function InviteForm({ roles, defaultEmail, defaultRole }: { roles: Role[]; defaultEmail?: string; defaultRole?: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <ActionForm action={inviteMember} onSuccessData={(d) => setLink(String(d.link))} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Field label="Email address" name="email"><Input name="email" type="email" required defaultValue={defaultEmail} placeholder="name@company.com" /></Field>
        <Field label="Role" name="role"><Select name="role" required defaultValue={roles.includes(defaultRole as Role) ? defaultRole : roles[0]} options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} /></Field>
        <SubmitButton pendingLabel="Creating...">Create invitation</SubmitButton>
      </ActionForm>
      {link && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-900">Share this link with the invited person. It works once and expires in 7 days.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" className={`${inputClass} font-mono text-xs`} />
            <button type="button" className={buttonClass("secondary", "sm")} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}>
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemberActions({ userId, role, status, isSelf, assignable, canTransfer }: {
  userId: string; role: Role; status: string; isSelf: boolean; assignable: Role[]; canTransfer: boolean;
}) {
  if (isSelf || role === "owner") return <span className="text-xs text-muted">{isSelf ? "You" : "Owner"}</span>;
  const editable = assignable.length > 0 && (assignable.includes(role) || role === "driver");
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {editable && status === "active" && (
        <select aria-label="Change role" defaultValue={role} className={`${inputClass} !w-auto !py-1 text-xs`}
          onChange={async (e) => {
            const { toast } = await import("@/components/toast");
            const res = await changeMemberRole(userId, e.target.value);
            toast(res.message ?? "", res.ok ? "success" : "error");
            if (!res.ok) e.target.value = role;
          }}>
          {assignable.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      )}
      {editable && status === "active" && <ActionButton action={() => setMemberStatus(userId, "suspended")} confirm="Suspend this person's access?">Suspend</ActionButton>}
      {editable && status === "suspended" && <ActionButton action={() => setMemberStatus(userId, "active")}>Restore</ActionButton>}
      {editable && <ActionButton variant="danger" action={() => setMemberStatus(userId, "removed")} confirm="Remove this person from the organisation?">Remove</ActionButton>}
      {canTransfer && status === "active" && <ActionButton action={() => transferOwnership(userId)} confirm="Make this person the owner? You will become an administrator. This cannot be undone by you.">Make owner</ActionButton>}
    </div>
  );
}

export function RevokeInvitationButton({ id }: { id: string }) {
  return <ActionButton action={() => revokeInvitation(id)} confirm="Revoke this invitation?">Revoke</ActionButton>;
}
