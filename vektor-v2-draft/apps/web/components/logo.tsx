import clsx from "clsx";

export function Logo({ light = false, subtitle = true, className }: { light?: boolean; subtitle?: boolean; className?: string }) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill={light ? "#246BFD" : "#101D35"} />
        <path d="M14 18h10l8 22 8-22h10L36 48h-8z" fill={light ? "#ffffff" : "#246BFD"} />
      </svg>
      <div className="leading-none">
        <div className={clsx("text-lg font-bold tracking-[0.12em]", light ? "text-white" : "text-navy")}>VEKTOR</div>
        {subtitle && <div className={clsx("mt-1 text-[10px] font-medium tracking-[0.2em]", light ? "text-slate-400" : "text-muted")}>FLEET INTELLIGENCE</div>}
      </div>
    </div>
  );
}
