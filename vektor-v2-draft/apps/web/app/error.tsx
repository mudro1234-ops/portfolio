"use client";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white shadow-card">
        <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Something went wrong"
          description={`We could not load this page.${error.digest ? ` Reference: ${error.digest}` : ""}`}
          action={<button onClick={reset} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Try again</button>} />
      </div>
    </div>
  );
}
