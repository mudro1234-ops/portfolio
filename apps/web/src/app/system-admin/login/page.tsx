"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

export default function SystemAdminLoginPage() {
  const router = useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const supabase=createClient();
    try {
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error) throw error;
      const {data:admin,error:checkError}=await supabase.from("system_admins").select("user_id").eq("user_id",data.user.id).maybeSingle();
      if(checkError) throw checkError;
      if(!admin) {
        await supabase.auth.signOut();
        throw new Error("This account is not registered as a VEKTOR System Administrator.");
      }
      if(data.user.app_metadata?.must_change_password) router.replace("/set-password?next=%2Fsystem-admin");
      else router.replace("/system-admin");
      router.refresh();
    } catch(error) {
      setMessage(error instanceof Error?error.message:"Administrator sign in failed.");
    } finally {setBusy(false);}
  }

  return <main className="formPage"><section className="formCard">
    <BrandMark />
    <div className="eyebrow">RESTRICTED PLATFORM ACCESS</div>
    <h1>System Administrator</h1>
    <p className="muted">This sign-in is reserved for authorised VEKTOR platform administrators. Company and individual accounts cannot enter this portal.</p>
    <form onSubmit={submit} className="formStack">
      <label>Administrator email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="primaryButton" disabled={busy}>{busy?"Verifying administrator…":"Enter system control"}</button>
    </form>
    {message&&<p className="errorText" role="alert">{message}</p>}
    <p className="muted"><Link href="/login">← Company & individual sign in</Link></p>
  </section></main>;
}
