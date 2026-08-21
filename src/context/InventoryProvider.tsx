'use client';

import { createContext, useContext, useState } from 'react';
import type { InventoryItem, Donation, Distribution } from '@/lib/types';
import { applyDonation, applyDistribution, newId } from '@/lib/inventory';
import { seedInventory, seedDonations, seedDistributions } from '@/data/mock';

interface InventoryContextValue {
  inventory: InventoryItem[];
  donations: Donation[];
  distributions: Distribution[];
  addItem: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  adjustQuantity: (id: string, delta: number) => void;
  logDonation: (input: Omit<Donation, 'id'>) => void;
  recordDistribution: (input: Omit<Distribution, 'id'>) => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>(seedInventory);
  const [donations, setDonations] = useState<Donation[]>(seedDonations);
  const [distributions, setDistributions] = useState<Distribution[]>(seedDistributions);

  const addItem: InventoryContextValue['addItem'] = (item) => {
    setInventory((prev) => [{ ...item, id: newId(), lastUpdated: today() }, ...prev]);
  };

  const adjustQuantity: InventoryContextValue['adjustQuantity'] = (id, delta) => {
    setInventory((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta), lastUpdated: today() } : i,
      ),
    );
  };

  const logDonation: InventoryContextValue['logDonation'] = (input) => {
    const donation: Donation = { ...input, id: newId() };
    setDonations((prev) => [donation, ...prev]);
    setInventory((prev) => applyDonation(prev, donation));
  };

  const recordDistribution: InventoryContextValue['recordDistribution'] = (input) => {
    const distribution: Distribution = { ...input, id: newId() };
    setDistributions((prev) => [distribution, ...prev]);
    setInventory((prev) => applyDistribution(prev, distribution));
  };

  return (
    <InventoryContext.Provider
      value={{ inventory, donations, distributions, addItem, adjustQuantity, logDonation, recordDistribution }}
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
