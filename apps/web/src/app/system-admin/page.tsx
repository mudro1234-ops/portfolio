"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";

type Tab = "overview" | "workspaces" | "users" | "vehicles" | "approvals" | "billing" | "audit" | "integrations" | "support" | "settings";
type Data = {
  stats: Record<string, number>;
  workspaces: any[]; users: any[]; memberships: any[]; vehicles: any[]; devices: any[]; vehicleStates: any[];
  applications: any[]; subscriptions: any[]; auditLogs: any[]; supportRequests: any[];
  settings: any[]; integrations: Record<string, { configured: boolean; status?: string }>;
  generatedAt: string;
};

const tabs: { id: Tab; label: string; group: string }[] = [
  { id: "overview", label: "Platform overview", group: "PLATFORM" },
  { id: "workspaces", label: "Company & individual accounts", group: "ACCOUNTS" },
  { id: "users", label: "Users & permissions", group: "ACCOUNTS" },
  { id: "approvals", label: "Applications & approvals", group: "ACCOUNTS" },
  { id: "vehicles", label: "Vehicles & GPS devices", group: "OPERATIONS" },
  { id: "billing", label: "Subscriptions & plans", group: "OPERATIONS" },
  { id: "audit", label: "Audit & security", group: "SECURITY" },
  { id: "integrations", label: "System health & integrations", group: "SECURITY" },
  { id: "support", label: "Support desk", group: "MANAGEMENT" },
  { id: "settings", label: "Platform settings", group: "MANAGEMENT" },
];

const roles = ["owner", "admin", "fleet_manager", "dispatcher", "driver", "analyst"];
const statusPill = (value: string) => <span className={"adminStatus " + (["active","approved","online","resolved"].includes(value) ? "good" : ["suspended","rejected","archived","urgent","critical"].includes(value) ? "bad" : "neutral")}>{value?.replaceAll("_", " ") || "unknown"}</span>;
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";

