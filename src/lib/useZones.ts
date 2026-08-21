'use client';

// Client hook for model-derived delivery zones served by /api/zones.
import { useEffect, useState } from 'react';
import type { DeliveryZone, HotspotMeta } from './delivery';

export function useZones(): { zones: DeliveryZone[]; meta: HotspotMeta | null; error: string | null } {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [meta, setMeta] = useState<HotspotMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/zones')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.zones) {
          setZones(d.zones);
          setMeta(d.meta ?? null);
        }
        else setError(d.error || 'Failed to load zones');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load zones');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { zones, meta, error };
}
