"use client";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/action-form";
import { deleteDevice } from "@/app/(app)/devices/actions";

export function DeleteDeviceButton({ id }: { id: string }) {
  const router = useRouter();
  return <ActionButton variant="danger" confirm="Delete this device record? Its position history is kept." action={async () => { const r = await deleteDevice(id); if (r.ok) router.push("/devices"); return r; }}>Delete device</ActionButton>;
}
