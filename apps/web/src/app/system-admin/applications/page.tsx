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
  created_at: string;
};

export default function SystemAdminApplicationsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sign in with a platform administrator account."); setLoading(false); return; }
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_system_admin");
    if (adminError || !isAdmin) { setError("This account does not have System Administrator access."); setLoading(false); return; }
    setAuthorized(true);
    const { data, error: queryError } = await supabase
      .from("workspace_applications")
      .select("id, applicant_user_id, workspace_type, workspace_name, contact_email, contact_phone, country_code, currency_code, status, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (queryError) setError(queryError.message);
    else setApplications((data ?? []) as Application[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(id: string, decision: "approve" | "reject") {
    setBusyId(id); setError(""); setMessage("");
    const { error: reviewError } = await createClient().rpc("review_workspace_application", {
      p_application_id: id,
      p_decision: decision,
      p_review_note: notes[id]?.trim() || null,
    });
    if (reviewError) {
      setError(reviewError.message.includes("application_already_reviewed")
        ? "This application has already been reviewed. Refresh the queue."
        : reviewError.message);
    } else {
      setMessage(decision === "approve" ? "Workspace approved and provisioned." : "Application rejected.");
      await load();
    }
    setBusyId("");
  }

  const pending = applications.filter(item => item.status === "pending");
  return <main style={{ minHeight: "100vh", background: "#080d18", color: "#edf4ff", padding: "32px 20px" }}>
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div><BrandMark /><div style={{ color: "#b7e84a", fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", marginTop: 20 }}>PLATFORM CONTROL</div><h1 style={{ fontSize: 30, marginTop: 8 }}>Workspace applications</h1><p style={{ color: "#91a1b8", fontSize: 13, marginTop: 6 }}>Review requests before VEKTOR provisions a company or individual owner workspace.</p></div>
        <Link href="/" style={{ color: "#b7e84a", fontSize: 13 }}>Return to app</Link>
      </div>
      {error && <p role="alert" style={{ color: "#ffaaaa", background: "#2a191d", border: "1px solid #71433f", borderRadius: 9, padding: 12, marginTop: 20 }}>{error}</p>}
      {message && <p role="status" style={{ color: "#c7f28b", background: "#172719", border: "1px solid #355b32", borderRadius: 9, padding: 12, marginTop: 20 }}>{message}</p>}
      {loading ? <p style={{ color: "#91a1b8", marginTop: 28 }}>Loading applications…</p> : authorized ? <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 26 }}>
          {[["Pending", pending.length], ["Approved", applications.filter(a => a.status === "approved").length], ["Rejected", applications.filter(a => a.status === "rejected").length]].map(([label, value]) => <div key={String(label)} style={{ background: "#101a2b", border: "1px solid #23334b", borderRadius: 12, padding: 16 }}><div style={{ color: "#91a1b8", fontSize: 12 }}>{label}</div><strong style={{ fontSize: 26 }}>{value}</strong></div>)}
        </div>
        <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
          {applications.map(app => <article key={app.id} style={{ background: "#101a2b", border: "1px solid #23334b", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div><div style={{ color: "#b7e84a", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em" }}>{app.workspace_type === "company" ? "COMPANY WORKSPACE" : "INDIVIDUAL OWNER"}</div><h2 style={{ fontSize: 19, marginTop: 5 }}>{app.workspace_name}</h2><p style={{ color: "#91a1b8", fontSize: 12, marginTop: 5 }}>{app.contact_email}{app.contact_phone ? " · " + app.contact_phone : ""}</p><p style={{ color: "#91a1b8", fontSize: 11, marginTop: 4 }}>{app.country_code} · {app.currency_code} · Submitted {new Date(app.created_at).toLocaleString()}</p><p style={{ color: "#60748f", fontSize: 10, marginTop: 5 }}>Applicant: {app.applicant_user_id}</p></div>
              <span style={{ alignSelf: "flex-start", borderRadius: 99, padding: "5px 10px", fontSize: 11, background: app.status === "pending" ? "#263b22" : app.status === "approved" ? "#172b42" : "#3b2424", color: app.status === "pending" ? "#c7f28b" : app.status === "approved" ? "#a9d6ff" : "#ffb2a7" }}>{app.status}</span>
            </div>
            {app.status === "pending" && <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <label style={{ color: "#b8c6d9", fontSize: 12 }}>Review note (optional)<textarea value={notes[app.id] ?? ""} onChange={e => setNotes(current => ({ ...current, [app.id]: e.target.value }))} maxLength={1000} rows={2} style={{ display: "block", width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #34465f", background: "#0b1322", color: "#edf4ff" }} /></label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button disabled={busyId === app.id} onClick={() => void review(app.id, "approve")} style={{ border: 0, borderRadius: 8, padding: "10px 15px", background: "#b7e84a", color: "#07131b", fontWeight: 800, cursor: "pointer" }}>{busyId === app.id ? "Working…" : "Approve & create workspace"}</button>
                <button disabled={busyId === app.id} onClick={() => void review(app.id, "reject")} style={{ border: "1px solid #71433f", borderRadius: 8, padding: "10px 15px", background: "transparent", color: "#ffb2a7", cursor: "pointer" }}>Reject application</button>
              </div>
            </div>}
          </article>)}
          {!applications.length && <p style={{ color: "#91a1b8", padding: 20, textAlign: "center" }}>No workspace applications have been submitted.</p>}
        </div>
      </> : null}
    </div>
  </main>;
}
