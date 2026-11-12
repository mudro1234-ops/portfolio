"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

type Vehicle = { id: string; registration_number: string; make: string | null; model: string | null; year: number | null; status: string };

export default function VehiclesPage() {
  const [orgId,setOrgId]=useState("");
  const [items,setItems]=useState<Vehicle[]>([]);
  const [registration,setRegistration]=useState("");
  const [make,setMake]=useState("");
  const [model,setModel]=useState("");
  const [year,setYear]=useState("");
  const [status,setStatus]=useState("active");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const supabase=createClient();

  async function load() {
    setError("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setError("Please sign in again.");setLoading(false);return;}
    const {data:membership,error:memberError}=await supabase.from("organization_memberships").select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
    if(memberError||!membership){setError(memberError?.message??"Create a company workspace before adding vehicles.");setLoading(false);return;}
    setOrgId(membership.organization_id);
    const {data,error:queryError}=await supabase.from("vehicles").select("id,registration_number,make,model,year,status").eq("organization_id",membership.organization_id).order("created_at",{ascending:false});
    if(queryError)setError(queryError.message);else setItems((data??[]) as Vehicle[]);
    setLoading(false);
  }
  useEffect(()=>{void load();},[]);

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!orgId)return;setBusy(true);setError("");
    const {error:insertError}=await supabase.from("vehicles").insert({organization_id:orgId,registration_number:registration.trim().toUpperCase(),make:make.trim()||null,model:model.trim()||null,year:year?Number(year):null,status});
    if(insertError)setError(insertError.message);else{setRegistration("");setMake("");setModel("");setYear("");await load();}
    setBusy(false);
  }
  async function remove(id:string){if(!confirm("Remove this vehicle from the company fleet?"))return;const {error:deleteError}=await supabase.from("vehicles").delete().eq("id",id).eq("organization_id",orgId);if(deleteError)setError(deleteError.message);else await load();}

  return <main className="pageWrap"><header className="pageHeader"><div><Link href="/" className="backLink">← Dashboard</Link><div className="eyebrow">FLEET MANAGEMENT</div><h1>Vehicles</h1><p className="muted">Register and maintain vehicles belonging to your company workspace.</p></div><span className="pill">{items.length} vehicles</span></header>
    <section className="card"><h2>Add a vehicle</h2><form className="dataForm" onSubmit={submit}>
      <label>Registration number<input required maxLength={30} value={registration} onChange={e=>setRegistration(e.target.value)} placeholder="e.g. AEB 1234"/></label>
      <label>Make<input value={make} onChange={e=>setMake(e.target.value)} placeholder="Toyota"/></label>
      <label>Model<input value={model} onChange={e=>setModel(e.target.value)} placeholder="Hilux"/></label>
      <label>Year<input type="number" min="1900" max="2200" value={year} onChange={e=>setYear(e.target.value)} placeholder="2022"/></label>
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select></label>
      <button className="primaryButton" disabled={busy||!orgId}>{busy?"Saving…":"Add vehicle"}</button>
    </form></section>
    {error&&<p className="errorText" role="alert">{error}</p>}
    <section className="card tableCard"><h2>Registered vehicles</h2>{loading?<p className="muted">Loading vehicles…</p>:items.length===0?<p className="empty">No vehicles have been registered in this workspace.</p>:<div className="tableScroll"><table><thead><tr><th>Registration</th><th>Vehicle ID</th><th>Vehicle</th><th>Year</th><th>Status</th><th></th></tr></thead><tbody>{items.map(v=><tr key={v.id}><td>{v.registration_number}</td><td>{v.id}</td><td>{[v.make,v.model].filter(Boolean).join(" ")||"—"}</td><td>{v.year??"—"}</td><td><span className="pill">{v.status}</span></td><td><button className="textButton" onClick={()=>void remove(v.id)}>Remove</button></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
