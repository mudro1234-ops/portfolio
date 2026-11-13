"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

type Workspace = { organization_id: string; role: string };

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [counts, setCounts] = useState({ vehicles: 0, drivers: 0, trips: 0, alerts: 0 });
  const [error, setError] = useState("");
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace("/login"); return; }
      if (!active) return;
      setEmail(user.email ?? "");
      const { data: adminRecord } = await supabase.from("system_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (active) setIsSystemAdmin(Boolean(adminRecord));
      const { data: memberships, error: memberError } = await supabase
        .from("organization_memberships")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .limit(1);
      if (memberError) { setError(memberError.message); setLoading(false); return; }
      const member = (memberships?.[0] ?? null) as Workspace | null;
      if (!active) return;
      setWorkspace(member);
      if (member) {
        const org = member.organization_id;
        const { data: organization, error: organizationError } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", org)
          .maybeSingle();
        if (!active) return;
        if (organizationError) setError(organizationError.message);
        setWorkspaceName(organization?.name ?? "Company workspace");
        const [vehicles, drivers, trips, alerts] = await Promise.all([
          supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", org),
          supabase.from("drivers").select("id", { count: "exact", head: true }).eq("organization_id", org),
          supabase.from("trips").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "in_progress"),
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("organization_id", org).is("acknowledged_at", null),
        ]);
        if (!active) return;
        setCounts({ vehicles: vehicles.count ?? 0, drivers: drivers.count ?? 0, trips: trips.count ?? 0, alerts: alerts.count ?? 0 });
        const queryError = vehicles.error || drivers.error || trips.error || alerts.error;
        if (queryError) setError(queryError.message);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const nav = [["Overview", "/"], ["Live Tracking", "/tracking"], ["Vehicles", "/vehicles"], ["Drivers", "/drivers"], ["Assignments", "/assignments"], ["GPS Devices", "/devices"], ["Trips", "/trips"], ["Geofences", "/geofences"], ["Alerts", "/alerts"], ["Maintenance", "/maintenance"], ["Fuel & Expenses", "/fuel"], ["Reports", "/reports"], ["AI Assistant", "/assistant"], ["Team & Permissions", "/team"], ["Subscription", "/subscription"], ["Settings", "/settings"]];

  return <div className="shell">
    <aside className="side">
      <div className="brand">VEKTOR <span>/ FLEET</span></div>
      <div className="brandTagline">Fleet Telemetry & Tracking</div>
      <div className="links">
        <section><div className="group">WORKSPACE</div>{nav.slice(0,7).map(([label,href])=><Link className={href==="/" ? "nav active":"nav"} href={href} key={href}>{label}</Link>)}</section>
        <section><div className="group">OPERATIONS</div>{nav.slice(7,12).map(([label,href])=><Link className="nav" href={href} key={href}>{label}</Link>)}</section>
        <section><div className="group">MANAGEMENT</div>{nav.slice(12).map(([label,href])=><Link className="nav" href={href} key={href}>{label}</Link>)}</section>
      </div>
      <div className="notice">Company workspaces are isolated by database-level organization permissions.</div>
      <button className="secondaryButton" onClick={signOut}>Sign out</button>
    </aside>
    <main className="main">
      <div className="top"><div><div className="eyebrow">VEKTOR · Fleet Telemetry & Tracking</div><h1>Fleet overview</h1><div className="muted">{email}</div></div><div style={{display:"flex",alignItems:"center",gap:12}}>{isSystemAdmin && <Link className="primaryLink" href="/system-admin/applications">System Admin</Link>}<span className="pill">{loading ? "Loading workspace…" : workspaceName || "No company workspace"}</span></div></div>
      {error && <div className="notice" role="alert">{error}</div>}
      {!loading && !workspace && <div className="card onboarding"><div className="eyebrow">First step</div><h2>Request a workspace</h2><p className="muted">Choose a company workspace or an individual vehicle-owner workspace. VEKTOR creates it after a system administrator approves your application.</p><Link className="primaryLink" href="/onboarding">Apply for a workspace</Link></div>}
      <div className="grid">
        {[["Fleet vehicles", counts.vehicles, "Registered vehicles"], ["Drivers", counts.drivers, "Driver records"], ["Active trips", counts.trips, "Trips currently in progress"], ["Open alerts", counts.alerts, "Alerts awaiting acknowledgement"]].map(([label,value,note])=><div className="card" key={String(label)}><div className="metric-label">{label}</div><div className="metric">{loading ? "—" : value}</div><div className="note">{note}</div></div>)}
      </div>
      <div className="head"><h2>Fleet operations</h2><span className="pill">Live GPS not connected</span></div>
      <div className="grid actionGrid">
        <Link className="card actionCard" href="/vehicles"><div className="eyebrow">FLEET</div><h3>Manage vehicles</h3><div className="muted">Register vehicles and maintain fleet records.</div></Link>
        <Link className="card actionCard" href="/drivers"><div className="eyebrow">PEOPLE</div><h3>Manage drivers</h3><div className="muted">Maintain driver profiles and licence details.</div></Link>
        <div className="card"><div className="eyebrow">TRACKING</div><h3>Connect GPS devices</h3><div className="muted">Traccar ingestion and driver-consented phone tracking are the next integration stage.</div></div>
        <div className="card"><div className="eyebrow">SECURITY</div><h3>Tenant isolation enabled</h3><div className="muted">Company membership and role checks are enforced by PostgreSQL row-level security.</div></div>
      </div>
      <div className="notice">A vehicle is only shown as live when a recent, validated GPS fix is available. Stale or missing telemetry is never labelled live.</div>
    </main>
  </div>;
}
