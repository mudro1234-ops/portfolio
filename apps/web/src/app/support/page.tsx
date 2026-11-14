"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

type Workspace = { organization_id: string; organization: { name: string; workspace_type: string } | null };
type Ticket = { id: string; subject: string; description: string; status: string; priority: string; created_at: string };

export default function SupportPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign("/login?next=/support"); return; }
    const { data: memberships, error: memberError } = await supabase
      .from("organization_memberships")
      .select("organization_id, organizations(name,workspace_type)")
      .eq("user_id", user.id);
    if (memberError) setError(memberError.message);
    const list = (memberships ?? []).map((m: any) => ({ organization_id: m.organization_id, organization: Array.isArray(m.organizations) ? m.organizations[0] ?? null : m.organizations ?? null })) as Workspace[];
    setWorkspaces(list);
    if (!organizationId && list[0]) setOrganizationId(list[0].organization_id);
    try {
      const response = await fetch("/api/support", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load support requests.");
      setTickets(result.requests ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load support requests."); }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, subject, description, priority }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit request.");
      setSuccess("Your support request has been submitted. Reference: " + result.request.id);
      setSubject(""); setDescription(""); setPriority("normal");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit request."); }
    finally { setBusy(false); }
  }

  return <main className="pageWrap">
    <Link href="/" className="backLink">← Back to workspace</Link>
    <header className="pageHeader"><div><BrandMark compact/><div className="eyebrow">VEKTOR HELP CENTRE</div><h1>Support & assistance</h1><p className="muted">Send a request to the VEKTOR platform team and track its progress.</p></div><span className="pill">{tickets.length} requests</span></header>
    {error && <p className="errorText" role="alert">{error}</p>}
    {success && <p className="notice" role="status">{success}</p>}
    <section className="card tableCard"><h2>Submit a support request</h2>
      {workspaces.length === 0 ? <p className="muted">You need an active workspace to submit a support request.</p> : <form onSubmit={submit} className="dataForm">
        <label>Workspace<select required value={organizationId} onChange={e=>setOrganizationId(e.target.value)}>{workspaces.map(w=><option key={w.organization_id} value={w.organization_id}>{w.organization?.name || "Workspace"} · {w.organization?.workspace_type || "account"}</option>)}</select></label>
        <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label style={{gridColumn:"1 / -1"}}>Subject<input required minLength={3} maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="What do you need help with?"/></label>
        <label style={{gridColumn:"1 / -1"}}>Describe the issue<textarea required minLength={5} maxLength={10000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Include what happened and what you expected to happen."/></label>
        <button className="primaryButton" disabled={busy||!organizationId}>{busy?"Submitting…":"Submit support request"}</button>
      </form>}
    </section>
    <section className="card tableCard"><h2>Your support history</h2>
      {loading ? <p className="muted">Loading requests…</p> : tickets.length===0 ? <div className="empty">You have not submitted any support requests yet.</div> : <div className="tableScroll"><table><thead><tr><th>Request</th><th>Priority</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{tickets.map(t=><tr key={t.id}><td><strong>{t.subject}</strong><br/><span className="note">{t.id}</span><p className="note">{t.description}</p></td><td>{t.priority.toUpperCase()}</td><td>{t.status.replaceAll("_"," ").toUpperCase()}</td><td>{new Date(t.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
