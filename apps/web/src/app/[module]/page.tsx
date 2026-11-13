"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import LiveMap from "@/components/live-map";
import BrandMark from "@/components/brand-mark";

type Row = Record<string, unknown>;
type Field = { name: string; label: string; type?: string; required?: boolean; placeholder?: string };
const modules: Record<string, { title: string; eyebrow: string; description: string; table?: string; fields?: Field[]; columns?: string[]; readOnly?: boolean; orderBy?: string }> = {
  tracking: { title: "Live tracking", eyebrow: "FLEET VISIBILITY", description: "Latest validated vehicle positions. A vehicle is only live when its last GPS fix is recent.", table: "vehicle_current_state", columns: ["vehicle_id","device_time","speed_kph","heading_deg","source","is_stale"], readOnly: true, orderBy: "updated_at" },
  trips: { title: "Trips", eyebrow: "JOURNEY MANAGEMENT", description: "Review active and completed vehicle journeys.", table: "trips", columns: ["vehicle_id","driver_id","started_at","ended_at","distance_km","status"], readOnly: true },
  geofences: { title: "Geofences", eyebrow: "LOCATION RULES", description: "Create circular location boundaries. Entry/exit event evaluation will be enabled with the background worker.", table: "geofences", columns: ["name","enabled","created_at"], fields: [{name:"name",label:"Geofence name",required:true},{name:"latitude",label:"Centre latitude",type:"number",required:true},{name:"longitude",label:"Centre longitude",type:"number",required:true},{name:"radius",label:"Radius in metres",type:"number",required:true,placeholder:"500"}] },
  alerts: { title: "Alerts", eyebrow: "EXCEPTIONS", description: "Review fleet events and acknowledge alerts.", table: "alerts", columns: ["alert_type","severity","message","occurred_at","acknowledged_at","vehicle_id"], orderBy: "occurred_at" },
  maintenance: { title: "Maintenance", eyebrow: "VEHICLE CARE", description: "Schedule service and record completed maintenance.", table: "maintenance_records", columns: ["title","vehicle_id","scheduled_at","completed_at","cost","currency"], fields: [{name:"vehicle_id",label:"Vehicle ID",required:true},{name:"title",label:"Service / maintenance item",required:true},{name:"details",label:"Details"},{name:"scheduled_at",label:"Scheduled date",type:"date"},{name:"cost",label:"Cost",type:"number"},{name:"currency",label:"Currency",placeholder:"USD"}] },
  fuel: { title: "Fuel & expenses", eyebrow: "OPERATING COSTS", description: "Record fuel purchases and monitor fleet operating costs.", table: "fuel_records", columns: ["vehicle_id","quantity_litres","total_cost","currency","odometer_km","filled_at"], orderBy: "filled_at", fields: [{name:"vehicle_id",label:"Vehicle ID",required:true},{name:"quantity_litres",label:"Litres",type:"number",required:true},{name:"total_cost",label:"Total cost",type:"number",required:true},{name:"currency",label:"Currency",placeholder:"USD"},{name:"odometer_km",label:"Odometer (km)",type:"number"}] },
  reports: { title: "Fleet reports", eyebrow: "ANALYTICS", description: "Live totals from your company's operational records.", readOnly: true },
  team: { title: "Team & permissions", eyebrow: "ACCESS CONTROL", description: "Review workspace members and their assigned roles.", table: "organization_memberships", columns: ["user_id","role","created_at"], readOnly: true },
  settings: { title: "Workspace settings", eyebrow: "CONFIGURATION", description: "Review integration readiness and company workspace configuration.", readOnly: true },
  devices: { title: "GPS devices", eyebrow: "DEVICE MANAGEMENT", description: "Register compatible physical trackers, SIM details and installation information before connecting them through Traccar.", table: "gps_devices", columns: ["label","manufacturer","model","unique_id","provider","provider_device_id","network_operator","sim_msisdn","expected_interval_seconds","active","last_seen_at"], fields: [{name:"label",label:"Device label"},{name:"unique_id",label:"IMEI / unique device identifier",required:true},{name:"manufacturer",label:"Manufacturer",placeholder:"Teltonika"},{name:"model",label:"Model",placeholder:"FMC920"},{name:"protocol",label:"Traccar protocol",placeholder:"teltonika"},{name:"provider_device_id",label:"Traccar device ID"},{name:"vehicle_id",label:"Assigned vehicle ID"},{name:"network_operator",label:"SIM network",placeholder:"Econet / NetOne / other"},{name:"sim_msisdn",label:"SIM phone number (optional)"},{name:"sim_iccid",label:"SIM ICCID (optional)"},{name:"firmware_version",label:"Firmware version"},{name:"installed_at",label:"Installation date",type:"date"},{name:"expected_interval_seconds",label:"Expected reporting interval (seconds)",type:"number",placeholder:"30"},{name:"installation_notes",label:"Installation notes"},{name:"provider",label:"Provider",placeholder:"traccar"}] },
  assignments: { title: "Vehicle assignments", eyebrow: "FLEET OPERATIONS", description: "Assign drivers to vehicles and keep assignment history.", table: "vehicle_assignments", columns: ["vehicle_id","driver_id","starts_at","ends_at"], fields: [{name:"vehicle_id",label:"Vehicle ID",required:true},{name:"driver_id",label:"Driver ID",required:true},{name:"starts_at",label:"Start date/time",type:"datetime-local"},{name:"ends_at",label:"End date/time",type:"datetime-local"}] },
  consent: { title: "Tracking consent", eyebrow: "DRIVER PRIVACY", description: "Review consent records for smartphone tracking. Consent must be explicit, purpose-limited and revocable.", table: "tracking_consents", columns: ["driver_id","status","purpose","policy_version","granted_at","withdrawn_at"], readOnly: true, orderBy: "recorded_at" },
  subscription: { title: "Subscription", eyebrow: "SAAS BILLING", description: "Your workspace trial and subscription status. Online payments are not activated until a payment provider is connected.", table: "subscription_accounts", columns: ["plan_code","status","trial_ends_at","current_period_end"], readOnly: true },
  assistant: { title: "AI fleet assistant", eyebrow: "FLEET INTELLIGENCE", description: "Ask operational questions. AI provider credentials must be configured as server-side environment variables.", readOnly: true }
};

