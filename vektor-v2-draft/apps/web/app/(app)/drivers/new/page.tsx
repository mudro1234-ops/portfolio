import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { PageHeader } from "@/components/ui";
import { DriverForm } from "@/components/driver-form";
import { createDriver } from "../actions";

export const metadata: Metadata = { title: "Add driver" };

export default async function NewDriverPage() {
  await requireCapability("drivers.manage");
  return (
    <>
      <PageHeader title="Add a driver" description="Register a driver, then assign them a vehicle and invite them to the driver app." />
      <div className="max-w-3xl"><DriverForm action={createDriver} cancelHref="/drivers" /></div>
    </>
  );
}
