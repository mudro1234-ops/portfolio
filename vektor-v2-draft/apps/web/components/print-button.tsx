"use client";
import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "sm")}><Printer className="h-4 w-4" /> Print</button>;
}
