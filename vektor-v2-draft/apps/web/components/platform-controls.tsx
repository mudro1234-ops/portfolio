"use client";
import { ActionButton, ActionForm, Input, Select, SubmitButton } from "@/components/action-form";
import { setOrgStatus, setSubscription } from "@/app/platform/actions";

export function OrgStatusButton({ id, status }: { id: string; status: string }) {
  return status === "active"
    ? <ActionButton variant="danger" action={() => setOrgStatus(id, "suspended")} confirm="Suspend this organisation? Its users will lose access immediately.">Suspend</ActionButton>
    : <ActionButton action={() => setOrgStatus(id, "active")}>Reactivate</ActionButton>;
}

export function SubscriptionForm({ orgId, plan, status, plans }: { orgId: string; plan: string | null; status: string | null; plans: string[] }) {
  return (
    <ActionForm action={setSubscription} resetOnSuccess={false} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="org" value={orgId} />
      <div className="w-32"><Select name="plan" required defaultValue={plan ?? "trial"} options={["trial", ...plans].map((p) => ({ value: p, label: p }))} /></div>
      <div className="w-32"><Select name="status" required defaultValue={status ?? "trialing"} options={["trialing", "active", "past_due", "cancelled"].map((p) => ({ value: p, label: p }))} /></div>
      <div className="w-24"><Input name="vehicle_limit" type="number" min={0} placeholder="Vehicles" aria-label="Vehicle limit" /></div>
      <div className="w-24"><Input name="user_limit" type="number" min={0} placeholder="Users" aria-label="User limit" /></div>
      <SubmitButton pendingLabel="...">Apply</SubmitButton>
    </ActionForm>
  );
}
