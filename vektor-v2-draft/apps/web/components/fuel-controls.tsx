"use client";
import { ActionButton } from "@/components/action-form";
import { deleteFuelRecord } from "@/app/(app)/fuel/actions";

export function DeleteFuelButton({ id }: { id: string }) {
  return <ActionButton variant="danger" action={() => deleteFuelRecord(id)} confirm="Delete this fuel record?">Delete</ActionButton>;
}
