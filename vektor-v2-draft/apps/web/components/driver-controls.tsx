"use client";
import { ActionButton } from "@/components/action-form";
import { deactivateDriver, reactivateDriver } from "@/app/(app)/drivers/actions";

export function DriverStatusButton({ id, status }: { id: string; status: string }) {
  return status === "active"
    ? <ActionButton variant="danger" action={() => deactivateDriver(id)} confirm="Deactivate this driver? They will be unassigned from their vehicle.">Deactivate driver</ActionButton>
    : <ActionButton action={() => reactivateDriver(id)}>Reactivate driver</ActionButton>;
}
