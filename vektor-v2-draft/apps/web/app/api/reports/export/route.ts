import { NextResponse, type NextRequest } from "next/server";
import { getAppContext } from "@/lib/context";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { isReportType, runReport, toCsv } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getAppContext();
  if (!can(ctx.role, "reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") ?? undefined;
  if (!isReportType(type)) return NextResponse.json({ error: "Unknown report" }, { status: 400 });

  const supabase = await createClient();
  const result = await runReport(supabase, ctx.org.id, type, {
    from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined,
    vehicle: sp.get("vehicle") ?? undefined, driver: sp.get("driver") ?? undefined,
  }, ctx.org.timezone);

  const safeOrg = ctx.org.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(toCsv(result), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vektor-${safeOrg}-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
