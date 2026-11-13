"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";

type Workspace = { organization_id: string; role: string };
type WorkspaceType = "company" | "individual";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>("company");
  const [applicationStatus, setApplicationStatus] = useState("");
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [counts, setCounts] = useState({ vehicles: 0, drivers: 0, trips: 0, alerts: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace("/login"); return; }
      if (!active) return;
      setEmail(user.email ?? "");
      const { data: admin } = await supabase.from("system_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (active && admin) setIsSystemAdmin(true);
      const { data: memberships, error: memberError } = await supabase
        .from("organization_memberships").select("organization_id, role").eq("user_id", user.id).limit(1);
      if (memberError) { setError(memberError.message); setLoading(false); return; }
      const member = (memberships?.[0] ?? null) as Workspace | null;
      if (!active) return;
      setWorkspace(member);
      if (member) {
        const org = member.organization_id;
        const { data: organization, error: organizationError } = await supabase
          .from("organizations").select("name, workspace_type").eq("id", org).maybeSingle();
        if (!active) return;
        if (organizationError) setError(organizationError.message);
        const kind = organization?.workspace_type === "individual" ? "individual" : "company";
        setWorkspaceType(kind);
        setWorkspaceName(organization?.name ?? (kind === "individual" ? "Personal vehicle workspace" : "Company workspace"));
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
      } else {
        const { data: application } = await supabase.from("workspace_applications").select("status").eq("applicant_user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (active && application) setApplicationStatus(application.status);
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

  const companyNav = [["Overview", "/"], ["Live Tracking", "/tracking"], ["Vehicles", "/vehicles"], ["Drivers", "/drivers"], ["Assignments", "/assignments"], ["GPS Devices", "/devices"], ["Trips", "/trips"], ["Geofences", "/geofences"], ["Alerts", "/alerts"], ["Maintenance", "/maintenance"], ["Fuel & Expenses", "/fuel"], ["Reports", "/reports"], ["AI Assistant", "/assistant"], ["Team & Permissions", "/team"], ["Subscription", "/subscription"], ["Settings", "/settings"]];
  const individualNav = [["Overview", "/"], ["My Vehicle", "/vehicles"], ["GPS Device", "/devices"], ["Journey History", "/trips"], ["Security Alerts", "/alerts"], ["Maintenance", "/maintenance"], ["AI Assistant", "/assistant"], ["Account Settings", "/settings"]];
  const nav = workspaceType === "individual" ? individualNav : companyNav;

  return <div className="shell">
    <aside className="side">
      <BrandMark />
      <div className="brandTagline">{workspaceType === "individual" ? "Personal Vehicle Intelligence" : "Fleet Telemetry & Tracking"}</div>
      <div className="links">
        <section><div className="group">{workspaceType === "individual" ? "MY VEHICLE" : "WORKSPACE"}</div>{nav.slice(0, workspaceType === "individual" ? 5 : 7).map(([label,href])=><Link className={href==="/" ? "nav active":"nav"} href={href} key={href}>{label}</Link>)}</section>
        <section><div className="group">{workspaceType === "individual" ? "SUPPORT" : "OPERATIONS"}</div>{nav.slice(workspaceType === "individual" ? 5 : 7, workspaceType === "individual" ? 8 : 12).map(([label,href])=><Link className="nav" href={href} key={href}>{label}</Link>)}</section>
        {workspaceType === "company" && <section><div className="group">MANAGEMENT</div>{nav.slice(12).map(([label,href])=><Link className="nav" href={href} key={href}>{label}</Link>)}</section>}
        {isSystemAdmin && <section><div className="group">PLATFORM</div><Link className="nav" href="/system-admin">System Administration</Link></section>}
      </div>
      <div className="notice">{workspaceType === "individual" ? "Your personal vehicle data is isolated from all company workspaces." : "Company workspaces are isolated by database-level organization permissions."}</div>
      <button className="secondaryButton" onClick={signOut}>Sign out</button>
    </aside>
    <main className="main">
      <div className="top"><div><div className="eyebrow">VEKTOR · {workspaceType === "individual" ? "PERSONAL VEHICLE INTELLIGENCE" : "FLEET TELEMETRY & TRACKING"}</div><h1>{workspaceType === "individual" ? "Vehicle overview" : "Fleet overview"}</h1><div className="muted">{email}</div></div><span className="pill">{loading ? "Loading workspace…" : workspaceName || "No active workspace"}</span></div>
      {error && <div className="notice" role="alert">{error}</div>}
      {!loading && !workspace && <div className="card onboarding"><div className="eyebrow">ACCESS REQUEST</div><h2>{applicationStatus === "pending" ? "Your request is under review" : applicationStatus === "approved" ? "Workspace approved" : applicationStatus === "rejected" ? "Application needs attention" : "Choose your VEKTOR environment"}</h2><p className="muted">{applicationStatus === "pending" ? "A system administrator is reviewing your request. Your private workspace will appear here once it is provisioned." : applicationStatus === "approved" ? "Your approval is recorded. Refresh or sign in again to load your workspace." : applicationStatus === "rejected" ? "Your latest request was not approved. Review the administrator's note or submit a revised request." : "Apply for a private company fleet workspace or an individual vehicle-owner workspace. Access is activated after administrator approval."}</p><Link className="primaryLink" href="/apply">{applicationStatus === "pending" ? "View application" : applicationStatus === "approved" ? "Check application" : "Request a workspace"}</Link></div>}
      {workspace && <div className="grid">
        {(workspaceType === "individual" ? [["Registered vehicles", counts.vehicles, "Your personal vehicle records"], ["Active journeys", counts.trips, "Journeys currently in progress"], ["Open alerts", counts.alerts, "Security and vehicle alerts"]] : [["Fleet vehicles", counts.vehicles, "Registered vehicles"], ["Drivers", counts.drivers, "Driver records"], ["Active trips", counts.trips, "Trips currently in progress"], ["Open alerts", counts.alerts, "Alerts awaiting acknowledgement"]]).map(([label,value,note])=><div className="card" key={String(label)}><div className="metric-label">{label}</div><div className="metric">{loading ? "—" : value}</div><div className="note">{note}</div></div>)}
      </div>}
      {workspace && <><div className="head"><h2>{workspaceType === "individual" ? "Vehicle tools" : "Fleet operations"}</h2><span className="pill">GPS status requires device data</span></div>
      <div className="grid actionGrid">
        <Link className="card actionCard" href="/vehicles"><div className="eyebrow">{workspaceType === "individual" ? "MY VEHICLE" : "FLEET"}</div><h3>{workspaceType === "individual" ? "Manage my vehicle" : "Manage vehicles"}</h3><div className="muted">{workspaceType === "individual" ? "Update your vehicle details and registration." : "Register vehicles and maintain fleet records."}</div></Link>
        {workspaceType === "company" && <Link className="card actionCard" href="/drivers"><div className="eyebrow">PEOPLE</div><h3>Manage drivers</h3><div className="muted">Maintain driver profiles and licence details.</div></Link>}
        <Link className="card actionCard" href="/devices"><div className="eyebrow">TRACKING</div><h3>GPS devices</h3><div className="muted">Register a supported tracking device and provider.</div></Link>
        <Link className="card actionCard" href="/assistant"><div className="eyebrow">ASSISTANCE</div><h3>VEKTOR AI assistant</h3><div className="muted">Get help with your vehicle and platform setup.</div></Link>
      </div>
      <div className="notice">A vehicle is only shown as live when a recent, validated GPS fix is available. Stale or missing telemetry is never labelled live.</div></>}
    </main>
  </div>;
}
