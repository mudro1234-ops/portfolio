"use client";
import { ActionButton, ActionForm, Field, Select, SubmitButton } from "@/components/action-form";
import { assignDriverAction, linkDeviceAction, setVehicleStatus, unassignVehicleAction, unlinkDeviceAction } from "@/app/(app)/vehicles/actions";

export function AssignDriverControl({ vehicleId, current, options, canEdit }: {
  vehicleId: string; current: { id: string; name: string } | null; options: { value: string; label: string }[]; canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">{current ? <>Assigned to <strong>{current.name}</strong></> : <span className="text-muted">No driver assigned</span>}</p>
      {canEdit && (
        <>
          <ActionForm action={assignDriverAction} className="flex items-end gap-2">
            <input type="hidden" name="vehicle_id" value={vehicleId} />
            <Field label={current ? "Change driver" : "Assign driver"} name="driver_id" className="min-w-0 flex-1">
              <Select name="driver_id" options={options} placeholder="Choose a driver" required />
            </Field>
            <SubmitButton pendingLabel="Assigning...">Assign</SubmitButton>
          </ActionForm>
          {current && <ActionButton action={() => unassignVehicleAction(vehicleId)} confirm="Remove the driver from this vehicle?">Unassign driver</ActionButton>}
        </>
      )}
    </div>
  );
}

export function LinkDeviceControl({ vehicleId, options, canEdit }: { vehicleId: string; options: { value: string; label: string }[]; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <ActionForm action={linkDeviceAction} className="flex items-end gap-2">
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <Field label="Link a GPS device" name="device_id" className="min-w-0 flex-1" help={options.length === 0 ? "No unlinked devices. Register one under GPS Devices." : undefined}>
        <Select name="device_id" options={options} placeholder="Choose a device" required />
      </Field>
      <SubmitButton pendingLabel="Linking...">Link</SubmitButton>
    </ActionForm>
  );
}

export function UnlinkDeviceButton({ deviceId, vehicleId }: { deviceId: string; vehicleId: string }) {
  return <ActionButton action={() => unlinkDeviceAction(deviceId, vehicleId)} confirm="Unlink this tracker from the vehicle? It will stop appearing on the map.">Unlink</ActionButton>;
}

export function VehicleStatusButtons({ vehicleId, status }: { vehicleId: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && <ActionButton action={() => setVehicleStatus(vehicleId, "active")}>Reactivate</ActionButton>}
      {status === "active" && <ActionButton action={() => setVehicleStatus(vehicleId, "inactive")} confirm="Deactivate this vehicle? Its driver will be unassigned.">Deactivate</ActionButton>}
      {status !== "retired" && <ActionButton variant="danger" action={() => setVehicleStatus(vehicleId, "retired")} confirm="Retire this vehicle? This frees its slot on your plan. History is kept.">Retire vehicle</ActionButton>}
    </div>
  );
}
