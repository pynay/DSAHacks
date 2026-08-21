// Field-gated allocation recommender: callers supply only zones that contain
// reviewed field evidence, then this module recommends how many units of which
// items to stage.
//
// Method (deterministic, explainable):
//   1. Each eligible zone's demand = updated estimate x unitsPerPerson.
//   2. Items ship soonest-expiring first (FEFO), so perishables move before
//      they are lost.
//   3. Each item's quantity is split across zones proportionally to each
//      zone's REMAINING demand, using largest-remainder rounding so every
//      unit lands somewhere and no zone exceeds its demand.
//   4. Allocation stops when demand is met or stock runs out, whichever
//      comes first.
import type { InventoryItem } from './types';
import type { DeliveryZone } from './delivery';

export interface AllocatedItem {
  name: string;
  category: string;
  unit: string;
  quantity: number;
}

export interface ZoneAllocation {
  zoneId: string;
  label: string;
  need: number;
  demand: number; // need x unitsPerPerson
  allocated: number; // total units assigned to this zone
  coverage: number; // allocated / demand (0 when demand is 0)
  items: AllocatedItem[];
}

export interface AllocationResult {
  zones: ZoneAllocation[];
  totalDemand: number;
  totalAllocated: number;
  coverage: number; // totalAllocated / totalDemand (0 when demand is 0)
  unitsLeft: number; // stock remaining after allocation
}

/** Keep historical priors visible for planning without allowing them to stage inventory. */
export function allocationEligibleZones(zones: DeliveryZone[]): DeliveryZone[] {
  return zones.filter((zone) => zone.confidence === 'drone-updated');
}

// Predictive mode: keep the SAME total need but re-split it across zones by
// forecast weights (e.g. predicted next-month 311 volume). Largest-remainder
// rounding preserves the total exactly. Zones with no weight get 0; if no
// zone has a usable weight, the input is returned unchanged.
export function redistributeNeed(
  zones: DeliveryZone[],
  weightById: Record<string, number>,
): DeliveryZone[] {
  const totalNeed = zones.reduce((s, z) => s + z.need, 0);
  const totalWeight = zones.reduce((s, z) => s + Math.max(0, weightById[z.id] ?? 0), 0);
  if (totalNeed <= 0 || totalWeight <= 0) return zones;

  const exact = zones.map((z) => (totalNeed * Math.max(0, weightById[z.id] ?? 0)) / totalWeight);
  const need = exact.map(Math.floor);
  let leftover = totalNeed - need.reduce((s, n) => s + n, 0);
  const byFraction = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byFraction) {
    if (leftover <= 0) break;
    need[i]++;
    leftover--;
  }
  return zones.map((z, i) => ({ ...z, need: need[i] }));
}

export function allocate(
  inventory: InventoryItem[],
  zones: DeliveryZone[],
  unitsPerPerson = 3,
): AllocationResult {
  const targets = zones
    .filter((z) => z.need > 0)
    .map((z) => {
      const demand = Math.round(z.need * unitsPerPerson);
      return {
        zoneId: z.id,
        label: z.label,
        need: z.need,
        demand,
        remaining: demand,
        allocated: 0,
        items: [] as AllocatedItem[],
      };
    });

  const totalStock = inventory.reduce((s, i) => s + i.quantity, 0);
  const totalDemand = targets.reduce((s, t) => s + t.demand, 0);

  // FEFO: soonest-expiring stock ships first.
  const stock = inventory
    .filter((i) => i.quantity > 0)
    .slice()
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));

  for (const item of stock) {
    const totalRemaining = targets.reduce((s, t) => s + t.remaining, 0);
    if (totalRemaining === 0) break;
    const toSend = Math.min(item.quantity, totalRemaining);

    // Proportional split with largest-remainder rounding.
    const shares = targets.map((t) => (toSend * t.remaining) / totalRemaining);
    const assigned = shares.map(Math.floor);
    let leftover = toSend - assigned.reduce((s, n) => s + n, 0);
    const byFraction = shares
      .map((s, i) => ({ i, frac: s - Math.floor(s) }))
      .sort((a, b) => b.frac - a.frac);
    for (const { i } of byFraction) {
      if (leftover <= 0) break;
      if (assigned[i] < targets[i].remaining) {
        assigned[i]++;
        leftover--;
      }
    }
    // Safety sweep: park any residue in zones that still have headroom.
    for (let i = 0; i < targets.length && leftover > 0; i++) {
      const headroom = targets[i].remaining - assigned[i];
      const add = Math.min(headroom, leftover);
      assigned[i] += add;
      leftover -= add;
    }

    assigned.forEach((qty, i) => {
      if (qty > 0) {
        targets[i].items.push({ name: item.name, category: item.category, unit: item.unit, quantity: qty });
        targets[i].allocated += qty;
        targets[i].remaining -= qty;
      }
    });
  }

  const totalAllocated = targets.reduce((s, t) => s + t.allocated, 0);
  return {
    zones: targets.map(({ zoneId, label, need, demand, allocated, items }) => ({
      zoneId,
      label,
      need,
      demand,
      allocated,
      coverage: demand > 0 ? allocated / demand : 0,
      items,
    })),
    totalDemand,
    totalAllocated,
    coverage: totalDemand > 0 ? totalAllocated / totalDemand : 0,
    unitsLeft: totalStock - totalAllocated,
  };
}
