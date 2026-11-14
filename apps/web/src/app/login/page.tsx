"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
    const supabase = createClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: admin } = await supabase.from("system_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (admin) {
        await supabase.auth.signOut();
        throw new Error("This is a System Administrator account. Please use the separate System Administrator sign-in.");
      }

      const requested = params.get("next");
      const safeNext = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      if (data.user.app_metadata?.must_change_password) {
        router.replace("/set-password?next=" + encodeURIComponent(safeNext));
      } else {
        router.replace(safeNext);
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
    <div className="eyebrow">VEKTOR COMPANY & INDIVIDUAL ACCESS</div>
    <h1>Workspace sign in</h1>
    <p className="muted">Sign in using the credentials sent to your registered email address.</p>
    <form onSubmit={submit} className="formStack">
      <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="primaryButton" disabled={busy}>{busy?"Signing in…":"Sign in to workspace"}</button>
    </form>
    {message && <p role="alert" className="errorText">{message}</p>}
    <p className="muted">VEKTOR accounts are created by the platform administrator. If you need access, contact your administrator.</p>
    <p className="muted"><Link href="/system-admin/login">System Administrator sign in →</Link></p>
  </section></main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="formPage"><p className="muted">Loading sign in…</p></main>}><LoginForm /></Suspense>;
}