export default function SystemAdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [workspaceType, setWorkspaceType] = useState("all");
  const [inviteEmail, setInviteEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceTypeCreate, setWorkspaceTypeCreate] = useState<"company" | "individual">("company");
  const [countryCode, setCountryCode] = useState("ZW");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [contactPhone, setContactPhone] = useState("");
  const [memberInviteEmail, setMemberInviteEmail] = useState("");
  const [memberInviteOrg, setMemberInviteOrg] = useState("");
  const [memberInviteRole, setMemberInviteRole] = useState("driver");
  const [settingKey, setSettingKey] = useState("");
  const [settingValue, setSettingValue] = useState("{}");
  const [settingDescription, setSettingDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/system-admin/operations", { cache: "no-store" });
      const result = await response.json();
      if (response.status === 401) { window.location.assign("/login?next=/system-admin"); return; }
      if (response.status === 403) { setError("This account does not have System Administrator privileges."); setLoading(false); return; }
      if (!response.ok) throw new Error(result.error || "Could not load platform data.");
      setData(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load platform data."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function action(payload: Record<string, unknown>, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/system-admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The action could not be completed.");
      setNotice("The change was saved and recorded in the platform audit log.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The action could not be completed."); }
    finally { setBusy(false); }
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/system-admin/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, workspaceName, workspaceType: workspaceTypeCreate, countryCode, currencyCode, phone: contactPhone }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Workspace creation failed.");
      setNotice("Workspace created and invitation sent to " + result.email + ".");
      setInviteEmail(""); setWorkspaceName(""); setContactPhone(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Workspace creation failed."); }
    finally { setBusy(false); }
  }

  const filteredWorkspaces = useMemo(() => (data?.workspaces ?? []).filter(w => (workspaceType === "all" || w.workspace_type === workspaceType) && (String(w.name + " " + w.contact_email + " " + w.country_code).toLowerCase().includes(search.toLowerCase()))), [data, workspaceType, search]);
  const filteredUsers = useMemo(() => (data?.users ?? []).filter(u => String(u.email + " " + u.id).toLowerCase().includes(search.toLowerCase())), [data, search]);

  if (loading && !data) return <main className="pageWrap theme-admin"><p className="muted">Securing administrator session and loading platform records…</p></main>;

  return <main className="adminConsole theme-admin">
    <aside className="adminSidebar">
      <Link href="/" className="adminBrand"><BrandMark /><span>MASTER CONTROL</span></Link>
      <div className="adminNavLabel">VEKTOR PLATFORM</div>
      {["PLATFORM","ACCOUNTS","OPERATIONS","SECURITY","MANAGEMENT"].map(group => <div className="adminNavGroup" key={group}>
        <div className="adminNavLabel">{group}</div>
        {tabs.filter(t => t.group === group).map(item => <button key={item.id} className={"adminNavItem " + (tab === item.id ? "selected" : "")} onClick={() => { setTab(item.id); setSearch(""); }}>{item.label}</button>)}
      </div>)}
      <div className="adminSidebarBottom"><span className="adminLiveDot"/> Platform administrator<br/><Link href="/">← Return to workspace</Link></div>
    </aside>

    <section className="adminMain">
      <header className="adminTopbar"><div><div className="eyebrow">VEKTOR / SYSTEM ADMINISTRATION</div><h1>{tabs.find(t => t.id === tab)?.label}</h1><p className="muted">Platform-wide control with tenant isolation and auditable operations.</p></div><div className="adminTopActions"><span className="adminStatus good">Admin session</span><button className="adminButton" onClick={() => void load()} disabled={loading}>↻ Refresh</button></div></header>
      {error && <div className="adminAlert error" role="alert">{error}</div>}
      {notice && <div className="adminAlert success" role="status">{notice}</div>}

      {tab === "overview" && <>
        <div className="adminWelcome"><div><div className="eyebrow">PLATFORM SNAPSHOT</div><h2>Good operations start with visibility.</h2><p>Monitor workspace growth, account lifecycle, connected assets and service readiness from one control centre.</p></div><div className="adminSnapshot">Updated {date(data?.generatedAt)}</div></div>
        <div className="adminMetricGrid">
          {[
            ["Companies",data?.stats.companies],["Individual owners",data?.stats.individuals],["Active users (30d)",data?.stats.activeUsers],["Registered vehicles",data?.stats.vehicles],
            ["GPS devices",data?.stats.devices],["Devices online",data?.stats.onlineDevices],["Pending approvals",data?.stats.pendingApplications],["Rejected applications",data?.stats.rejectedApplications],["Open support cases",data?.stats.openSupport]
          ].map(([label,value])=><article className="adminMetric" key={String(label)}><span>{label}</span><strong>{value ?? "—"}</strong><small>Live platform records</small></article>)}
        </div>
        <div className="adminColumns">
          <section className="adminPanel"><div className="adminPanelHead"><div><h3>Account lifecycle</h3><p>Current workspace status</p></div><button className="adminTextButton" onClick={() => setTab("workspaces")}>Manage accounts →</button></div>
            {["active","suspended","archived"].map(status=><div className="adminProgressRow" key={status}><span>{statusPill(status)}</span><strong>{data?.workspaces.filter(w=>w.account_status===status).length ?? 0}</strong></div>)}
          </section>
          <section className="adminPanel"><div className="adminPanelHead"><div><h3>Integration readiness</h3><p>Credential presence only — secrets are never displayed</p></div><button className="adminTextButton" onClick={() => setTab("integrations")}>View health →</button></div>
            {Object.entries(data?.integrations ?? {}).map(([key,item])=><div className="adminProgressRow" key={key}><span>{key.toUpperCase()}</span>{statusPill(item.configured ? "configured" : "not configured")}</div>)}
          </section>
        </div>
        <section className="adminPanel"><div className="adminPanelHead"><div><h3>Recent administrative activity</h3><p>Latest platform events recorded in the audit trail</p></div><button className="adminTextButton" onClick={() => setTab("audit")}>Open audit log →</button></div><AuditTable rows={(data?.auditLogs ?? []).slice(0,8)}/></section>
      </>}

      {tab === "workspaces" && <>
        <section className="adminPanel"><div className="adminPanelHead"><div><h3>Create a company or individual account</h3><p>Creates a separate workspace and sends a secure owner invitation.</p></div></div>
          <form className="adminFormGrid" onSubmit={createWorkspace}>
            <label>Workspace type<select value={workspaceTypeCreate} onChange={e=>setWorkspaceTypeCreate(e.target.value as "company"|"individual")}><option value="company">Company fleet</option><option value="individual">Individual vehicle owner</option></select></label>
            <label>Workspace name<input required minLength={2} maxLength={120} value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} placeholder="Business or owner's name"/></label>
            <label>Owner email<input required type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="owner@example.com"/></label>
            <label>Phone (optional)<input value={contactPhone} onChange={e=>setContactPhone(e.target.value)}/></label>
            <label>Country code<input required minLength={2} maxLength={2} value={countryCode} onChange={e=>setCountryCode(e.target.value.toUpperCase())}/></label>
            <label>Currency code<input required minLength={3} maxLength={3} value={currencyCode} onChange={e=>setCurrencyCode(e.target.value.toUpperCase())}/></label>
            <button className="adminPrimary" disabled={busy}>{busy?"Creating…":"Create workspace & invite owner"}</button>
          </form>
        </section>
        <section className="adminPanel"><div className="adminToolbar"><div><h3>All workspaces</h3><p>Manage company and individual accounts without accessing their fleet operations.</p></div><div className="adminFilters"><input placeholder="Search accounts…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={workspaceType} onChange={e=>setWorkspaceType(e.target.value)}><option value="all">All types</option><option value="company">Companies</option><option value="individual">Individuals</option></select></div></div>
          <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Workspace</th><th>Type</th><th>Contact</th><th>Country</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{filteredWorkspaces.map(w=><tr key={w.id}><td><strong>{w.name}</strong><small>{w.slug}</small></td><td>{w.workspace_type}</td><td>{w.contact_email || "—"}<small>{w.contact_phone || ""}</small></td><td>{w.country_code} · {w.currency_code}</td><td>{statusPill(w.account_status)}</td><td>{date(w.created_at)}</td><td className="adminActions"><button onClick={()=>{const name=window.prompt("Workspace name",w.name);if(name===null)return;const email=window.prompt("Contact email",w.contact_email||"")??"";const phone=window.prompt("Contact phone",w.contact_phone||"")??"";void action({action:"workspace_update",id:w.id,name,contact_email:email,contact_phone:phone});}}>Edit</button><button onClick={()=>{const next=w.account_status==="suspended"?"active":"suspended";const reason=next==="suspended"?window.prompt("Reason for suspension (required)"): "";if(next==="suspended"&&!reason)return;void action({action:"workspace_status",id:w.id,status:next,reason},next==="suspended"?"Suspend this workspace? Its members must be blocked from protected data by the workspace access guard.":"Reactivate this workspace?");}}>{w.account_status==="suspended"?"Reactivate":"Suspend"}</button>{w.account_status!=="archived"&&<button className="dangerLink" onClick={()=>{const reason=window.prompt("Reason for archiving (required)");if(!reason)return;void action({action:"workspace_status",id:w.id,status:"archived",reason},"Archive this workspace? This does not hard-delete its records.");}}>Archive</button>}</td></tr>)}</tbody></table></div>
        </section>
      </>}

      {tab === "users" && <section className="adminPanel"><div className="adminToolbar"><div><h3>Users, memberships & permissions</h3><p>Change workspace roles or revoke memberships. Suspend account access only with a documented reason.</p></div><input placeholder="Search email or user ID…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <form className="adminFormGrid adminInviteForm" onSubmit={e=>{e.preventDefault();void action({action:"invite_member",organization_id:memberInviteOrg,email:memberInviteEmail,role:memberInviteRole}).then(()=>{setMemberInviteEmail("");});}}>
          <label>Invite to workspace<select required value={memberInviteOrg} onChange={e=>setMemberInviteOrg(e.target.value)}><option value="">Select a workspace</option>{(data?.workspaces??[]).filter(w=>w.account_status==="active").map(w=><option key={w.id} value={w.id}>{w.name} · {w.workspace_type}</option>)}</select></label>
          <label>Email address<input required type="email" value={memberInviteEmail} onChange={e=>setMemberInviteEmail(e.target.value)} placeholder="new.member@example.com"/></label>
          <label>Workspace role<select value={memberInviteRole} onChange={e=>setMemberInviteRole(e.target.value)}>{roles.map(r=><option key={r} value={r}>{r.replaceAll("_"," ")}</option>)}</select></label>
          <button className="adminPrimary" disabled={busy||!memberInviteOrg}>Send invitation</button>
        </form>
        <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>User</th><th>Workspace</th><th>Current role</th><th>Last sign-in</th><th>Account</th><th>Actions</th></tr></thead><tbody>{(data?.memberships??[]).filter(m=>String(m.user?.email+" "+m.organization?.name+" "+m.user_id).toLowerCase().includes(search.toLowerCase())).map(m=><tr key={m.id}><td><strong>{m.user?.email||"Unknown user"}</strong><small>{m.user_id}</small></td><td>{m.organization?.name||"Unknown workspace"}</td><td><select value={m.role} disabled={busy} onChange={e=>void action({action:"membership_role",id:m.id,role:e.target.value},"Change this user's workspace role?")}>{roles.map(r=><option key={r} value={r}>{r.replaceAll("_"," ")}</option>)}</select></td><td>{date(m.user?.last_sign_in_at)}</td><td>{m.user?.banned_until?statusPill("suspended"):statusPill("active")}</td><td className="adminActions"><button onClick={()=>void action({action:"send_recovery",id:m.user_id},"Send a secure password recovery email to this user?")}>Send recovery</button><button className="dangerLink" onClick={()=>{const reason=window.prompt("Reason for revoking membership");if(reason)void action({action:"membership_remove",id:m.id,reason},"Revoke this user's access to this workspace?");}}>Revoke membership</button><button onClick={()=>{const suspend=!m.user?.banned_until;const reason=window.prompt(suspend?"Reason for suspending this account":"Reason for reactivating this account");if(reason)void action({action:"user_access",id:m.user_id,suspend,reason},suspend?"Suspend this user's VEKTOR sign-in?":"Reactivate this user's VEKTOR sign-in?");}}>{m.user?.banned_until?"Reactivate user":"Suspend user"}</button></td></tr>)}</tbody></table></div>
        <p className="adminFootnote">Membership roles are scoped to one workspace. A user may have more than one workspace membership. System Administrator status is separate and is not granted through this role selector.</p>
      </section>}

      {tab === "approvals" && <section className="adminPanel"><div className="adminPanelHead"><div><h3>Workspace applications</h3><p>Approve or reject company and individual workspace applications.</p></div>{statusPill(String(data?.stats.pendingApplications ?? 0)+" pending")}</div>
        <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Applicant</th><th>Workspace requested</th><th>Type</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead><tbody>{(data?.applications??[]).map(a=><tr key={a.id}><td>{a.contact_email}<small>{a.contact_phone||""}</small></td><td><strong>{a.workspace_name}</strong><small>{a.country_code} · {a.currency_code}</small></td><td>{a.workspace_type}</td><td>{date(a.created_at)}</td><td>{statusPill(a.status)}</td><td>{a.status==="pending"?<div className="adminActions"><button onClick={()=>void action({action:"application_review",id:a.id,decision:"approve",note:"Approved by platform administrator."},"Approve this workspace application?")}>Approve</button><button className="dangerLink" onClick={()=>{const note=window.prompt("Reason for rejection (required)");if(note)void action({action:"application_review",id:a.id,decision:"reject",note},"Reject this application?");}}>Reject</button></div>:<small>{a.review_note||"Reviewed"}</small>}</td></tr>)}</tbody></table></div>
      </section>}

      {tab === "vehicles" && <div className="adminColumns"><section className="adminPanel"><div className="adminPanelHead"><div><h3>Registered vehicles</h3><p>Platform-wide asset inventory and workspace ownership.</p></div></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Vehicle</th><th>Workspace</th><th>Status</th><th>Last GPS fix</th></tr></thead><tbody>{(data?.vehicles??[]).map(v=>{const state=(data?.vehicleStates??[]).find(s=>s.vehicle_id===v.id);return <tr key={v.id}><td><strong>{v.registration_number}</strong><small>{v.make} {v.model}</small></td><td>{v.organization?.name||"—"}<small>{v.organization?.workspace_type}</small></td><td>{statusPill(v.status)}</td><td>{date(state?.device_time)}<small>{state?.is_stale?"Stale / last known":"Recent fix"}{state?.speed_kph!=null?" · "+state.speed_kph+" km/h":""}</small></td></tr>})}</tbody></table></div></section>
        <section className="adminPanel"><div className="adminPanelHead"><div><h3>GPS tracking devices</h3><p>Last-seen status uses each device reporting interval with a two-minute minimum.</p></div></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Device</th><th>Workspace</th><th>Vehicle</th><th>Connection</th><th>Last seen</th></tr></thead><tbody>{(data?.devices??[]).map(d=><tr key={d.id}><td><strong>{d.label||d.unique_id}</strong><small>{d.manufacturer||d.provider} {d.model||""}</small></td><td>{d.organization?.name||"—"}</td><td>{d.vehicle?.registration_number||"Unassigned"}</td><td>{statusPill(d.online?"online":d.active?"offline":"inactive")}</td><td>{date(d.last_seen_at)}</td></tr>)}</tbody></table></div></section></div>}

      {tab === "billing" && <section className="adminPanel"><div className="adminPanelHead"><div><h3>Subscription administration</h3><p>Manage plan labels and subscription lifecycle. Payment collection requires a connected billing provider.</p></div></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Workspace</th><th>Plan</th><th>Status</th><th>Trial ends</th><th>Period ends</th><th>Save changes</th></tr></thead><tbody>{(data?.subscriptions??[]).map(s=><SubscriptionRow key={s.id} item={s} busy={busy} onSave={(plan,status)=>void action({action:"subscription_update",id:s.id,plan_code:plan,status},"Save subscription changes?")}/>)}</tbody></table></div><p className="adminFootnote">This changes VEKTOR's stored subscription state only. It does not charge customers, issue invoices, or cancel payment-provider subscriptions.</p></section>}

      {tab === "audit" && <section className="adminPanel"><div className="adminPanelHead"><div><h3>Audit trail & security events</h3><p>Administrative actions are appended to the audit log. Authentication event history depends on configured Auth logging.</p></div><button className="adminButton" onClick={()=>{const rows=data?.auditLogs??[];const csv=["timestamp,actor,action,resource,resource_id,metadata",...rows.map(r=>[r.created_at,r.actor?.email,r.action,r.resource_type,r.resource_id,JSON.stringify(r.metadata)].map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(","))].join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download="vektor-audit-log.csv";a.click();URL.revokeObjectURL(url);}}>Export CSV</button></div><AuditTable rows={data?.auditLogs??[]}/></section>}

      {tab === "integrations" && <div className="adminIntegrationGrid">{Object.entries(data?.integrations??{}).map(([name,item])=><article className="adminPanel" key={name}><div className="adminPanelHead"><div><h3>{name.toUpperCase()}</h3><p>{name==="database"?"Supabase project and Data API":name==="traccar"?"GPS ingestion secret and server-side database access":name==="email"?"Email delivery configuration":"Integration credential presence"}</p></div>{statusPill(item.configured?"configured":"not configured")}</div><p className="adminFootnote">{item.configured?"Required environment variable(s) detected. This does not guarantee the external service is reachable.":"Required environment variable(s) are missing. Add them in Vercel server-side environment settings."}</p></article>)}</div>}

      {tab === "support" && <section className="adminPanel"><div className="adminPanelHead"><div><h3>Support requests</h3><p>Assign cases, update priority and status, and keep internal notes for administrators.</p></div></div>{(data?.supportRequests??[]).length===0?<div className="adminEmpty">No support requests have been submitted yet. The support case table is ready for requests from the workspace help centre.</div>:<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Request</th><th>Requester</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Internal notes</th><th>Save</th></tr></thead><tbody>{(data?.supportRequests??[]).map(s=><SupportRow key={s.id} item={s} users={data?.users??[]} busy={busy} onSave={(status,priority,notes,assignedTo)=>void action({action:"support_update",id:s.id,status,priority,internal_notes:notes,assigned_to:assignedTo})}/>)}</tbody></table></div>}</section>}

      {tab === "settings" && <section className="adminPanel"><div className="adminPanelHead"><div><h3>Platform-wide configuration</h3><p>Store policy defaults as JSON values. Never store API keys or private credentials here.</p></div></div><form className="adminFormGrid" onSubmit={e=>{e.preventDefault();try{const value=JSON.parse(settingValue);void action({action:"setting_update",key:settingKey,value,description:settingDescription});setSettingKey("");setSettingValue("{}");setSettingDescription("");}catch{setError("Setting value must be valid JSON.");}}}><label>Setting key<input required pattern="[a-z][a-z0-9_.-]{1,100}" value={settingKey} onChange={e=>setSettingKey(e.target.value)} placeholder="alerts.default_threshold"/></label><label>Description<input value={settingDescription} onChange={e=>setSettingDescription(e.target.value)} placeholder="What this setting controls"/></label><label className="adminWide">JSON value<textarea rows={4} value={settingValue} onChange={e=>setSettingValue(e.target.value)}/></label><button className="adminPrimary" disabled={busy}>Save platform setting</button></form><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Key</th><th>Description</th><th>Value</th><th>Updated</th></tr></thead><tbody>{(data?.settings??[]).map(s=><tr key={s.key}><td><strong>{s.key}</strong></td><td>{s.description||"—"}</td><td><code>{JSON.stringify(s.value)}</code></td><td>{date(s.updated_at)}</td></tr>)}</tbody></table></div></section>}
    </section>
  </main>;
}

