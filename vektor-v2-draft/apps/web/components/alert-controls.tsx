"use client";
import { useState } from "react";
import { ActionButton, ActionForm, Input, SubmitButton } from "@/components/action-form";
import { buttonClass } from "@/components/ui";
import { acknowledgeAlert, resolveAlert } from "@/app/(app)/alerts/actions";

export function AlertRowActions({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = useState(false);
  if (status === "resolved") return <span className="text-xs text-muted">Closed</span>;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === "open" && <ActionButton action={() => acknowledgeAlert(id)}>Acknowledge</ActionButton>}
        <button type="button" onClick={() => setOpen((o) => !o)} className={buttonClass("secondary", "sm")} aria-expanded={open}>Resolve</button>
      </div>
      {open && (
        <ActionForm action={resolveAlert} className="flex w-72 gap-2">
          <input type="hidden" name="id" value={id} />
          <Input name="notes" placeholder="Resolution notes (optional)" maxLength={1000} />
          <SubmitButton pendingLabel="...">Save</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
