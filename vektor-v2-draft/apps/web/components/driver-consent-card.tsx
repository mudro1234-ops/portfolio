"use client";
import { useState } from "react";
import { ActionButton } from "@/components/action-form";
import { setConsent } from "@/app/driver/actions";

export function ConsentCard({ consented: initial }: { consented: boolean }) {
  const [consented, setConsented] = useState(initial);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">{consented ? "You have agreed to share your location with your organisation while you are tracking in the driver app." : "You have not agreed to location tracking. Nothing is shared."}</p>
      <ActionButton size="md" variant={consented ? "secondary" : "primary"}
        action={async () => { const r = await setConsent(!consented); if (r.ok) setConsented(!consented); return r; }}
        confirm={consented ? "Withdraw consent? Phone tracking will stop working until you agree again." : undefined}>
        {consented ? "Withdraw consent" : "I agree to location tracking"}
      </ActionButton>
    </div>
  );
}
