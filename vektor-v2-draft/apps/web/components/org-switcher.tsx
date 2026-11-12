"use client";
import { useTransition } from "react";
import { switchOrganization } from "@/app/auth/actions";
import { inputClass } from "@/components/ui";

export function OrgSwitcher({ orgs, activeId }: { orgs: { id: string; name: string }[]; activeId: string }) {
  const [pending, start] = useTransition();
  if (orgs.length <= 1) {
    return <span className="truncate text-sm font-semibold text-ink">{orgs[0]?.name}</span>;
  }
  return (
    <select
      aria-label="Switch organisation"
      disabled={pending}
      value={activeId}
      onChange={(e) => start(() => switchOrganization(e.target.value))}
      className={`${inputClass} !w-auto max-w-[220px] !py-1.5 font-semibold`}
    >
      {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
