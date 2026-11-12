"use client";
import { useMemo, useState } from "react";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/action-form";
import { Card, LinkButton } from "@/components/ui";
import { CURRENCIES } from "@/lib/constants";
import { createFuelRecord } from "@/app/(app)/fuel/actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/toast";

export function FuelForm({ orgId, vehicles, defaultCurrency }: { orgId: string; vehicles: { value: string; label: string }[]; defaultCurrency: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [receiptPath, setReceiptPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [litres, setLitres] = useState("");
  const [cost, setCost] = useState("");
  const perLitre = Number(litres) > 0 && Number(cost) >= 0 && cost !== "" ? (Number(cost) / Number(litres)).toFixed(2) : null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast("Receipts must be under 5 MB.", "error"); return; }
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) { toast("Upload a JPG, PNG, WebP or PDF.", "error"); return; }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const path = `${orgId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) { toast("The receipt could not be uploaded. You can save the record without it.", "error"); setReceiptPath(""); return; }
    setReceiptPath(path);
    toast("Receipt attached.");
  }

  return (
    <ActionForm action={createFuelRecord} resetOnSuccess={false} className="space-y-6">
      <input type="hidden" name="receipt_path" value={receiptPath} />
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle *" name="vehicle_id"><Select name="vehicle_id" required options={vehicles} placeholder="Choose a vehicle" /></Field>
          <Field label="Date *" name="fueled_at"><Input name="fueled_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Litres *" name="litres"><Input name="litres" type="number" step="0.01" min="0.01" required value={litres} onChange={(e) => setLitres(e.target.value)} /></Field>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <Field label="Total cost *" name="total_cost" help={perLitre ? `${perLitre} per litre` : undefined}><Input name="total_cost" type="number" step="0.01" min="0" required value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Field label="Currency" name="currency"><Select name="currency" required defaultValue={defaultCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></Field>
          </div>
          <Field label="Odometer (km)" name="odometer_km" help="Needed for consumption figures."><Input name="odometer_km" type="number" min={0} step="0.1" /></Field>
          <Field label="Fuel station" name="station"><Input name="station" placeholder="e.g. Zuva Borrowdale" /></Field>
          <Field label="Receipt (optional)" name="receipt" help={receiptPath ? "Receipt attached." : "JPG, PNG, WebP or PDF, up to 5 MB."} className="sm:col-span-2">
            <input id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand" />
          </Field>
        </div>
      </Card>
      <div className="flex gap-3"><SubmitButton pendingLabel={uploading ? "Uploading receipt..." : "Saving..."}>Save fuel record</SubmitButton><LinkButton href="/fuel" variant="secondary">Cancel</LinkButton></div>
    </ActionForm>
  );
}
