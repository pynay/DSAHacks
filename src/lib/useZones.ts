'use client';

// Client hook for model-derived delivery zones served by /api/zones.
import { useCallback, useEffect, useState } from 'react';
import type { DeliveryZone, HotspotMeta } from './delivery';

export function useZones(): {
  zones: DeliveryZone[];
  meta: HotspotMeta | null;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [meta, setMeta] = useState<HotspotMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/zones');
      const data = await response.json();
      if (!response.ok || !data.zones) throw new Error(data.error || 'Failed to load zones');
      setZones(data.zones);
      setMeta(data.meta ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load zones');
    }
  }, []);

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

  return { zones, meta, error, refresh };
}
