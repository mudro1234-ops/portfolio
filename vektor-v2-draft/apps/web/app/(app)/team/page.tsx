import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can, invitableRoles, ROLE_LABELS, type Role } from "@/lib/permissions";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Table, Td, Th } from "@/components/ui";
import { InviteForm, MemberActions, RevokeInvitationButton } from "@/components/team-controls";
import { GENERIC_TONE } from "@/lib/status";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Team & Permissions" };

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, including billing and ownership.",
  admin: "Manages users, settings, vehicles, drivers and devices. Cannot manage billing or other administrators.",
  fleet_manager: "Supervises the fleet: vehicles, drivers, trips, geofences, alerts, maintenance, fuel and reports.",
  dispatcher: "Coordinates vehicles and drivers, monitors trips and responds to alerts. No billing or configuration.",
  driver: "Uses the mobile app for assigned vehicle and tracking only.",
  analyst: "Read-only access to fleet data and reports.",
};

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ email?: string; role?: string }> }) {
  const ctx = await requireCapability("team");
  const sp = await searchParams;
  const supabase = await createClient();
  const canManage = can(ctx.role, "team.manage");
  const assignable = invitableRoles(ctx.role);

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("organization_memberships").select("user_id,role,status,created_at").eq("organization_id", ctx.org.id).order("created_at"),
    canManage ? supabase.from("organization_invitations").select("id,email,role,status,expires_at,created_at").eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
  ]);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length ? await supabase.from("user_profiles").select("id,full_name,email").in("id", ids) : { data: [] };
  const profileOf = new Map((profiles ?? []).map((p) => [p.id, p]));
  const active = (members ?? []).filter((m) => m.status !== "removed");

  return (
    <>
      <PageHeader title="Team & permissions" description="Invite colleagues, assign roles and control who can access your workspace." />
      <div className="mb-6"><Notice tone="blue">Roles are enforced by the database, not just by hiding buttons. Changes to roles and access are recorded in the audit log.</Notice></div>

      {canManage && assignable.length > 0 && (
        <Card className="mb-6"><CardHeader title="Invite a team member" description="They will join with the role you choose." /><div className="p-5"><InviteForm roles={assignable} defaultEmail={sp.email} defaultRole={sp.role} /></div></Card>
      )}

      <Card className="mb-6">
        <CardHeader title="Members" description={`${active.length} with access`} />
        {active.length === 0 ? <EmptyState icon={<Users className="h-6 w-6" />} title="No members" /> : (
          <Table><thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th>{canManage && <Th />}</tr></thead><tbody>
            {active.map((m) => {
              const p = profileOf.get(m.user_id);
              return (
                <tr key={m.user_id}>
                  <Td className="font-medium">{p?.full_name ?? "Member"}</Td><Td>{p?.email ?? "-"}</Td>
                  <Td>{ROLE_LABELS[m.role as Role]}</Td><Td><Badge tone={GENERIC_TONE[m.status]}>{titleCase(m.status)}</Badge></Td>
                  {canManage && <Td><MemberActions userId={m.user_id} role={m.role as Role} status={m.status} isSelf={m.user_id === ctx.userId} assignable={assignable} canTransfer={ctx.role === "owner"} /></Td>}
                </tr>
              );
            })}
          </tbody></Table>
        )}
      </Card>

      {canManage && (invites ?? []).length > 0 && (
        <Card className="mb-6"><CardHeader title="Invitations" />
          <Table><thead><tr><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Expires</Th><Th /></tr></thead><tbody>
            {(invites ?? []).map((i) => (
              <tr key={i.id}><Td>{i.email}</Td><Td>{ROLE_LABELS[i.role as Role]}</Td><Td><Badge tone={GENERIC_TONE[i.status]}>{titleCase(i.status)}</Badge></Td><Td>{formatDateTime(i.expires_at, ctx.org.timezone)}</Td><Td className="text-right">{i.status === "pending" && <RevokeInvitationButton id={i.id} />}</Td></tr>
            ))}
          </tbody></Table></Card>
      )}

      <Card><CardHeader title="What each role can do" />
        <dl className="divide-y divide-slate-100">{(Object.keys(ROLE_LABELS) as Role[]).map((r) => (<div key={r} className="grid gap-1 px-5 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-medium text-ink">{ROLE_LABELS[r]}</dt><dd className="text-sm text-muted">{ROLE_DESCRIPTIONS[r]}</dd></div>))}</dl></Card>
    </>
  );
}
