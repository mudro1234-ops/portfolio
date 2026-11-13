"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

type Application = {
  id: string;
  applicant_user_id: string;
  workspace_type: "company" | "individual";
  workspace_name: string;
  contact_email: string;
  contact_phone: string | null;
  country_code: string;
  currency_code: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

export default function SystemAdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checked, setChecked] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceType, setWorkspaceType] = useState<"company" | "individual">("company");
  const [countryCode, setCountryCode] = useState("ZW");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [contactPhone, setContactPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const loadApplications = useCallback(async () => {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      window.location.assign("/login?next=/system-admin");
      return;
    }
    const { data: admin, error: adminError } = await supabase
      .from("system_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError) {
      setError(adminError.message);
      setChecked(true);
      return;
    }
    if (!admin) {
      setAuthorized(false);
      setChecked(true);
      return;
    }
    setAuthorized(true);
    const { data, error: listError } = await supabase
      .from("workspace_applications")
      .select("id, applicant_user_id, workspace_type, workspace_name, contact_email, contact_phone, country_code, currency_code, status, review_note, created_at")
      .order("created_at", { ascending: false });
    if (listError) setError(listError.message);
    else setApplications((data ?? []) as Application[]);
    setChecked(true);
  }, []);

  useEffect(() => { void loadApplications(); }, [loadApplications]);

  async function review(applicationId: string, decision: "approve" | "reject") {
    setBusyId(applicationId);
    setError("");
    try {
      const { error: reviewError } = await createClient().rpc("review_workspace_application", {
        p_application_id: applicationId,
        p_decision: decision,
        p_review_note: notes[applicationId]?.trim() || null,
      });
      if (reviewError) throw reviewError;
      await loadApplications();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The application could not be reviewed.");
    } finally {
      setBusyId("");
    }
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/system-admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          workspaceName,
          workspaceType,
          countryCode,
          currencyCode,
          phone: contactPhone,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Workspace creation failed.");
      setSuccess(`Created ${result.workspace.name}. An invitation was sent to ${result.email}.`);
      setInviteEmail("");
      setWorkspaceName("");
      setContactPhone("");
      await loadApplications();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace creation failed.");
    } finally {
      setCreating(false);
    }
  }

  if (!checked) return <main className="pageWrap"><p className="muted">Checking administrator access…</p></main>;
  if (!authorized) return <main className="formPage"><section className="formCard">
    <BrandMark /><div className="eyebrow">RESTRICTED AREA</div><h1>System administrator access</h1>
    <p className="muted">This portal is reserved for accounts explicitly registered in VEKTOR's system_admins table. Company administrator access does not grant platform-wide privileges.</p>
    <p className="notice">No system administrator access is assigned to this account. The first platform administrator must be provisioned manually by the project owner after verifying the correct authenticated user.</p>
    <Link className="backLink" href="/">Return to workspace</Link>
  </section></main>;

  const pending = applications.filter(item => item.status === "pending");
  return <main className="pageWrap">
    <Link className="backLink" href="/">← Back to workspace</Link>
    <header className="pageHeader"><div><div className="eyebrow">VEKTOR · MASTER CONTROL</div><h1>System administration</h1><p className="muted">Review access requests and provision isolated company or individual workspaces.</p></div><span className="pill">{pending.length} pending requests</span></header>
    {error && <p className="errorText" role="alert">{error}</p>}
    {success && <p className="notice" role="status">{success}</p>}
    <section className="card tableCard"><h2>Create a workspace account</h2><p className="muted">Create a private company or individual workspace and send its owner a secure invitation to set up their account.</p>
      <form onSubmit={createWorkspace} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:18}}>
        <label>Workspace type<select value={workspaceType} onChange={e=>setWorkspaceType(e.target.value as "company" | "individual")}><option value="company">Company fleet</option><option value="individual">Individual vehicle owner</option></select></label>
        <label>Workspace name<input required minLength={2} maxLength={120} value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} placeholder={workspaceType==="company"?"Company name":"Owner or personal workspace"}/></label>
        <label>Owner email<input required type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="owner@example.com"/></label>
        <label>Phone (optional)<input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="+263…"/></label>
        <label>Country code<input required minLength={2} maxLength={2} value={countryCode} onChange={e=>setCountryCode(e.target.value.toUpperCase())}/></label>
        <label>Currency code<input required minLength={3} maxLength={3} value={currencyCode} onChange={e=>setCurrencyCode(e.target.value.toUpperCase())}/></label>
        <div style={{gridColumn:"1 / -1"}}><button className="primaryButton" disabled={creating}>{creating?"Creating and sending invitation…":"Create workspace & invite owner"}</button></div>
      </form>
    </section>
    <section className="grid">
      <div className="card"><div className="metric-label">All applications</div><div className="metric">{applications.length}</div><div className="note">Submitted access requests</div></div>
      <div className="card"><div className="metric-label">Pending review</div><div className="metric">{pending.length}</div><div className="note">Awaiting a decision</div></div>
      <div className="card"><div className="metric-label">Approved</div><div className="metric">{applications.filter(item => item.status === "approved").length}</div><div className="note">Workspaces provisioned</div></div>
      <div className="card"><div className="metric-label">Rejected</div><div className="metric">{applications.filter(item => item.status === "rejected").length}</div><div className="note">Requests declined</div></div>
    </section>
    <section className="card tableCard"><h2>Workspace applications</h2>
      {applications.length === 0 ? <div className="empty">No applications have been submitted yet.</div> : <div className="tableScroll"><table><thead><tr><th>Workspace</th><th>Type</th><th>Applicant</th><th>Country</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead><tbody>
        {applications.map(item => <tr key={item.id}>
          <td><strong>{item.workspace_name}</strong><br/><span className="note">{item.contact_phone || "No phone supplied"}</span></td>
          <td>{item.workspace_type === "company" ? "Company" : "Individual"}</td>
          <td>{item.contact_email}</td><td>{item.country_code}</td><td>{new Date(item.created_at).toLocaleDateString()}</td><td>{item.status.toUpperCase()}</td>
          <td>{item.status === "pending" ? <div className="reviewActions">
            <input aria-label={"Review note for " + item.workspace_name} placeholder="Optional note" value={notes[item.id] ?? ""} onChange={e => setNotes(old => ({ ...old, [item.id]: e.target.value }))}/>
            <div className="buttonRow"><button className="primaryButton" disabled={busyId === item.id} onClick={() => void review(item.id, "approve")}>{busyId === item.id ? "Saving…" : "Approve"}</button><button className="dangerButton" disabled={busyId === item.id} onClick={() => void review(item.id, "reject")}>Reject</button></div>
          </div> : <span className="note">{item.review_note || "—"}</span>}</td>
        </tr>)}
      </tbody></table></div>}
    </section>
  </main>;
}
