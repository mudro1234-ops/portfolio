"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
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

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#080d18"}}>
    <section style={{width:"100%",maxWidth:440,border:"1px solid #23334b",borderRadius:18,padding:30,background:"#101a2b",color:"#edf4ff"}}>
      <BrandMark />
      <div style={{fontSize:11,letterSpacing:2,color:"#b7e84a",marginTop:24}}>INVITATION ACCEPTED</div>
      <h1 style={{fontSize:28,margin:"12px 0 8px"}}>Secure your VEKTOR account</h1>
      <p style={{color:"#91a1b8",fontSize:13,lineHeight:1.6}}>Choose a password to finish setting up your account.</p>
      <form onSubmit={submit} style={{display:"grid",gap:14,marginTop:22}}>
        <label style={{fontSize:12,color:"#b8c6d9"}}>New password<input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
        <label style={{fontSize:12,color:"#b8c6d9"}}>Confirm password<input required minLength={10} type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} style={field}/></label>
        <button disabled={busy||done} style={button}>{busy?"Saving password…":done?"Password saved":"Set password & continue"}</button>
      </form>
      {error && <p role="alert" style={{fontSize:12,color:"#ffb4a9"}}>{error}</p>}
      {done && <p role="status" style={{fontSize:12,color:"#b7e84a"}}>Your account is ready. Opening your workspace…</p>}
    </section>
  </main>;
}

const field: CSSProperties = {display:"block",width:"100%",marginTop:7,padding:"12px 13px",borderRadius:9,border:"1px solid #34465f",background:"#0b1322",color:"#edf4ff",outline:"none"};
const button: CSSProperties = {padding:13,border:0,borderRadius:9,background:"#b7e84a",color:"#07131b",fontWeight:800,cursor:"pointer"};
