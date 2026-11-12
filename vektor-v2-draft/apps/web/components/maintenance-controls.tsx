"use client";
import { ActionButton } from "@/components/action-form";
import { completeMaintenance, deleteMaintenance } from "@/app/(app)/maintenance/actions";

export function MaintenanceRowActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex justify-end gap-2">
      {(status === "scheduled" || status === "in_progress") && <ActionButton action={() => completeMaintenance(id)}>Mark done</ActionButton>}
      <ActionButton variant="danger" action={() => deleteMaintenance(id)} confirm="Delete this maintenance record?">Delete</ActionButton>
    </div>
  );
}
