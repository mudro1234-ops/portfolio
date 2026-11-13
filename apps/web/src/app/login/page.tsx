"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const requested = params.get("next");
      const safeNext = requested && requested.startsWith("/") && !requested.startsWith("//")
        ? requested
        : null;

      if (safeNext) {
        router.replace(safeNext);
      } else {
        const { data: admin } = await supabase
          .from("system_admins")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        router.replace(admin ? "/system-admin" : "/");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="formPage"><section className="formCard">
    
      <BrandMark />
      <div className="eyebrow">SECURE VEKTOR ACCESS</div>
      <h1>Welcome back</h1>
      <p className="muted">Sign in with the email address that received your VEKTOR invitation.</p>
      <form onSubmit={submit} className="formStack">
        <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className="primaryButton" disabled={busy}>{busy?"Signing in…":"Sign in securely"}</button>
      </form>
      {message && <p role="alert" className="errorText">{message}</p>}
      <p className="muted">
        VEKTOR accounts are invitation-only. If you have not received an invitation, contact the platform administrator.
      </p>
    </section></main>;
}


export default function LoginPage() {
  return <Suspense fallback={<main className="formPage"><p className="muted">Loading sign in…</p></main>}><LoginForm /></Suspense>;
}
