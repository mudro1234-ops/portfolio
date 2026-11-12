"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateName(value: string) {
    setName(value);
    setSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error: rpcError } = await createClient().rpc("create_organization_with_owner", {
        org_name: name.trim(),
        org_slug: slug.trim(),
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("The company workspace was not created.");
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create company workspace.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="formPage"><section className="formCard">
    <BrandMark />
    <div className="eyebrow">COMPANY WORKSPACE SETUP</div>
    <h1>Create your company</h1>
    <p className="muted">This creates an isolated company workspace and makes your account its first owner.</p>
    <form onSubmit={submit} className="formStack">
      <label>Company name<input required minLength={2} maxLength={120} value={name} onChange={e=>updateName(e.target.value)} placeholder="e.g. Madrude Logistics"/></label>
      <label>Workspace URL name<input required pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())} placeholder="madrude-logistics"/></label>
      <p className="note">Use lowercase letters, numbers and hyphens. This name must be unique.</p>
      {error && <p className="errorText" role="alert">{error}</p>}
      <button className="primaryButton" disabled={busy}>{busy ? "Creating workspace…" : "Create company workspace"}</button>
    </form>
    <Link className="backLink" href="/">Back to dashboard</Link>
  </section></main>;
}
