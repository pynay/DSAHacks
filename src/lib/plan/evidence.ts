// Evidence-chip vocabulary for a Forecast & Plan zone row: historical prior
// (model only) / field-verified · Nd / stale / overridden. A neighborhood's
// evidence comes from the *hotspots* that fall inside it (per /api/zones —
// hotspots are the model's clustering grain, neighborhoods are the plan's),
// so every lookup here joins ledger events and hotspot state through that
// neighborhood field rather than assuming zoneId === neighborhood id.
import type { DeliveryZone } from '@/lib/delivery';
import type { LedgerEvent, Override, PlanParams } from '@/lib/store/types';

export type EvidenceKind = 'historical' | 'verified' | 'stale' | 'overridden';

export interface ZoneEvidence {
  kind: EvidenceKind;
  daysSince?: number;
  label: string;
}

const DAY_MS = 86_400_000;

function daysBetween(fromISO: string, todayDateOnly: string): number {
  const fromDateOnly = fromISO.slice(0, 10);
  const diff = new Date(todayDateOnly + 'T00:00:00Z').getTime() - new Date(fromDateOnly + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round(diff / DAY_MS));
}

export function zoneEvidence(input: {
  neighborhoodId: string;
  zones: DeliveryZone[];
  ledger: LedgerEvent[];
  overrides: Override[];
  params: PlanParams;
  today: string;
}): ZoneEvidence {
  const { neighborhoodId, zones, ledger, overrides, params, today } = input;

  const active = overrides.find(
    (o) => o.zoneId === neighborhoodId && o.setAt.slice(0, 10) <= today && today <= o.expiresAt,
  );
  if (active) return { kind: 'overridden', label: 'overridden' };

  const hotspotIds = new Set(
    zones.filter((z) => z.neighborhood === neighborhoodId && z.predicted).map((z) => z.id),
  );

  const latestObservation = ledger
    .filter((e) => e.type === 'observation_applied' && e.zoneId && hotspotIds.has(e.zoneId))
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))[0];

  if (latestObservation) {
    const daysSince = daysBetween(latestObservation.ts, today);
    return daysSince > params.staleAfterDays
      ? { kind: 'stale', daysSince, label: 'stale' }
      : { kind: 'verified', daysSince, label: `field-verified · ${daysSince}d` };
  }

  // No ledger record, but the hotspot state itself shows a drone-updated
  // posterior (e.g. replayed observations) — fall back to its lastObservedAt.
  const updatedHotspot = zones
    .filter((z) => z.neighborhood === neighborhoodId && z.predicted && z.confidence === 'drone-updated')
    .sort((a, b) => (b.lastObservedAt ?? '').localeCompare(a.lastObservedAt ?? ''))[0];

  if (updatedHotspot) {
    const daysSince = updatedHotspot.lastObservedAt ? daysBetween(updatedHotspot.lastObservedAt, today) : 0;
    return daysSince > params.staleAfterDays
      ? { kind: 'stale', daysSince, label: 'stale' }
      : { kind: 'verified', daysSince, label: `field-verified · ${daysSince}d` };
  }

  return { kind: 'historical', label: 'historical prior' };
}
