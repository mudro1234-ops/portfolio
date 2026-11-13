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
