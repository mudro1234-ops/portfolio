"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

type Application = {
  id: string;
  workspace_type: "company" | "individual";
  workspace_name: string;
  status: "pending" | "rejected";
  review_note: string | null;
  created_at: string;
};

const fieldStyle: CSSProperties = {
  width: "100%", padding: "12px 13px", borderRadius: 9,
  border: "1px solid #34465f", background: "#0b1322", color: "#edf4ff", marginTop: 7,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [type, setType] = useState<"company" | "individual">("company");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("ZW");
  const [currency, setCurrency] = useState("USD");
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace("/login?next=/onboarding"); return; }
      if (!active) return;
      setEmail(user.email ?? "");
      const { data: memberships, error: membershipError } = await supabase
        .from("organization_memberships").select("organization_id").eq("user_id", user.id).limit(1);
      if (membershipError) { setError(membershipError.message); setLoading(false); return; }
      if (memberships?.length) { router.replace("/"); return; }
      const { data, error: appError } = await supabase
        .from("workspace_applications")
        .select("id, workspace_type, workspace_name, status, review_note, created_at")
        .eq("applicant_user_id", user.id).in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!active) return;
      if (appError) setError(appError.message);
      if (data) {
        setApplication(data as Application);
        setType(data.workspace_type);
        setName(data.workspace_name);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login?next=/onboarding"); return; }
    const { data, error: insertError } = await supabase.from("workspace_applications").insert({
      applicant_user_id: user.id,
      workspace_type: type,
      workspace_name: name.trim(),
      contact_email: email.trim().toLowerCase(),
      contact_phone: phone.trim() || null,
      country_code: country.trim().toUpperCase(),
      currency_code: currency.trim().toUpperCase(),
      status: "pending",
    }).select("id, workspace_type, workspace_name, status, review_note, created_at").single();
    if (insertError) {
      setError(insertError.code === "23505"
        ? "You already have a pending application. Refresh this page to see its status."
        : insertError.message);
    } else if (data) {
      setApplication(data as Application);
    }
    setBusy(false);
  }

  if (loading) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#080d18", color: "#edf4ff" }}>Loading application…</main>;
  const pending = application?.status === "pending";

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#080d18", color: "#edf4ff" }}>
    <section style={{ width: "100%", maxWidth: 560, border: "1px solid #23334b", borderRadius: 18, padding: 30, background: "#101a2b" }}>
      <BrandMark />
      <div style={{ color: "#b7e84a", fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", marginTop: 22 }}>WORKSPACE ACCESS REQUEST</div>
      <h1 style={{ fontSize: 29, margin: "10px 0 8px" }}>{pending ? "Application under review" : "Apply for a VEKTOR workspace"}</h1>
      <p style={{ color: "#91a1b8", fontSize: 13, lineHeight: 1.7 }}>
        {pending ? "Your request has been received. A VEKTOR system administrator must approve it before your workspace is created." : "Choose the type of workspace you need. We create it only after an administrator reviews and approves your application."}
      </p>
      {pending && application ? (
        <div style={{ marginTop: 22, border: "1px solid #34465f", borderRadius: 12, padding: 18, background: "#0b1322" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <strong>{application.workspace_name}</strong><span style={{ borderRadius: 99, padding: "5px 10px", fontSize: 11, background: "#263b22", color: "#c7f28b" }}>Pending review</span>
          </div>
          <p style={{ color: "#91a1b8", fontSize: 12, marginTop: 8 }}>Type: {application.workspace_type === "company" ? "Company workspace" : "Individual owner workspace"}</p>
          <p style={{ color: "#91a1b8", fontSize: 12, marginTop: 4 }}>Submitted: {new Date(application.created_at).toLocaleString()}</p>
          <button onClick={() => router.refresh()} style={{ marginTop: 16, color: "#b7e84a", background: "transparent", border: 0, cursor: "pointer", fontSize: 12 }}>Refresh status</button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 22 }}>
          {application?.status === "rejected" && <div role="status" style={{ border: "1px solid #71433f", background: "#2a191d", borderRadius: 9, padding: 12, color: "#f3b3a8", fontSize: 12 }}>
            Your previous application was not approved.{application.review_note ? " Reviewer note: " + application.review_note : " You may submit a revised application."}
          </div>}
          <label style={{ fontSize: 12, color: "#b8c6d9" }}>Workspace type
            <select value={type} onChange={e => setType(e.target.value as "company" | "individual")} style={fieldStyle}>
              <option value="company">Company / fleet operator</option><option value="individual">Individual vehicle owner</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: "#b8c6d9" }}>{type === "company" ? "Company name" : "Owner workspace name"}
            <input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder={type === "company" ? "e.g. Madrude Logistics" : "e.g. My Vehicle"} style={fieldStyle} />
          </label>
          <label style={{ fontSize: 12, color: "#b8c6d9" }}>Contact email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={fieldStyle} /></label>
          <label style={{ fontSize: 12, color: "#b8c6d9" }}>Phone number (optional)<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+263…" style={fieldStyle} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ fontSize: 12, color: "#b8c6d9" }}>Country code<input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" value={country} onChange={e => setCountry(e.target.value.toUpperCase())} style={fieldStyle} /></label>
            <label style={{ fontSize: 12, color: "#b8c6d9" }}>Currency<input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} style={fieldStyle} /></label>
          </div>
          {error && <p role="alert" style={{ color: "#ff9f9f", fontSize: 12 }}>{error}</p>}
          <button disabled={busy} style={{ padding: 13, border: 0, borderRadius: 9, background: "#b7e84a", color: "#07131b", fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Submitting…" : application?.status === "rejected" ? "Submit revised application" : "Submit for approval"}
          </button>
        </form>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 22, fontSize: 12 }}>
        <Link href="/" style={{ color: "#b7e84a" }}>Back to VEKTOR</Link><Link href="/login" style={{ color: "#91a1b8" }}>Sign out</Link>
      </div>
    </section>
  </main>;
}
