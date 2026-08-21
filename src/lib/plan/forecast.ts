// Pure resource-plan engine: zone (neighborhood) x week grid of counted-unit
// need (with band) and the meals/hours/runs it implies. No fetches, no
// storage — everything comes in as arguments so this is trivially testable
// and reusable from the page and (later) Allocate.
import type { DeliveryZone } from '@/lib/delivery';
import type { OutlookPayload } from '@/lib/outlookServer';
import type { Override, PlanParams } from '@/lib/store/types';

const DAY_MS = 86_400_000;

// The forecast's grain: the six downtown neighborhoods (not the model's
// hotspot clusters — those can double up in one neighborhood or miss one
// entirely; see /api/zones). Grid rows, always in this order.
export const NEIGHBORHOODS: { id: string; label: string }[] = [
  { id: 'east_village', label: 'East Village' },
  { id: 'city_center', label: 'City Center' },
  { id: 'columbia', label: 'Columbia' },
  { id: 'marina', label: 'Marina' },
  { id: 'cortez', label: 'Cortez' },
  { id: 'gaslamp', label: 'Gaslamp' },
];

export interface PlanCell {
  need: number;
  lo: number;
  hi: number;
  meals: number;
  hours: number;
  runs: number;
  overridden: boolean;
}

export interface PlanGrid {
  weeks: string[]; // Monday ISO dates
  zones: { id: string; label: string }[];
  cells: Record<string, Record<string, PlanCell>>; // cells[zoneId][week]
  totals: Record<string, { meals: number; hours: number; runs: number; need: number; lo: number; hi: number }>;
}

function mondayOf(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getTime() + diff * DAY_MS).toISOString().slice(0, 10);
}

function addDaysISO(dateISO: string, n: number): string {
  return new Date(new Date(dateISO + 'T00:00:00Z').getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

function weeksFrom(today: string, horizonWeeks: number): string[] {
  const start = mondayOf(today);
  return Array.from({ length: horizonWeeks }, (_, i) => addDaysISO(start, i * 7));
}

function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

function daysInMonth(monthKeyStr: string): number {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function activeOverride(overrides: Override[], zoneId: string, today: string): Override | undefined {
  return overrides.find(
    (o) => o.zoneId === zoneId && o.setAt.slice(0, 10) <= today && today <= o.expiresAt,
  );
}

export function buildPlanGrid(input: {
  outlook: OutlookPayload;
  zones: DeliveryZone[];
  params: PlanParams;
  overrides: Override[];
  today: string;
}): PlanGrid {
  const { outlook, zones, params, overrides, today } = input;
  const weeks = weeksFrom(today, params.horizonWeeks);
  const currentMonth = monthKey(today);

  const totals: PlanGrid['totals'] = {};
  for (const w of weeks) totals[w] = { meals: 0, hours: 0, runs: 0, need: 0, lo: 0, hi: 0 };

  const cells: PlanGrid['cells'] = {};

  for (const nb of NEIGHBORHOODS) {
    const rows = outlook.byNeighborhood[nb.id] ?? [];
    const rowByMonth = new Map(rows.map((r) => [r.month, r]));

    // Current-month anchor: if a field observation has updated a hotspot in
    // this neighborhood, scale the model's current-month value toward the
    // field estimate (capped 0.5-2x), keeping the band's absolute width.
    const hotspotsHere = zones.filter((z) => z.neighborhood === nb.id && z.predicted);
    const updated = hotspotsHere.filter((z) => z.confidence === 'drone-updated');
    let scale = 1;
    if (updated.length > 0) {
      const modelPrior = rowByMonth.get(currentMonth)?.value ?? 0;
      if (modelPrior > 0) {
        const fieldNeed = updated.reduce((sum, z) => sum + z.need, 0);
        scale = Math.min(2, Math.max(0.5, fieldNeed / modelPrior));
      }
    }

    const override = activeOverride(overrides, nb.id, today);
    const rowCells: Record<string, PlanCell> = {};

    for (const w of weeks) {
      const m = monthKey(w);
      const row = rowByMonth.get(m);
      let value = row?.value ?? 0;
      let lo = row?.lo ?? 0;
      let hi = row?.hi ?? 0;

      if (m === currentMonth && scale !== 1) {
        const width = hi - lo;
        value *= scale;
        lo = value - width / 2;
        hi = value + width / 2;
      }

      const days = daysInMonth(m);
      const weekShare = 7 / days;
      let need = value * weekShare * params.coverageShare;
      let cLo = lo * weekShare * params.coverageShare;
      let cHi = hi * weekShare * params.coverageShare;

      const overridden = Boolean(override);
      if (override) {
        if (override.mode === 'factor') {
          need *= override.value;
          cLo *= override.value;
          cHi *= override.value;
        } else {
          const ratio = need > 0 ? override.value / need : 1;
          need = override.value;
          cLo *= ratio;
          cHi *= ratio;
        }
      }

      need = Math.max(0, need);
      cLo = Math.max(0, cLo);
      cHi = Math.max(cLo, cHi);

      const plan = params.planTo === 'point' ? need : cHi;
      const visits = params.visitsPerWeek[nb.id] ?? 1;
      const meals = plan * params.mealsPerPerson * visits;
      const runs = Math.ceil(meals / params.vehicleCapacity);
      const hours = runs * params.hoursPerRun;

      rowCells[w] = { need, lo: cLo, hi: cHi, meals, hours, runs, overridden };

      totals[w].meals += meals;
      totals[w].hours += hours;
      totals[w].runs += runs;
      totals[w].need += need;
      totals[w].lo += cLo;
      totals[w].hi += cHi;
    }

    cells[nb.id] = rowCells;
  }

  return { weeks, zones: NEIGHBORHOODS, cells, totals };
}
