"use client";
import { ActionButton } from "@/components/action-form";
import { deleteGeofence, toggleGeofence } from "@/app/(app)/geofences/actions";

export function GeofenceRowActions({ id, active }: { id: string; active: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <ActionButton action={() => toggleGeofence(id, !active)}>{active ? "Disable" : "Enable"}</ActionButton>
      <ActionButton variant="danger" action={() => deleteGeofence(id)} confirm="Delete this geofence and its event history?">Delete</ActionButton>
    </div>
  );
}
