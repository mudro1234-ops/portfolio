"use client";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/action-form";
import { Card, CardHeader } from "@/components/ui";
import { TIMEZONES } from "@/lib/constants";
import { updateOrganization, updateProfile, updateThresholds } from "@/app/(app)/settings/actions";

export function OrganizationForm({ org, canEdit }: { org: { name: string; contact_email: string | null; contact_phone: string | null; country: string; currency: string; timezone: string }; canEdit: boolean }) {
  return (
    <Card><CardHeader title="Organisation profile" />
      <ActionForm action={updateOrganization} resetOnSuccess={false} className="space-y-4 p-5">
        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name *" name="name"><Input name="name" defaultValue={org.name} required /></Field>
          <Field label="Contact email" name="contact_email"><Input name="contact_email" type="email" defaultValue={org.contact_email ?? ""} /></Field>
          <Field label="Contact phone" name="contact_phone"><Input name="contact_phone" defaultValue={org.contact_phone ?? ""} /></Field>
          <Field label="Time zone" name="timezone"><Select name="timezone" required defaultValue={org.timezone} options={(TIMEZONES.includes(org.timezone) ? TIMEZONES : [org.timezone, ...TIMEZONES]).map((t) => ({ value: t, label: t }))} /></Field>
          <Field label="Country code" name="country"><Input name="country" maxLength={2} defaultValue={org.country} required /></Field>
          <Field label="Default currency" name="currency"><Input name="currency" maxLength={3} defaultValue={org.currency} required /></Field>
        </fieldset>
        {canEdit && <SubmitButton>Save profile</SubmitButton>}
      </ActionForm>
    </Card>
  );
}

export function ThresholdForm({ org, canEdit }: { org: { trip_start_speed_kmh: number; trip_end_speed_kmh: number; trip_end_minutes: number; stale_after_seconds: number; offline_after_seconds: number; position_retention_days: number }; canEdit: boolean }) {
  return (
    <Card><CardHeader title="Tracking thresholds" description="Defaults need validating against your real devices. Changes apply to new GPS positions." />
      <ActionForm action={updateThresholds} resetOnSuccess={false} className="space-y-4 p-5">
        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Trip starts at (km/h)" name="trip_start_speed_kmh" help="A trip begins at or above this speed."><Input name="trip_start_speed_kmh" type="number" step="0.5" defaultValue={org.trip_start_speed_kmh} /></Field>
          <Field label="Counts as stopped below (km/h)" name="trip_end_speed_kmh"><Input name="trip_end_speed_kmh" type="number" step="0.5" defaultValue={org.trip_end_speed_kmh} /></Field>
          <Field label="Trip ends after stopped for (minutes)" name="trip_end_minutes"><Input name="trip_end_minutes" type="number" defaultValue={org.trip_end_minutes} /></Field>
          <Field label="Position is stale after (seconds)" name="stale_after_seconds" help="Older fixes are labelled stale."><Input name="stale_after_seconds" type="number" defaultValue={org.stale_after_seconds} /></Field>
          <Field label="Vehicle is offline after (seconds)" name="offline_after_seconds"><Input name="offline_after_seconds" type="number" defaultValue={org.offline_after_seconds} /></Field>
          <Field label="Keep GPS history for (days)" name="position_retention_days" help="Older positions are deleted by the nightly cleanup."><Input name="position_retention_days" type="number" defaultValue={org.position_retention_days} /></Field>
        </fieldset>
        {canEdit && <SubmitButton>Save thresholds</SubmitButton>}
      </ActionForm>
    </Card>
  );
}

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string | null; email: string }) {
  return (
    <Card><CardHeader title="Your profile" />
      <ActionForm action={updateProfile} resetOnSuccess={false} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name"><Input name="full_name" defaultValue={fullName} required /></Field>
          <Field label="Phone" name="phone"><Input name="phone" defaultValue={phone ?? ""} /></Field>
          <Field label="Email" name="email" help="Your sign-in email cannot be changed here."><Input name="email" value={email} readOnly disabled /></Field>
        </div>
        <SubmitButton>Save profile</SubmitButton>
      </ActionForm>
    </Card>
  );
}
