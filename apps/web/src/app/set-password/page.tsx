"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 10) { setError("Use at least 10 characters for your password."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      const response = await fetch("/api/auth/complete-password", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your account could not be secured.");
      setDone(true);
      const requested = params.get("next");
      const safeNext = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      window.setTimeout(() => { router.replace(safeNext); router.refresh(); }, 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your password could not be saved.");
    } finally { setBusy(false); }
  }

  return <main className="formPage"><section className="formCard">
    <BrandMark />
    <div className="eyebrow">FIRST SIGN-IN SECURITY</div>
    <h1>Change your temporary password</h1>
    <p className="muted">For your security, choose a new password before opening your VEKTOR workspace. Your temporary password will no longer be accepted.</p>
    <form onSubmit={submit} className="formStack">
      <label>New password<input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <label>Confirm new password<input required minLength={10} type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
      <button className="primaryButton" disabled={busy||done}>{busy?"Securing account…":done?"Password changed":"Save new password"}</button>
    </form>
    {error && <p role="alert" className="errorText">{error}</p>}
    {done && <p role="status" className="muted">Your password has been changed. Opening your workspace…</p>}
  </section></main>;
}

export default function SetPasswordPage() {
  return <Suspense fallback={<main className="formPage"><p className="muted">Loading account security…</p></main>}><SetPasswordForm /></Suspense>;
}
