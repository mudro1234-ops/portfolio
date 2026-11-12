"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastItem = { id: number; message: string; kind: "success" | "error" };
const EVENT = "vektor:toast";

export function toast(message: string, kind: "success" | "error" = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    let counter = 0;
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent).detail;
      const id = ++counter;
      setItems((cur) => [...cur, { id, message, kind }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 5000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={clsx(
          "pointer-events-auto flex items-start gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm shadow-lg",
          t.kind === "success" ? "border-emerald-200" : "border-red-200")}>
          {t.kind === "success"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden />}
          <p className="flex-1 text-ink">{t.message}</p>
          <button onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
