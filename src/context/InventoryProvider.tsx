'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { InventoryItem, Donation, Distribution } from '@/lib/types';
import { applyDonation, applyDistribution, newId } from '@/lib/inventory';
import type { SimEvent, Reorder } from '@/lib/warehouse';
import { loadSnapshot, saveSnapshot, clearSnapshot, emptySnapshot } from '@/lib/store/localStorageStore';
import { buildDemoSnapshot } from '@/lib/store/demoData';
import type { LedgerEvent, PlanParams, Override, DistributionDraft, StoreSnapshot } from '@/lib/store/types';

export interface DistributionOutcome {
  householdsServed?: number;
  unitsDistributed?: number;
  surplusReturned?: number;
  notes?: string;
}

interface InventoryContextValue {
  inventory: InventoryItem[];
  donations: Donation[];
  distributions: Distribution[];
  ledger: LedgerEvent[];
  params: PlanParams;
  overrides: Override[];
  drafts: DistributionDraft[];
  selectedWeekStart?: string;
  // Legacy warehouse-panel state. No sim clock drives these anymore — they
  // only change through the manual actions below (approveReorder,
  // togglePriority) — but the Inventory page still renders them.
  events: SimEvent[];
  reorders: Reorder[];
  prioritized: string[];
  simDate: string;
  // Manual actions:
  addItem: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  adjustQuantity: (id: string, delta: number) => void;
  logDonation: (input: Omit<Donation, 'id'>) => void;
  recordDistribution: (input: Omit<Distribution, 'id'>) => void;
  // Plan & ledger:
  setParams: (params: PlanParams) => void;
  setOverride: (override: Override) => void;
  clearOverride: (zoneId: string) => void;
  stageDrafts: (drafts: DistributionDraft[]) => void;
  completeDraft: (id: string, outcome: DistributionOutcome) => void;
  appendEvent: (event: Omit<LedgerEvent, 'id' | 'ts'>) => void;
  setSelectedWeekStart: (weekStart: string) => void;
  // Demo data:
  loadDemo: () => void;
  resetDemo: () => void;
  // Legacy warehouse-panel actions:
  approveReorder: (itemId: string, qty: number) => void;
  togglePriority: (itemId: string) => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeLedgerEvent(input: Omit<LedgerEvent, 'id' | 'ts'>): LedgerEvent {
  return { ...input, id: newId(), ts: new Date().toISOString() };
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<StoreSnapshot>(emptySnapshot);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [reorders, setReorders] = useState<Reorder[]>([]);
  const [prioritized, setPrioritized] = useState<string[]>([]);
  // `hydrated` starts false so the persist effect can't fire on the initial
  // (empty) render and clobber saved storage before hydration reads it.
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount (client only).
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = loadSnapshot();
      if (saved) setSnapshot(saved);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // Persist whenever the snapshot changes (only after hydration has committed).
  useEffect(() => {
    if (!hydrated) return;
    saveSnapshot(snapshot);
  }, [hydrated, snapshot]);

  const addItem: InventoryContextValue['addItem'] = (item) => {
    setSnapshot((s) => ({
      ...s,
      inventory: [{ ...item, id: newId(), lastUpdated: today() }, ...s.inventory],
    }));
  };

  const adjustQuantity: InventoryContextValue['adjustQuantity'] = (id, delta) => {
    setSnapshot((s) => ({
      ...s,
      inventory: s.inventory.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta), lastUpdated: today() } : i,
      ),
    }));
  };

  const logDonation: InventoryContextValue['logDonation'] = (input) => {
    setSnapshot((s) => {
      const donation: Donation = { ...input, id: newId() };
      return { ...s, donations: [donation, ...s.donations], inventory: applyDonation(s.inventory, donation) };
    });
  };

  const recordDistribution: InventoryContextValue['recordDistribution'] = (input) => {
    setSnapshot((s) => {
      const distribution: Distribution = { ...input, id: newId() };
      return {
        ...s,
        distributions: [distribution, ...s.distributions],
        inventory: applyDistribution(s.inventory, distribution),
      };
    });
  };

  const setParams: InventoryContextValue['setParams'] = (params) => {
    setSnapshot((s) => ({
      ...s,
      params,
      ledger: [
        makeLedgerEvent({ type: 'params_changed', actor: 'operator', payload: { ...params } }),
        ...s.ledger,
      ],
    }));
  };

  const setOverride: InventoryContextValue['setOverride'] = (override) => {
    setSnapshot((s) => ({
      ...s,
      overrides: [override, ...s.overrides.filter((o) => o.zoneId !== override.zoneId)],
      ledger: [
        makeLedgerEvent({
          type: 'override_set',
          zoneId: override.zoneId,
          actor: 'operator',
          payload: { mode: override.mode, value: override.value, expiresAt: override.expiresAt },
          note: override.reason,
        }),
        ...s.ledger,
      ],
    }));
  };

  const clearOverride: InventoryContextValue['clearOverride'] = (zoneId) => {
    setSnapshot((s) => ({ ...s, overrides: s.overrides.filter((o) => o.zoneId !== zoneId) }));
  };

  const stageDrafts: InventoryContextValue['stageDrafts'] = (newDrafts) => {
    setSnapshot((s) => ({
      ...s,
      drafts: [...newDrafts, ...s.drafts],
      ledger: [
        ...newDrafts.map((d) =>
          makeLedgerEvent({
            type: 'allocation_staged',
            zoneId: d.zoneId,
            refId: d.id,
            actor: 'operator',
            payload: { meals: d.meals, predictedNeed: d.predictedNeed, items: d.items, weekStart: d.weekStart },
          }),
        ),
        ...s.ledger,
      ],
    }));
  };

  const completeDraft: InventoryContextValue['completeDraft'] = (id, outcome) => {
    setSnapshot((s) => {
      const draft = s.drafts.find((d) => d.id === id);
      if (!draft) return s;
      const distribution: Distribution = {
        id: newId(),
        date: today(),
        recipient: draft.zoneLabel,
        type: 'mobile-pantry',
        items: draft.items,
        householdsServed: outcome.householdsServed,
        notes: outcome.notes,
      };
      const inventory = applyDistribution(s.inventory, distribution);
      const drafts = s.drafts.map((d) => (d.id === id ? { ...d, status: 'completed' as const } : d));
      const ledgerEvent = makeLedgerEvent({
        type: 'distribution_completed',
        zoneId: draft.zoneId,
        refId: distribution.id,
        actor: 'operator',
        payload: {
          predictedNeed: draft.predictedNeed,
          householdsServed: outcome.householdsServed,
          unitsDistributed: outcome.unitsDistributed,
          surplusReturned: outcome.surplusReturned,
        },
      });
      return {
        ...s,
        inventory,
        distributions: [distribution, ...s.distributions],
        drafts,
        ledger: [ledgerEvent, ...s.ledger],
      };
    });
  };

  const appendEvent: InventoryContextValue['appendEvent'] = (event) => {
    setSnapshot((s) => ({ ...s, ledger: [makeLedgerEvent(event), ...s.ledger] }));
  };

  const setSelectedWeekStart: InventoryContextValue['setSelectedWeekStart'] = (weekStart) => {
    setSnapshot((s) => ({ ...s, selectedWeekStart: weekStart }));
  };

  const loadDemo: InventoryContextValue['loadDemo'] = () => {
    setSnapshot(buildDemoSnapshot(today()));
    setEvents([]);
    setReorders([]);
    setPrioritized([]);
  };

  const resetDemo: InventoryContextValue['resetDemo'] = () => {
    clearSnapshot();
    setSnapshot(emptySnapshot());
    setEvents([]);
    setReorders([]);
    setPrioritized([]);
  };

  const approveReorder: InventoryContextValue['approveReorder'] = (itemId, qty) => {
    const item = snapshot.inventory.find((i) => i.id === itemId);
    if (!item || qty <= 0) return;
    const reorder: Reorder = {
      id: newId(),
      name: item.name,
      category: item.category,
      qty,
      unit: item.unit,
      placedDate: today(),
      arriveDate: today(),
    };
    setReorders((r) => [...r, reorder]);
    setEvents((e) =>
      [
        { id: newId(), date: today(), kind: 'reorder' as const, text: `Reorder placed: ${qty} ${item.unit} ${item.name}` },
        ...e,
      ].slice(0, 60),
    );
  };

  const togglePriority: InventoryContextValue['togglePriority'] = (itemId) => {
    setPrioritized((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : [...p, itemId]));
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory: snapshot.inventory,
        donations: snapshot.donations,
        distributions: snapshot.distributions,
        ledger: snapshot.ledger,
        params: snapshot.params,
        overrides: snapshot.overrides,
        drafts: snapshot.drafts,
        selectedWeekStart: snapshot.selectedWeekStart,
        events,
        reorders,
        prioritized,
        simDate: today(),
        addItem,
        adjustQuantity,
        logDonation,
        recordDistribution,
        setParams,
        setOverride,
        clearOverride,
        stageDrafts,
        completeDraft,
        appendEvent,
        setSelectedWeekStart,
        loadDemo,
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
