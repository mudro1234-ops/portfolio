"use client";

import { Suspense, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
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

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#080d18"}}>
    <section style={{width:"100%",maxWidth:420,border:"1px solid #23334b",borderRadius:18,padding:30,background:"#101a2b",color:"#edf4ff"}}>
      <BrandMark />
      <div style={{fontSize:11,letterSpacing:2,color:"#b7e84a",marginTop:24}}>SECURE VEKTOR ACCESS</div>
      <h1 style={{fontSize:29,margin:"12px 0 6px"}}>Welcome back</h1>
      <p style={{color:"#91a1b8",fontSize:13,lineHeight:1.6}}>Sign in with the email address that received your VEKTOR invitation.</p>
      <form onSubmit={submit} style={{display:"grid",gap:13,marginTop:24}}>
        <label style={{fontSize:12,color:"#b8c6d9"}}>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
        <label style={{fontSize:12,color:"#b8c6d9"}}>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
        <button disabled={busy} style={button}>{busy?"Signing in…":"Sign in securely"}</button>
      </form>
      {message && <p role="alert" style={{fontSize:12,color:"#ffb4a9",lineHeight:1.5}}>{message}</p>}
      <p style={{fontSize:12,color:"#91a1b8",lineHeight:1.6,marginTop:18}}>
        VEKTOR accounts are invitation-only. If you have not received an invitation, contact the platform administrator.
      </p>
    </section>
  </main>;
}

const field: CSSProperties = {display:"block",width:"100%",marginTop:7,padding:"12px 13px",borderRadius:9,border:"1px solid #34465f",background:"#0b1322",color:"#edf4ff",outline:"none"};
const button: CSSProperties = {padding:13,border:0,borderRadius:9,background:"#b7e84a",color:"#07131b",fontWeight:800,cursor:"pointer"};

export default function LoginPage() {
  return <Suspense fallback={<main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#080d18",color:"#edf4ff"}}>Loading sign in…</main>}><LoginForm /></Suspense>;
}
