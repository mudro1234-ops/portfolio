"use client";

import { Suspense, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
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
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const requestedPath = params.get("next");\n        const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";\n        router.replace(safePath);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth/callback" } });
        if (error) throw error;
        setMessage(data.session ? "Account created. You can continue." : "Account created. Check your email to confirm your address before signing in.");
        if (data.session) router.replace("/");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#080d18"}}>
    <section style={{width:"100%",maxWidth:420,border:"1px solid #23334b",borderRadius:18,padding:30,background:"#101a2b",color:"#edf4ff"}}>
      <BrandMark />
      <h1 style={{fontSize:29,margin:"12px 0 6px"}}>{mode==="login"?"Welcome back":"Create your account"}</h1>
      <p style={{color:"#91a1b8",fontSize:13,lineHeight:1.6}}>Sign in to access your company fleet workspace.</p>
      <form onSubmit={submit} style={{display:"grid",gap:13,marginTop:24}}>
        <label style={{fontSize:12,color:"#b8c6d9"}}>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
        <label style={{fontSize:12,color:"#b8c6d9"}}>Password<input required minLength={8} type="password" autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
        <button disabled={busy} style={button}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}</button>
      </form>
      {message && <p role="status" style={{fontSize:12,color:"#f0c987",lineHeight:1.5}}>{message}</p>}
      <button onClick={()=>{setMode(mode==="login"?"signup":"login");setMessage("");}} style={{background:"none",border:0,color:"#b7e84a",padding:"14px 0 0",cursor:"pointer",fontSize:12}}>
        {mode==="login"?"New to VEKTOR? Create an account":"Already registered? Sign in"}
      </button>
    </section>
  </main>;
}

const field: CSSProperties = {display:"block",width:"100%",marginTop:7,padding:"12px 13px",borderRadius:9,border:"1px solid #34465f",background:"#0b1322",color:"#edf4ff",outline:"none"};
const button: CSSProperties = {padding:13,border:0,borderRadius:9,background:"#b7e84a",color:"#07131b",fontWeight:800,cursor:"pointer"};

export default function LoginPage() {
  return <Suspense fallback={<main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#080d18",color:"#edf4ff"}}>Loading sign in…</main>}><LoginForm /></Suspense>;
}
