export function formatDateTime(value: string | Date | null | undefined, timeZone = "Africa/Harare"): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone,
  }).format(d);
}

export function formatDate(value: string | Date | null | undefined, timeZone = "Africa/Harare"): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone }).format(d);
}

/** "3 min ago", "2 h ago", "5 d ago" - used next to every GPS timestamp. */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "never";
  const d = typeof value === "string" ? new Date(value) : value;
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < -60) return "in the future";
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs} s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function formatKm(value: number | string | null | undefined, digits = 1): string {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toLocaleString("en-GB", { maximumFractionDigits: digits })} km`;
}

export function formatMoney(value: number | string | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || value === "") return "-";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value));
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
}

export function formatDuration(start?: string | null, end?: string | null): string {
  if (!start) return "-";
  const to = end ? new Date(end).getTime() : Date.now();
  const mins = Math.max(0, Math.round((to - new Date(start).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
