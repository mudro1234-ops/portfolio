"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

type Application = {
  id: string;
  workspace_type: "company" | "individual";
  workspace_name: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

export default function ApplyWorkspacePage() {
  const [workspaceType, setWorkspaceType] = useState<"company" | "individual">("company");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("ZW");
  const [currency, setCurrency] = useState("USD");
  const [application, setApplication] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        window.location.assign("/login?next=/apply");
        return;
      }
      if (!active) return;
      setEmail(user.email ?? "");
      const { data, error: queryError } = await supabase
        .from("workspace_applications")
        .select("id, workspace_type, workspace_name, status, review_note, created_at")
        .eq("applicant_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (queryError) setError(queryError.message);
      else if (data) setApplication(data as Application);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again before submitting.");
      const { data, error: insertError } = await supabase
        .from("workspace_applications")
        .insert({
          applicant_user_id: user.id,
          workspace_type: workspaceType,
          workspace_name: workspaceName.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim() || null,
          country_code: country,
          currency_code: currency,
        })
        .select("id, workspace_type, workspace_name, status, review_note, created_at")
        .single();
      if (insertError) throw insertError;
      setApplication(data as Application);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your application could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="formPage"><section className="formCard">
    <BrandMark />
    <div className="eyebrow">VEKTOR ACCESS REQUEST</div>
    <h1>Request your workspace</h1>
    <p className="muted">Choose the environment that matches how you use vehicles. A VEKTOR administrator reviews each request before a private workspace is activated.</p>
    {loading ? <p className="muted">Checking your application…</p> : application ? <div className="notice">
      <strong>{application.workspace_name}</strong>
      <p>Workspace type: {application.workspace_type === "company" ? "Company fleet" : "Individual vehicle owner"}</p>
      <p>Application status: <strong>{application.status.toUpperCase()}</strong></p>
      {application.review_note && <p>Administrator note: {application.review_note}</p>}
      {application.status === "pending" && <p>Your request is waiting for administrator review. You do not need to submit it again.</p>}
      {application.status === "approved" && <p>Your workspace has been approved. Sign out and sign in again if it is not yet visible on your dashboard.</p>}
      {application.status === "rejected" && <><p>Contact support if you need clarification, or submit a revised request.</p><button type="button" className="primaryButton" onClick={() => setApplication(null)}>Start a new application</button></> }
    </div> : <form onSubmit={submit} className="formStack">
      <label>Workspace type
        <select value={workspaceType} onChange={e => setWorkspaceType(e.target.value as "company" | "individual")}>
          <option value="company">Company fleet</option>
          <option value="individual">Individual vehicle owner</option>
        </select>
      </label>
      <label>{workspaceType === "company" ? "Registered company / organisation name" : "Your name or personal workspace name"}
        <input required minLength={2} maxLength={120} value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder={workspaceType === "company" ? "e.g. Madrude Logistics" : "e.g. My Vehicle"} />
      </label>
      <label>Contact email
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label>Contact phone (optional)
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+263…" />
      </label>
      <label>Country
        <select value={country} onChange={e => { setCountry(e.target.value); setCurrency(e.target.value === "ZW" ? "USD" : e.target.value === "ZA" ? "ZAR" : "USD"); }}>
          <option value="ZW">Zimbabwe</option><option value="ZA">South Africa</option><option value="BW">Botswana</option><option value="ZM">Zambia</option><option value="GB">United Kingdom</option><option value="US">United States</option>
        </select>
      </label>
      <label>Preferred currency
        <select value={currency} onChange={e => setCurrency(e.target.value)}>
          <option value="USD">USD</option><option value="ZAR">ZAR</option><option value="ZWL">ZWL</option><option value="BWP">BWP</option><option value="ZMW">ZMW</option><option value="GBP">GBP</option><option value="EUR">EUR</option>
        </select>
      </label>
      {error && <p className="errorText" role="alert">{error}</p>}
      <button className="primaryButton" disabled={busy}>{busy ? "Submitting request…" : "Submit for approval"}</button>
    </form>}
    {error && application && <p className="errorText" role="alert">{error}</p>}
    <Link className="backLink" href="/">Back to VEKTOR</Link>
  </section></main>;
}