function AuditTable({rows}:{rows:any[]}) {
  return <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{date(r.created_at)}</td><td>{r.actor?.email||r.actor_user_id||"System"}</td><td><strong>{r.action}</strong></td><td>{r.resource_type}<small>{r.resource_id||""}</small></td><td><code>{JSON.stringify(r.metadata||{})}</code></td></tr>)}</tbody></table></div>;
}

function SubscriptionRow({item,busy,onSave}:{item:any;busy:boolean;onSave:(plan:string,status:string)=>void}) {
  const [plan,setPlan]=useState(item.plan_code||"trial");const [status,setStatus]=useState(item.status||"trialing");
  return <tr><td>{item.organization?.name||item.organization_id}</td><td><input value={plan} onChange={e=>setPlan(e.target.value)}/></td><td><select value={status} onChange={e=>setStatus(e.target.value)}>{["trialing","active","past_due","canceled","incomplete"].map(s=><option key={s}>{s}</option>)}</select></td><td>{date(item.trial_ends_at)}</td><td>{date(item.current_period_end)}</td><td><button disabled={busy} onClick={()=>onSave(plan,status)}>Save</button></td></tr>;
}

function SupportRow({item,users,busy,onSave}:{item:any;users:any[];busy:boolean;onSave:(status:string,priority:string,notes:string,assignedTo:string)=>void}) {
  const [status,setStatus]=useState(item.status);const [priority,setPriority]=useState(item.priority);const [notes,setNotes]=useState(item.internal_notes||"");const [assignedTo,setAssignedTo]=useState(item.assigned_to||"");
  return <tr><td><strong>{item.subject}</strong><small>{item.description}</small></td><td>{item.requester?.email||"—"}</td><td><select value={priority} onChange={e=>setPriority(e.target.value)}>{["low","normal","high","urgent"].map(x=><option key={x}>{x}</option>)}</select></td><td><select value={status} onChange={e=>setStatus(e.target.value)}>{["open","in_progress","waiting","resolved","closed"].map(x=><option key={x}>{x}</option>)}</select></td><td><select value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}><option value="">Unassigned</option>{users.map(u=><option key={u.id} value={u.id}>{u.email||u.id}</option>)}</select></td><td><textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></td><td><button disabled={busy} onClick={()=>onSave(status,priority,notes,assignedTo)}>Save</button></td></tr>;
}
