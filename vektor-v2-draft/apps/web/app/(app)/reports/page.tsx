import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, Pagination, Stat, Table, Td, Th, buttonClass, inputClass, labelClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { REPORT_TYPES, defaultRange, isReportType, runReport } from "@/lib/reports";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };
const PER_PAGE = 50;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string; from?: string; to?: string; vehicle?: string; driver?: string; page?: string }> }) {
  const ctx = await requireCapability("reports");
  const sp = await searchParams;
  const type = isReportType(sp.type) ? sp.type : "utilisation";
  const meta = REPORT_TYPES.find((t) => t.id === type)!;
  const range = defaultRange();
  const from = sp.from ?? range.from;
  const to = sp.to ?? range.to;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  const [result, { data: vehicles }, { data: drivers }] = await Promise.all([
    runReport(supabase, ctx.org.id, type, { from, to, vehicle: sp.vehicle, driver: sp.driver }, ctx.org.timezone),
    supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).order("registration_number"),
    supabase.from("drivers").select("id,full_name").eq("organization_id", ctx.org.id).order("full_name"),
  ]);
  const exportQs = new URLSearchParams({ type, from, to, ...(sp.vehicle ? { vehicle: sp.vehicle } : {}), ...(sp.driver ? { driver: sp.driver } : {}) }).toString();
  const slice = result.rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <PageHeader title="Reports" description="Turn your fleet records into decisions. Reports respect your role's access to data."
        actions={<><PrintButton /><a href={`/api/reports/export?${exportQs}`} className={buttonClass("primary", "sm")}><Download className="h-4 w-4" /> Export CSV</a></>} />
      <Card className="no-print mb-6">
        <form method="get" className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="lg:col-span-2"><label htmlFor="type" className={labelClass}>Report</label>
            <select id="type" name="type" defaultValue={type} className={inputClass}>{REPORT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          <div><label htmlFor="from" className={labelClass}>From</label><input id="from" type="date" name="from" defaultValue={from} className={inputClass} /></div>
          <div><label htmlFor="to" className={labelClass}>To</label><input id="to" type="date" name="to" defaultValue={to} className={inputClass} /></div>
          <div><label htmlFor="vehicle" className={labelClass}>Vehicle</label><select id="vehicle" name="vehicle" defaultValue={sp.vehicle ?? ""} className={inputClass}><option value="">All</option>{(vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}</select></div>
          <div><label htmlFor="driver" className={labelClass}>Driver</label><select id="driver" name="driver" defaultValue={sp.driver ?? ""} className={inputClass}><option value="">All</option>{(drivers ?? []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
          <div className="flex gap-2 lg:col-span-6"><button type="submit" className={buttonClass("primary", "sm")}>Run report</button><LinkButton href="/reports" variant="ghost" size="sm">Reset</LinkButton></div>
        </form>
      </Card>

      <div className="mb-4"><h2 className="text-lg font-semibold text-ink">{meta.label}</h2><p className="text-sm text-muted">{meta.description} {type !== "availability" && type !== "connectivity" ? `${formatDate(from)} to ${formatDate(to)}.` : ""} {ctx.org.name}.</p></div>
      {result.note && <div className="mb-4"><Notice tone="blue">{result.note}</Notice></div>}
      {result.truncated && <div className="mb-4"><Notice tone="amber">This report is limited to the first 5,000 rows. Narrow the date range or choose a vehicle.</Notice></div>}
      {result.summary.length > 0 && <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{result.summary.map((s) => <Stat key={s.label} label={s.label} value={s.value} />)}</div>}
      <Card>
        <CardHeader title="Results" description={`${result.rows.length.toLocaleString()} row${result.rows.length === 1 ? "" : "s"}`} />
        {result.rows.length === 0 ? <EmptyState title="No data for these filters" description="Try a wider date range or a different vehicle." /> : (
          <>
            <Table><thead><tr>{result.columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead><tbody>
              {slice.map((row, i) => <tr key={i} className="hover:bg-slate-50">{row.map((cell, j) => <Td key={j} className={typeof cell === "number" ? "tabular-nums" : ""}>{typeof cell === "number" ? cell.toLocaleString("en-GB") : cell || "-"}</Td>)}</tr>)}
            </tbody></Table>
            <Pagination page={page} pageSize={PER_PAGE} total={result.rows.length} basePath="/reports" params={{ type, from, to, vehicle: sp.vehicle, driver: sp.driver }} />
          </>
        )}
      </Card>
    </>
  );
}
