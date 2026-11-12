"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

type Driver = { id: string; user_id: string | null; full_name: string; phone: string | null; licence_number: string | null; licence_expiry: string | null; status: string };

export default function DriversPage() {
  const [orgId,setOrgId]=useState("");
  const [items,setItems]=useState<Driver[]>([]);
  const [name,setName]=useState("");
  const [userId,setUserId]=useState("");
  const [phone,setPhone]=useState("");
  const [licence,setLicence]=useState("");
  const [expiry,setExpiry]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const supabase=createClient();

  async function load(){
    setError("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setError("Please sign in again.");setLoading(false);return;}
    const {data:membership,error:memberError}=await supabase.from("organization_memberships").select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
    if(memberError||!membership){setError(memberError?.message??"Create a company workspace before adding drivers.");setLoading(false);return;}
    setOrgId(membership.organization_id);
    const {data,error:queryError}=await supabase.from("drivers").select("id,user_id,full_name,phone,licence_number,licence_expiry,status").eq("organization_id",membership.organization_id).order("created_at",{ascending:false});
    if(queryError)setError(queryError.message);else setItems((data??[]) as Driver[]);
    setLoading(false);
  }
  useEffect(()=>{void load();},[]);

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!orgId)return;setBusy(true);setError("");
    const {error:insertError}=await supabase.from("drivers").insert({organization_id:orgId,user_id:userId.trim()||null,full_name:name.trim(),phone:phone.trim()||null,licence_number:licence.trim()||null,licence_expiry:expiry||null});
    if(insertError)setError(insertError.message);else{setName("");setUserId("");setPhone("");setLicence("");setExpiry("");await load();}
    setBusy(false);
  }
  async function remove(id:string){if(!confirm("Remove this driver record?"))return;const {error:deleteError}=await supabase.from("drivers").delete().eq("id",id).eq("organization_id",orgId);if(deleteError)setError(deleteError.message);else await load();}

  return <main className="pageWrap"><header className="pageHeader"><div><Link href="/" className="backLink">← Dashboard</Link><div className="eyebrow">PEOPLE MANAGEMENT</div><h1>Drivers</h1><p className="muted">Maintain driver records and licence information.</p></div><span className="pill">{items.length} drivers</span></header>
    <section className="card"><h2>Add a driver</h2><form className="dataForm" onSubmit={submit}>
      <label>Full name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Driver full name"/></label>
      <label>Supabase user ID (optional)<input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="Link driver login account"/></label>
      <label>Phone<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+263…"/></label>
      <label>Licence number<input value={licence} onChange={e=>setLicence(e.target.value)} placeholder="Driving licence number"/></label>
      <label>Licence expiry<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
      <button className="primaryButton" disabled={busy||!orgId}>{busy?"Saving…":"Add driver"}</button>
    </form></section>
    {error&&<p className="errorText" role="alert">{error}</p>}
    <section className="card tableCard"><h2>Driver records</h2>{loading?<p className="muted">Loading drivers…</p>:items.length===0?<p className="empty">No drivers have been registered in this workspace.</p>:<div className="tableScroll"><table><thead><tr><th>Name</th><th>Driver ID</th><th>Account user ID</th><th>Phone</th><th>Licence</th><th>Expiry</th><th>Status</th><th></th></tr></thead><tbody>{items.map(d=><tr key={d.id}><td>{d.full_name}</td><td>{d.id}</td><td>{d.user_id??"Not linked"}</td><td>{d.phone??"—"}</td><td>{d.licence_number??"—"}</td><td>{d.licence_expiry??"—"}</td><td><span className="pill">{d.status}</span></td><td><button className="textButton" onClick={()=>void remove(d.id)}>Remove</button></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
