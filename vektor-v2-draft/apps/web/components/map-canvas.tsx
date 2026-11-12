"use client";
import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type mapboxgl from "mapbox-gl";
import { MapPinOff } from "lucide-react";

export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  color: string;
  /** Stale / offline positions are drawn faded with a dashed ring, never like live ones. */
  dim?: boolean;
  label?: string;
  popup?: { title: string; lines: string[] };
}
export interface MapCircle { id: string; lng: number; lat: number; radius: number; color: string }
export interface MapPolygon { id: string; coords: [number, number][]; color: string }
export interface MapDraft {
  type: "circle" | "polygon";
  center?: [number, number];
  radius?: number;
  points?: [number, number][];
}

const ZIMBABWE: [number, number] = [29.8, -19.0];

function circlePolygon(lng: number, lat: number, radiusM: number, steps = 64): [number, number][] {
  const out: [number, number][] = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return out;
}

function featureCollection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

export function MapCanvas({
  markers = [], route, circles = [], polygons = [], draft, selectedId, scrubPoint, height = 420,
  fitKey, onMapClick, onMarkerClick, className,
}: {
  markers?: MapMarker[];
  route?: [number, number][];
  circles?: MapCircle[];
  polygons?: MapPolygon[];
  draft?: MapDraft | null;
  selectedId?: string | null;
  scrubPoint?: [number, number] | null;
  height?: number | string;
  /** Change this value to re-fit the view to the data. */
  fitKey?: string | number;
  onMapClick?: (lng: number, lat: number) => void;
  onMarkerClick?: (id: string) => void;
  className?: string;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const libRef = useRef<typeof mapboxgl | null>(null);
  const markerRefs = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const scrubRef = useRef<mapboxgl.Marker | null>(null);
  const clickRef = useRef(onMapClick);
  const markerClickRef = useRef(onMarkerClick);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  clickRef.current = onMapClick;
  markerClickRef.current = onMarkerClick;

  // Create the map once
  useEffect(() => {
    if (!token || !container.current) return;
    let cancelled = false;
    (async () => {
      try {
        const lib = (await import("mapbox-gl")).default;
        if (cancelled || !container.current) return;
        lib.accessToken = token;
        libRef.current = lib;
        const map = new lib.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: ZIMBABWE,
          zoom: 5,
          attributionControl: true,
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new lib.FullscreenControl(), "top-right");
        map.on("click", (e) => clickRef.current?.(e.lngLat.lng, e.lngLat.lat));
        map.on("load", () => {
          for (const id of ["route", "circles", "polygons", "draft"]) {
            map.addSource(id, { type: "geojson", data: featureCollection([]) });
          }
          map.addLayer({ id: "polygons-fill", type: "fill", source: "polygons", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.15 } });
          map.addLayer({ id: "polygons-line", type: "line", source: "polygons", paint: { "line-color": ["get", "color"], "line-width": 2 } });
          map.addLayer({ id: "circles-fill", type: "fill", source: "circles", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.15 } });
          map.addLayer({ id: "circles-line", type: "line", source: "circles", paint: { "line-color": ["get", "color"], "line-width": 2 } });
          map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#246BFD", "line-width": 4, "line-opacity": 0.85 } });
          map.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#246BFD", "fill-opacity": 0.2 } });
          map.addLayer({ id: "draft-line", type: "line", source: "draft", paint: { "line-color": "#246BFD", "line-width": 2, "line-dasharray": [2, 2] } });
          map.addLayer({ id: "draft-points", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#246BFD", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
          setReady(true);
        });
        mapRef.current = map;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current.clear();
      scrubRef.current?.remove();
      scrubRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  // Vehicle / point markers
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      let marker = markerRefs.current.get(m.id);
      const selected = m.id === selectedId;
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.addEventListener("click", (ev) => { ev.stopPropagation(); markerClickRef.current?.(m.id); });
        marker = new lib.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
        markerRefs.current.set(m.id, marker);
      }
      marker.setLngLat([m.lng, m.lat]);
      const el = marker.getElement();
      el.style.cssText = [
        "width:" + (selected ? 22 : 16) + "px", "height:" + (selected ? 22 : 16) + "px",
        "border-radius:9999px", "cursor:pointer", "padding:0",
        `background:${m.color}`, `opacity:${m.dim ? 0.55 : 1}`,
        `border:${m.dim ? "2px dashed #fff" : "2px solid #fff"}`,
        `box-shadow:0 0 0 ${selected ? 3 : 1}px ${selected ? "#246BFD" : "rgba(16,29,53,.35)"}`,
        "z-index:" + (selected ? 5 : 1),
      ].join(";");
      el.setAttribute("aria-label", m.label ?? m.id);
      el.title = m.label ?? "";
      marker.setPopup(null);
      if (m.popup) {
        const box = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = m.popup.title;
        box.appendChild(title);
        for (const line of m.popup.lines) {
          const p = document.createElement("div");
          p.style.fontSize = "12px";
          p.textContent = line;
          box.appendChild(p);
        }
        marker.setPopup(new lib.Popup({ offset: 14, closeButton: false }).setDOMContent(box));
      }
    }
    markerRefs.current.forEach((marker, id) => {
      if (!seen.has(id)) { marker.remove(); markerRefs.current.delete(id); }
    });
  }, [markers, selectedId, ready]);

  // Geometry layers
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const set = (id: string, fc: GeoJSON.FeatureCollection) => (map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData(fc);
    set("route", featureCollection(route && route.length > 1
      ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } }] : []));
    set("circles", featureCollection(circles.map((c) => ({
      type: "Feature", properties: { color: c.color },
      geometry: { type: "Polygon", coordinates: [circlePolygon(c.lng, c.lat, c.radius)] },
    }))));
    set("polygons", featureCollection(polygons.filter((p) => p.coords.length >= 3).map((p) => ({
      type: "Feature", properties: { color: p.color },
      geometry: { type: "Polygon", coordinates: [[...p.coords, p.coords[0]]] },
    }))));
    const draftFeatures: GeoJSON.Feature[] = [];
    if (draft?.type === "circle" && draft.center) {
      draftFeatures.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: draft.center } });
      if (draft.radius && draft.radius > 0) {
        draftFeatures.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circlePolygon(draft.center[0], draft.center[1], draft.radius)] } });
      }
    }
    if (draft?.type === "polygon" && draft.points?.length) {
      draft.points.forEach((pt) => draftFeatures.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: pt } }));
      if (draft.points.length >= 3) {
        draftFeatures.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...draft.points, draft.points[0]]] } });
      } else if (draft.points.length === 2) {
        draftFeatures.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: draft.points } });
      }
    }
    set("draft", featureCollection(draftFeatures));
  }, [route, circles, polygons, draft, ready]);

  // Playback position
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    if (!scrubPoint) { scrubRef.current?.remove(); scrubRef.current = null; return; }
    if (!scrubRef.current) {
      const el = document.createElement("div");
      el.style.cssText = "width:18px;height:18px;border-radius:9999px;background:#101D35;border:3px solid #fff;box-shadow:0 0 0 2px #246BFD";
      scrubRef.current = new lib.Marker({ element: el }).setLngLat(scrubPoint).addTo(map);
    } else scrubRef.current.setLngLat(scrubPoint);
  }, [scrubPoint, ready]);

  // Fit view
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const pts: [number, number][] = [];
    markers.forEach((m) => pts.push([m.lng, m.lat]));
    route?.forEach((p) => pts.push(p));
    circles.forEach((c) => pts.push([c.lng, c.lat]));
    polygons.forEach((p) => p.coords.forEach((c) => pts.push(c)));
    if (pts.length === 0) return;
    const bounds = new lib.LngLatBounds(pts[0], pts[0]);
    pts.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  // Fly to the selected marker
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const m = markers.find((x) => x.id === selectedId);
    if (m) map.flyTo({ center: [m.lng, m.lat], zoom: Math.max(map.getZoom(), 13), duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  if (!token) {
    return (
      <div style={{ height }} className={`flex flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center ${className ?? ""}`}>
        <MapPinOff className="h-6 w-6 text-muted" aria-hidden />
        <p className="text-sm font-medium text-ink">Map unavailable</p>
        <p className="max-w-sm text-xs text-muted">Add a Mapbox public token as NEXT_PUBLIC_MAPBOX_TOKEN to show the map. Vehicle data is still recorded and listed.</p>
      </div>
    );
  }
  if (failed) {
    return <div style={{ height }} className={`flex items-center justify-center bg-slate-50 text-sm text-muted ${className ?? ""}`}>The map could not be loaded. Check your connection and refresh.</div>;
  }
  return <div ref={container} style={{ height }} className={className} role="application" aria-label="Map" />;
}
