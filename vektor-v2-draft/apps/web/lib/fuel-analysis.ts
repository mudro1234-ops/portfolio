export interface FuelRow {
  id: string; vehicle_id: string; fueled_at: string; litres: number; total_cost: number; currency: string; odometer_km: number | null;
}

export interface FuelInsight {
  /** Litres per 100 km between this fill-up and the previous one for the same vehicle (recorded values only). */
  l_per_100km: number | null;
  unusual: boolean;
}

/**
 * Recorded purchases are NOT independently verified consumption. These figures only compare
 * a vehicle's own odometer-based fill-ups; a fill-up is flagged when it is 30%+ worse than
 * that vehicle's median.
 */
export function analyseFuel(rows: FuelRow[]): Map<string, FuelInsight> {
  const out = new Map<string, FuelInsight>();
  const byVehicle = new Map<string, FuelRow[]>();
  rows.forEach((r) => byVehicle.set(r.vehicle_id, [...(byVehicle.get(r.vehicle_id) ?? []), r]));

  byVehicle.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.fueled_at.localeCompare(b.fueled_at) || (a.odometer_km ?? 0) - (b.odometer_km ?? 0));
    const values: { id: string; v: number }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.odometer_km != null && cur.odometer_km != null && cur.odometer_km > prev.odometer_km) {
        // litres bought now cover the distance driven since the previous fill (full-tank assumption)
        const l100 = (Number(cur.litres) / (cur.odometer_km - prev.odometer_km)) * 100;
        if (Number.isFinite(l100) && l100 > 0 && l100 < 200) values.push({ id: cur.id, v: l100 });
      }
    }
    const sortedVals = values.map((x) => x.v).sort((a, b) => a - b);
    const median = sortedVals.length ? sortedVals[Math.floor(sortedVals.length / 2)] : null;
    list.forEach((r) => out.set(r.id, { l_per_100km: null, unusual: false }));
    values.forEach(({ id, v }) => out.set(id, { l_per_100km: v, unusual: median !== null && sortedVals.length >= 3 && v > median * 1.3 }));
  });
  return out;
}
