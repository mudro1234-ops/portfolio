"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

type Driver = { id: string; user_id: string | null; full_name: string; phone: string | null; licence_number: string | null; licence_expiry: string | null; status: string };
const empty={name:"",userId:"",phone:"",licence:"",expiry:"",status:"active"};

export default function DriversPage() {
  const [orgId,setOrgId]=useState("");
  const [items,setItems]=useState<Driver[]>([]);
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState<string|null>(null);
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

  function edit(driver:Driver){
    setEditing(driver.id);
    setForm({name:driver.full_name,userId:driver.user_id??"",phone:driver.phone??"",licence:driver.licence_number??"",expiry:driver.licence_expiry??"",status:driver.status});
  }
  function cancelEdit(){setEditing(null);setForm(empty);}
  function field(key:keyof typeof empty,value:string){setForm(current=>({...current,[key]:value}));}
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!orgId)return;setBusy(true);setError("");
    const values={user_id:form.userId.trim()||null,full_name:form.name.trim(),phone:form.phone.trim()||null,licence_number:form.licence.trim()||null,licence_expiry:form.expiry||null,status:form.status};
    const result=editing
      ? await supabase.from("drivers").update(values).eq("id",editing).eq("organization_id",orgId)
      : await supabase.from("drivers").insert({organization_id:orgId,...values});
    if(result.error)setError(result.error.message);
    else{cancelEdit();await load();}
    setBusy(false);
  }
  async function remove(id:string){
    if(!confirm("Remove this driver record?"))return;
    const {error:deleteError}=await supabase.from("drivers").delete().eq("id",id).eq("organization_id",orgId);
    if(deleteError)setError(deleteError.message);else{if(editing===id)cancelEdit();await load();}
  }

  return <main className="pageWrap"><header className="pageHeader"><div><Link href="/" className="backLink">← Dashboard</Link><div className="eyebrow">PEOPLE MANAGEMENT</div><h1>Drivers</h1><p className="muted">Maintain driver records and licence information.</p></div><span className="pill">{items.length} drivers</span></header>
    <section className="card"><h2>{editing?"Edit driver":"Add a driver"}</h2><form className="dataForm" onSubmit={submit}>
      <label>Full name<input required maxLength={120} value={form.name} onChange={e=>field("name",e.target.value)} placeholder="Driver full name"/></label>
      <label>Supabase user ID (optional)<input value={form.userId} onChange={e=>field("userId",e.target.value)} placeholder="Link driver login account"/></label>
      <label>Phone<input type="tel" value={form.phone} onChange={e=>field("phone",e.target.value)} placeholder="+263…"/></label>
      <label>Licence number<input value={form.licence} onChange={e=>field("licence",e.target.value)} placeholder="Driving licence number"/></label>
      <label>Licence expiry<input type="date" value={form.expiry} onChange={e=>field("expiry",e.target.value)}/></label>
      <label>Status<select value={form.status} onChange={e=>field("status",e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>
      <div className="inlineActions"><button className="primaryButton" disabled={busy||!orgId}>{busy?"Saving…":editing?"Save changes":"Add driver"}</button>{editing&&<button type="button" className="secondaryButton" onClick={cancelEdit}>Cancel</button>}</div>
    </form></section>
    {error&&<p className="errorText" role="alert">{error}</p>}
    <section className="card tableCard"><h2>Driver records</h2>{loading?<p className="muted">Loading drivers…</p>:items.length===0?<p className="empty">No drivers have been registered in this workspace.</p>:<div className="tableScroll"><table><thead><tr><th>Name</th><th>Driver ID</th><th>Account user ID</th><th>Phone</th><th>Licence</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(d=><tr key={d.id}><td>{d.full_name}</td><td>{d.id}</td><td>{d.user_id??"Not linked"}</td><td>{d.phone??"—"}</td><td>{d.licence_number??"—"}</td><td>{d.licence_expiry??"—"}</td><td><span className="pill">{d.status}</span></td><td><div className="inlineActions"><button className="textButton" onClick={()=>edit(d)}>Edit</button><button className="textButton" onClick={()=>void remove(d.id)}>Remove</button></div></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
