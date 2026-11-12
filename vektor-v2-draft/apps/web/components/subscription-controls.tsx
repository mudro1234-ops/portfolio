"use client";
import { ActionButton } from "@/components/action-form";
import { requestCancellation, requestPlan } from "@/app/(app)/subscription/actions";

export function RequestPlanButton({ code, current }: { code: string; current: boolean }) {
  if (current) return <span className="text-xs font-medium text-muted">Current plan</span>;
  return <ActionButton action={() => requestPlan(code)} confirm="Request a change to this plan?">Request this plan</ActionButton>;
}
export function CancelButton() {
  return <ActionButton variant="danger" action={requestCancellation} confirm="Request cancellation of your subscription?">Request cancellation</ActionButton>;
}
