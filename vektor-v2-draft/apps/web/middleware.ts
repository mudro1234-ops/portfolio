import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE === "1" && !request.nextUrl.pathname.startsWith("/maintenance")
      && !request.nextUrl.pathname.startsWith("/api/ingest") && !request.nextUrl.pathname.startsWith("/_next")) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
