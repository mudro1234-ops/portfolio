"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 10) {
      setError("Use at least 10 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      window.setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your password could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="formPage"><section className="formCard">
    
      <BrandMark />
      <div className="eyebrow">INVITATION ACCEPTED</div>
      <h1>Secure your VEKTOR account</h1>
      <p className="muted">Choose a password to finish setting up your account.</p>
      <form onSubmit={submit} className="formStack">
        <label>New password<input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label>Confirm password<input required minLength={10} type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        <button className="primaryButton" disabled={busy||done}>{busy?"Saving password…":done?"Password saved":"Set password & continue"}</button>
      </form>
      {error && <p role="alert" className="errorText">{error}</p>}
      {done && <p role="status" className="muted">Your account is ready. Opening your workspace…</p>}
    </section></main>;
}

