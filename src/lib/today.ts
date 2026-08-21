// Today dashboard: a ranked attention list pulled from the store + the
// zone evidence already computed for Forecast & Plan. Pure — no fetches,
// no storage; the page supplies inventory/drafts/overrides from
// useInventory() and per-zone evidence from zoneEvidence().
import type { InventoryItem } from '@/lib/types';
import type { DistributionDraft, Override } from '@/lib/store/types';
import type { ZoneEvidence } from '@/lib/plan/evidence';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  severity: AttentionSeverity;
  title: string;
  detail: string;
  href: string;
}

export interface ZoneEvidenceEntry {
  id: string;
  label: string;
  evidence: ZoneEvidence;
}

const DAY_MS = 86_400_000;

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (new Date(toISO + 'T00:00:00Z').getTime() - new Date(fromISO + 'T00:00:00Z').getTime()) / DAY_MS,
  );
}

export function attentionItems(input: {
  inventory: InventoryItem[];
  zonesEvidence: ZoneEvidenceEntry[];
  drafts: DistributionDraft[];
  overrides: Override[];
  today: string;
}): AttentionItem[] {
  const { inventory, zonesEvidence, drafts, overrides, today } = input;
  const items: AttentionItem[] = [];

  // Expiring within 7 days (in-stock items only; an already-empty item is
  // covered by the reorder check below, not here).
  for (const item of inventory) {
    if (item.quantity <= 0) continue;
    const daysLeft = daysBetween(today, item.expirationDate);
    if (daysLeft <= 7) {
      items.push({
        severity: daysLeft <= 2 ? 'critical' : 'warning',
        title: `${item.name} expiring ${daysLeft <= 0 ? 'today' : `in ${daysLeft}d`}`,
        detail: `${item.quantity} ${item.unit} at ${item.location}`,
        href: '/inventory',
      });
    }
  }

  // Below reorder threshold (includes out-of-stock).
  for (const item of inventory) {
    if (item.quantity <= item.reorderThreshold) {
      items.push({
        severity: item.quantity <= 0 ? 'critical' : 'warning',
        title: `${item.name} below reorder threshold`,
        detail: `${item.quantity} ${item.unit} on hand · reorder at ${item.reorderThreshold}`,
        href: '/inventory',
      });
    }
  }

  // Stale neighborhood evidence.
  for (const z of zonesEvidence) {
    if (z.evidence.kind === 'stale') {
      items.push({
        severity: 'warning',
        title: `${z.label} evidence is stale`,
        detail:
          z.evidence.daysSince !== undefined
            ? `Last field verification ${z.evidence.daysSince}d ago`
            : 'No recorded field verification',
        href: '/signals',
      });
    }
  }

  // Staged runs not yet distributed.
  for (const d of drafts) {
    if (d.status === 'staged') {
      items.push({
        severity: 'info',
        title: `${d.zoneLabel} run staged, not distributed`,
        detail: `${Math.round(d.meals)} meals staged ${d.stagedAt.slice(0, 10)}`,
        href: '/distributions',
      });
    }
  }

  // Overrides expiring within 3 days.
  for (const o of overrides) {
    const daysLeft = daysBetween(today, o.expiresAt);
    if (daysLeft >= 0 && daysLeft <= 3) {
      const label = zonesEvidence.find((z) => z.id === o.zoneId)?.label ?? o.zoneId;
      items.push({
        severity: 'warning',
        title: `${label} override expiring ${daysLeft <= 0 ? 'today' : `in ${daysLeft}d`}`,
        detail: o.reason,
        href: '/signals',
      });
    }
  }

  const rank: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
