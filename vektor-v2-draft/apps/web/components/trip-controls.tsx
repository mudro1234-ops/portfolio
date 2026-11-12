"use client";
import { ActionButton, ActionForm, Field, Select, SubmitButton, Input, Textarea } from "@/components/action-form";
import { cancelTrip, completeTrip, createTrip, saveTripNotes, startTrip } from "@/app/(app)/trips/actions";
import { Card, LinkButton } from "@/components/ui";

export function TripActionButtons({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "planned" && <ActionButton variant="primary" size="md" action={() => startTrip(id)}>Start trip</ActionButton>}
      {status === "in_progress" && <ActionButton variant="primary" size="md" action={() => completeTrip(id)} confirm="Mark this trip as completed now?">Complete trip</ActionButton>}
      {(status === "planned" || status === "in_progress") && <ActionButton size="md" action={() => cancelTrip(id)} confirm="Cancel this trip?">Cancel trip</ActionButton>}
    </div>
  );
}

export function TripNotesForm({ id, notes, canEdit }: { id: string; notes: string | null; canEdit: boolean }) {
  if (!canEdit) return <p className="whitespace-pre-wrap text-sm text-ink">{notes || <span className="text-muted">No notes.</span>}</p>;
  return (
    <ActionForm action={saveTripNotes} resetOnSuccess={false} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Review notes" name="notes"><Textarea name="notes" defaultValue={notes ?? ""} rows={4} placeholder="Observations from reviewing this trip" /></Field>
      <SubmitButton>Save notes</SubmitButton>
    </ActionForm>
  );
}

export function NewTripForm({ vehicles, drivers }: { vehicles: { value: string; label: string }[]; drivers: { value: string; label: string }[] }) {
  return (
    <ActionForm action={createTrip} resetOnSuccess={false} className="space-y-6">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle *" name="vehicle_id"><Select name="vehicle_id" required options={vehicles} placeholder="Choose a vehicle" /></Field>
          <Field label="Driver" name="driver_id" help="Leave empty to use the vehicle's current driver."><Select name="driver_id" options={drivers} placeholder="Vehicle's assigned driver" /></Field>
          <Field label="Origin" name="origin"><Input name="origin" placeholder="e.g. Harare depot" /></Field>
          <Field label="Destination *" name="destination"><Input name="destination" required placeholder="e.g. Bulawayo - customer site" /></Field>
        </div>
        <Field label="Notes" name="notes" className="mt-4"><Textarea name="notes" /></Field>
      </Card>
      <div className="flex gap-3"><SubmitButton>Create trip</SubmitButton><LinkButton href="/trips" variant="secondary">Cancel</LinkButton></div>
    </ActionForm>
  );
}