export default function ModulePage() {
  const params = useParams<{module:string}>();
  const router = useRouter();
  const key = params.module;
  const config = modules[key];
  const supabase = useMemo(() => createClient(), []);
  const [orgId,setOrgId] = useState("");
  const [workspaceType,setWorkspaceType] = useState<"company"|"individual">("company");
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [values,setValues] = useState<Record<string,string>>({});
  const [metrics,setMetrics] = useState<Record<string,number>>({});
  const [question,setQuestion] = useState("");
  const [answer,setAnswer] = useState("");
  const [inviteEmail,setInviteEmail] = useState("");
  const [inviteRole,setInviteRole] = useState("driver");

  async function load() {
    setLoading(true); setError("");
    const {data:{user}} = await supabase.auth.getUser();
    if(!user){router.replace("/login");return;}
    const {data:membership,error:memberError} = await supabase.from("organization_memberships").select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
    if(memberError || !membership){setError(memberError?.message || "Create a company workspace first.");setLoading(false);return;}
    setOrgId(membership.organization_id);
    const {data:organization}=await supabase.from("organizations").select("workspace_type").eq("id",membership.organization_id).maybeSingle();
    const kind=organization?.workspace_type==="individual"?"individual":"company";setWorkspaceType(kind);
    if(kind==="individual" && ["team","assignments","consent"].includes(key)){setError("This page is part of company fleet management. Individual owners have a separate, private vehicle workspace.");setLoading(false);return;}
    if(config?.table){
      const {data,error:queryError} = await supabase.from(config.table).select("*").eq("organization_id",membership.organization_id).order(config.orderBy ?? "created_at",{ascending:false}).limit(100);
      if(queryError)setError(queryError.message); else setRows((data ?? []) as Row[]);
    }
    if(key==="reports"){
      const tables=["vehicles","drivers","trips","alerts","fuel_records","maintenance_records"];
      const results=await Promise.all(tables.map(t=>supabase.from(t).select("id",{count:"exact",head:true}).eq("organization_id",membership.organization_id)));
      setMetrics(Object.fromEntries(tables.map((t,i)=>[t,results[i].count??0])));
      const failed=results.find(x=>x.error); if(failed?.error)setError(failed.error.message);
    }
    setLoading(false);
  }
  useEffect(()=>{void load();},[key]);
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!config?.table || !orgId)return;
    setBusy(true);setError("");
    const payload:Record<string,unknown>={organization_id:orgId};
    for(const field of config.fields??[]){const value=values[field.name];if(value!==undefined&&value!=="")payload[field.name]=field.type==="number"?Number(value):value;}
    if(key==="geofences"){const response=await fetch("/api/geofences",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId:orgId,...Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Number.isNaN(Number(v))?v:Number(v)]))})});const result=await response.json();if(!response.ok)setError(result.error||"Could not create geofence.");else{setValues({});await load();}}
    else {const {error:insertError}=await supabase.from(config.table).insert(payload);if(insertError)setError(insertError.message);else{setValues({});await load();}}
    setBusy(false);
  }
  async function acknowledge(id:string){
    const {data:{user}}=await supabase.auth.getUser();
    const {error:updateError}=await supabase.from("alerts").update({acknowledged_at:new Date().toISOString(),acknowledged_by:user?.id}).eq("id",id).eq("organization_id",orgId);
    if(updateError)setError(updateError.message);else await load();
  }
  async function manageMember(userId:string,role:string,remove=false){if(!confirm(remove?"Remove this member from the workspace?":"Change this member’s role?"))return;setBusy(true);setError("");try{const response=await fetch("/api/team/members",{method:remove?"DELETE":"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId:orgId,userId,role})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Member update failed.");await load();}catch(e){setError(e instanceof Error?e.message:"Member update failed.");}finally{setBusy(false);}}
  async function inviteMember(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/team/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId:orgId,email:inviteEmail,role:inviteRole})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Invitation failed.");setInviteEmail("");setError("Invitation email sent to "+data.email+".");await load();}catch(e){setError(e instanceof Error?e.message:"Invitation failed.");}finally{setBusy(false);}}
  async function ask(){
    setBusy(true);setError("");setAnswer("");
    try{const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,organizationId:orgId})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Assistant request failed");setAnswer(data.answer);}
    catch(e){setError(e instanceof Error?e.message:"Assistant unavailable");}
    setBusy(false);
  }
  if(!config)return <main className={`pageWrap theme-${workspaceType}`}><Link href="/" className="backLink">← Dashboard</Link><h1>Module not found</h1></main>;
  return <main className="pageWrap">
    <header className="pageHeader"><div><BrandMark compact /><Link href="/" className="backLink">← VEKTOR Dashboard</Link><div className="eyebrow">{config.eyebrow}</div><h1>{config.title}</h1><p className="muted">{config.description}</p></div><span className="pill">{loading?"Loading…":rows.length+" records"}</span></header>
    {error&&<p className="errorText" role="alert">{error}</p>}
    {config.fields&&<section className="card"><h2>Add record</h2><form className="dataForm" onSubmit={save}>{config.fields.map(f=><label key={f.name}>{f.label}<input required={f.required} type={f.type??"text"} placeholder={f.placeholder??""} value={values[f.name]??""} onChange={e=>setValues(v=>({...v,[f.name]:e.target.value}))}/></label>)}<button className="primaryButton" disabled={busy||!orgId}>{busy?"Saving…":"Save record"}</button></form><p className="note">Vehicle and driver IDs are shown on their respective management pages. Use those IDs when linking a record.</p></section>}
    {key==="team"&&<section className="card"><h2>Invite a team member</h2><form className="dataForm" onSubmit={inviteMember}><label>Email address<input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="teammate@example.com"/></label><label>Workspace role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="fleet_manager">Fleet manager</option><option value="dispatcher">Dispatcher</option><option value="driver">Driver</option><option value="analyst">Analyst</option><option value="admin">Admin (owner only)</option></select></label><button className="primaryButton" disabled={busy||!orgId}>{busy?"Sending…":"Send invitation"}</button></form><p className="note">The invitee receives a Supabase invitation email. Configure your Supabase Auth email provider and redirect URLs first. Only owners/admins can invite; admins cannot grant owner/admin access.</p></section>}
    {key==="reports"&&<div className="grid">{Object.entries(metrics).map(([name,value])=><div className="card" key={name}><div className="metric-label">{name.replace("_"," ")}</div><div className="metric">{loading?"—":value}</div><div className="note">Records in this workspace</div></div>)}</div>}
    {key==="settings"&&<section className="grid actionGrid">{[["Supabase database","Connected when workspace data loads"],["Mapbox maps",process.env.NEXT_PUBLIC_MAPBOX_TOKEN?"Token configured":"Needs NEXT_PUBLIC_MAPBOX_TOKEN"],["Traccar GPS", "Needs a separately hosted Traccar server, device forwarding and TRACCAR_WEBHOOK_SECRET"],["Redis workers","Needs REDIS_URL"],["AI providers","Needs GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY"],["Payments","Provider account and webhook not configured"]].map(([title,detail])=><div className="card" key={title}><h3>{title}</h3><p className="muted">{detail}</p></div>)}</section>}
    {key==="assistant"&&<section className="card"><label className="muted">Ask about fleet operations</label><textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={4} placeholder="Summarise open alerts and suggest what needs attention." style={{width:"100%",margin:"12px 0",padding:12,background:"#0b1322",color:"white",border:"1px solid #34465f",borderRadius:9}}/><button className="primaryButton" disabled={busy||!question.trim()} onClick={()=>void ask()}>{busy?"Thinking…":"Ask assistant"}</button>{answer&&<div className="notice" style={{whiteSpace:"pre-wrap"}}>{answer}</div>}</section>}
    {key==="tracking"&&<><LiveMap rows={rows as {vehicle_id:string;position?:{type?:string;coordinates?:number[]}|null;is_stale?:boolean;speed_kph?:number|null}[]}/><div className="notice">Live positions are populated only by trusted Traccar or consented mobile ingestion. Empty or stale positions are not treated as live. Register a device under <Link href="/devices">GPS devices</Link>.</div></>}
    {key==="reports"&&<section className="card"><button className="primaryButton" onClick={async()=>{setBusy(true);setError("");try{const tables=[["vehicles","registration_number,make,model,status"],["drivers","full_name,phone,status,licence_expiry"],["trips","vehicle_id,driver_id,started_at,ended_at,distance_km,status"],["alerts","alert_type,severity,message,occurred_at,acknowledged_at"],["fuel_records","vehicle_id,quantity_litres,total_cost,currency,odometer_km,filled_at"],["maintenance_records","vehicle_id,title,scheduled_at,completed_at,cost,currency"]];const quote=(v:unknown)=>'"'+String(v??"").replaceAll('"','""')+'"';const lines=["VEKTOR Fleet Telemetry & Tracking - workspace report","Generated at,"+new Date().toISOString(),""];for(const [table,cols] of tables){const fields=cols.split(",");const {data,error:queryError}=await supabase.from(table).select(fields.join(",")).eq("organization_id",orgId).limit(1000);if(queryError)throw queryError;lines.push(table.toUpperCase(),fields.join(","));for(const row of data??[])lines.push(fields.map(field=>quote((row as unknown as Record<string,unknown>)[field])).join(","));lines.push("");}const blob=new Blob([lines.join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="vektor-fleet-report.csv";a.click();URL.revokeObjectURL(url);}catch(e){setError(e instanceof Error?e.message:"Report export failed.");}finally{setBusy(false);}}}>{busy?"Preparing…":"Download full fleet CSV"}</button><p className="note">Exports up to 1,000 accessible rows per operational table in this workspace. The report respects Supabase row-level security.</p></section>}
    {config.table&&<section className="card tableCard"><h2>{config.title} records</h2>{loading?<p className="muted">Loading…</p>:rows.length===0?<p className="empty">No records yet.</p>:<div className="tableScroll"><table><thead><tr>{(config.columns??[]).map(c=><th key={c}>{c.replaceAll("_"," ")}</th>)}{(key==="alerts"||key==="team")&&<th>Action</th>}</tr></thead><tbody>{rows.map((row,i)=><tr key={String(row.id??i)}>{(config.columns??[]).map(c=><td key={c}>{typeof row[c]==="boolean"?(row[c]?"Yes":"No"):row[c]===null||row[c]===undefined?"—":String(row[c])}</td>)}{key==="alerts"&&<td>{row.acknowledged_at?"Acknowledged":<button className="textButton" onClick={()=>void acknowledge(String(row.id))}>Acknowledge</button>}</td>}{key==="team"&&<td>{String(row.user_id)===String((rows.find(x=>x.user_id===row.user_id)?.user_id??""))&&<div className="inlineActions"><select aria-label="Member role" value={String(row.role)} onChange={e=>void manageMember(String(row.user_id),e.target.value)}><option value="owner">Owner</option><option value="admin">Admin</option><option value="fleet_manager">Fleet manager</option><option value="dispatcher">Dispatcher</option><option value="driver">Driver</option><option value="analyst">Analyst</option></select><button className="textButton" onClick={()=>void manageMember(String(row.user_id),String(row.role),true)}>Remove</button></div>}</td>}</tr>)}</tbody></table></div>}</section>}
  </main>;
}
