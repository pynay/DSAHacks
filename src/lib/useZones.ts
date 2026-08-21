'use client';

// Client hook for model-derived delivery zones served by /api/zones.
import { useCallback, useEffect, useState } from 'react';
import type { DeliveryZone, HotspotMeta } from './delivery';

interface ZonesResponse {
  zones: DeliveryZone[];
  meta: HotspotMeta | null;
}

async function fetchZones(signal?: AbortSignal): Promise<ZonesResponse> {
  const response = await fetch('/api/zones', { signal });
  const data = await response.json();
  if (!response.ok || !data.zones) throw new Error(data.error || 'Failed to load zones');
  return { zones: data.zones, meta: data.meta ?? null };
}

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
      const data = await fetchZones();
      setZones(data.zones);
      setMeta(data.meta);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load zones');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchZones(controller.signal)
      .then((data) => {
        setZones(data.zones);
        setMeta(data.meta);
        setError(null);
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(cause instanceof Error ? cause.message : 'Failed to load zones');
        }
      });
    return () => controller.abort();
  }, []);

  return { zones, meta, error, refresh };
}
