'use client';

// Client hook for the DuckDB-derived delivery zones served by /api/zones.
import { useEffect, useState } from 'react';
import type { DeliveryZone } from './delivery';

export function useZones(): { zones: DeliveryZone[]; error: string | null } {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/zones')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.zones) setZones(d.zones);
        else setError(d.error || 'Failed to load zones');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load zones');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { zones, error };
}
