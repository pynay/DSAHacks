'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { InventoryItem, Donation, Distribution } from '@/lib/types';
import { applyDonation, applyDistribution, newId } from '@/lib/inventory';
import { seedInventory, seedDonations, seedDistributions } from '@/data/mock';
import { stepDay, addDays, SIM_START, type WarehouseState, type SimEvent, type Reorder } from '@/lib/warehouse';

interface InventoryContextValue {
  inventory: InventoryItem[];
  donations: Donation[];
  distributions: Distribution[];
  // Warehouse engine state:
  events: SimEvent[];
  reorders: Reorder[];
  prioritized: string[];
  simDate: string;
  running: boolean;
  speed: number;
  // Manual actions:
  addItem: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  adjustQuantity: (id: string, delta: number) => void;
  logDonation: (input: Omit<Donation, 'id'>) => void;
  recordDistribution: (input: Omit<Distribution, 'id'>) => void;
  // Engine controls:
  toggleRunning: () => void;
  setSpeed: (n: number) => void;
  resetDemo: () => void;
  approveReorder: (itemId: string, qty: number) => void;
  togglePriority: (itemId: string) => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);
const STORAGE_KEY = 'parsel-warehouse-v1';

function freshSeed(): WarehouseState {
  return {
    inventory: seedInventory.map((i) => ({ ...i })),
    donations: seedDonations.map((d) => ({ ...d })),
    distributions: seedDistributions.map((d) => ({ ...d })),
    events: [],
    reorders: [],
    prioritized: [],
    simDate: SIM_START,
  };
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WarehouseState>(freshSeed);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  // `hydrated` is STATE, not a ref, so flipping it re-runs the persist and clock
  // effects. It starts false so neither runs on the initial (seed) render — that
  // prevents the persist effect from clobbering saved storage with the seeds, and
  // the clock from stepping the seed, before hydration commits.
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount (client only).
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.state?.inventory) setState(saved.state);
          if (typeof saved.running === 'boolean') setRunning(saved.running);
          if (typeof saved.speed === 'number') setSpeed(saved.speed);
        }
      } catch {
        /* ignore corrupt storage */
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // Persist whenever anything changes (only after hydration has committed).
  useEffect(() => {
    if (!hydrated) return;
    // Never write the pristine seed over saved progress. In dev, React
    // StrictMode double-invokes effects, which can race a seed-state write
    // against hydration; this guard makes that write a no-op. resetDemo removes
    // the key instead, so a real reset still starts fresh.
    const pristine = state.simDate === SIM_START && state.events.length === 0 && state.reorders.length === 0;
    if (pristine) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, running, speed }));
    } catch {
      /* storage full / unavailable */
    }
  }, [hydrated, state, running, speed]);

  // The engine clock: while running, advance one simulated day per tick.
  useEffect(() => {
    if (!hydrated || !running) return;
    const ms = Math.max(400, Math.round(3000 / speed));
    const id = setInterval(() => setState((s) => stepDay(s)), ms);
    return () => clearInterval(id);
  }, [hydrated, running, speed]);

  const addItem: InventoryContextValue['addItem'] = (item) => {
    setState((s) => ({ ...s, inventory: [{ ...item, id: newId(), lastUpdated: s.simDate }, ...s.inventory] }));
  };

  const adjustQuantity: InventoryContextValue['adjustQuantity'] = (id, delta) => {
    setState((s) => ({
      ...s,
      inventory: s.inventory.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta), lastUpdated: s.simDate } : i,
      ),
    }));
  };

  const logDonation: InventoryContextValue['logDonation'] = (input) => {
    setState((s) => {
      const donation: Donation = { ...input, id: newId() };
      return { ...s, donations: [donation, ...s.donations], inventory: applyDonation(s.inventory, donation) };
    });
  };

  const recordDistribution: InventoryContextValue['recordDistribution'] = (input) => {
    setState((s) => {
      const distribution: Distribution = { ...input, id: newId() };
      return {
        ...s,
        distributions: [distribution, ...s.distributions],
        inventory: applyDistribution(s.inventory, distribution),
      };
    });
  };

  const toggleRunning = () => setRunning((r) => !r);

  const resetDemo = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState(freshSeed());
    setRunning(true);
    setSpeed(1);
  };

  const approveReorder: InventoryContextValue['approveReorder'] = (itemId, qty) => {
    setState((s) => {
      const it = s.inventory.find((i) => i.id === itemId);
      if (!it || qty <= 0) return s;
      const reorder: Reorder = {
        id: newId(),
        name: it.name,
        category: it.category,
        qty,
        unit: it.unit,
        placedDate: s.simDate,
        arriveDate: addDays(s.simDate, 2),
      };
      const event: SimEvent = {
        id: newId(),
        date: s.simDate,
        kind: 'reorder',
        text: `Reorder placed: ${qty} ${it.unit} ${it.name} (ETA 2 days)`,
      };
      return { ...s, reorders: [...s.reorders, reorder], events: [event, ...s.events].slice(0, 60) };
    });
  };

  const togglePriority: InventoryContextValue['togglePriority'] = (itemId) => {
    setState((s) => ({
      ...s,
      prioritized: s.prioritized.includes(itemId)
        ? s.prioritized.filter((x) => x !== itemId)
        : [...s.prioritized, itemId],
    }));
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory: state.inventory,
        donations: state.donations,
        distributions: state.distributions,
        events: state.events,
        reorders: state.reorders,
        prioritized: state.prioritized,
        simDate: state.simDate,
        running,
        speed,
        addItem,
        adjustQuantity,
        logDonation,
        recordDistribution,
        toggleRunning,
        setSpeed,
        resetDemo,
        approveReorder,
        togglePriority,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}
