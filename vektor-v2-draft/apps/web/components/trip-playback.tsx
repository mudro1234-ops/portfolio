"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { MapCanvas } from "@/components/map-canvas";
import { buttonClass } from "@/components/ui";

export interface PlaybackPoint { lng: number; lat: number; t: string; speed: number | null }

export function TripPlayback({ points, timezone }: { points: PlaybackPoint[]; timezone: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const route = useMemo(() => points.map((p) => [p.lng, p.lat] as [number, number]), [points]);
  const current = points[Math.min(index, points.length - 1)];

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setIndex((i) => {
        if (i >= points.length - 1) { setPlaying(false); return i; }
        return i + Math.max(1, Math.round(points.length / 150));
      });
    }, 120);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, points.length]);

  if (points.length < 2) {
    return <p className="px-5 py-10 text-center text-sm text-muted">No GPS points were recorded for this trip, so there is no route to show.</p>;
  }
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "short", timeZone: timezone }).format(new Date(iso));
  return (
    <div>
      <MapCanvas route={route} scrubPoint={current ? [current.lng, current.lat] : null} height={380} fitKey={route.length} />
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-5 py-4">
        <button type="button" className={buttonClass("secondary", "sm")} onClick={() => { if (index >= points.length - 1) setIndex(0); setPlaying((p) => !p); }}>
          {playing ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Play route</>}
        </button>
        <input type="range" min={0} max={points.length - 1} value={Math.min(index, points.length - 1)} onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} aria-label="Route position" className="min-w-[160px] flex-1 accent-brand" />
        <p className="text-xs text-muted">{current ? `${fmt(current.t)} - ${current.speed !== null ? Math.round(current.speed) : "?"} km/h` : ""}</p>
      </div>
    </div>
  );
}
