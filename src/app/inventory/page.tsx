'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { deriveStatus } from '@/lib/inventory';
import type { Category, Status } from '@/lib/types';
import InventoryTable from '@/components/InventoryTable';
import Modal from '@/components/Modal';
import FormField, { inputClass } from '@/components/FormField';
import ReorderQueue from '@/components/warehouse/ReorderQueue';
import ExpiringPanel from '@/components/warehouse/ExpiringPanel';
import ActivityTicker from '@/components/warehouse/ActivityTicker';

const CATEGORIES: Category[] = ['Canned', 'Produce', 'Dairy', 'Grains', 'Frozen', 'Protein', 'Beverages', 'Household'];
const STATUSES: Status[] = ['OK', 'Low', 'Expiring', 'Out'];

export default function InventoryPage() {
  const {
    inventory,
    adjustQuantity,
    addItem,
    events,
    reorders,
    prioritized,
    simDate,
    approveReorder,
    togglePriority,
  } = useInventory();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [status, setStatus] = useState<string>('All');
  const [open, setOpen] = useState(false);

  // "Now" tracks today's date, so statuses and expiry countdowns are current.
  const now = useMemo(() => new Date(simDate + 'T00:00:00Z'), [simDate]);

  const filtered = useMemo(
    () =>
      inventory.filter((i) => {
        if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (category !== 'All' && i.category !== category) return false;
        if (status !== 'All' && deriveStatus(i, now) !== status) return false;
        return true;
      }),
    [inventory, search, category, status, now],
  );

  const [form, setForm] = useState({
    name: '',
    category: 'Canned' as Category,
    quantity: 0,
    unit: 'units',
    expirationDate: '',
    location: '',
    reorderThreshold: 10,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    addItem({
      name: form.name.trim(),
      category: form.category,
      quantity: Number(form.quantity),
      unit: form.unit,
      expirationDate: form.expirationDate || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      location: form.location || 'Receiving',
      reorderThreshold: Number(form.reorderThreshold),
    });
    setForm({ name: '', category: 'Canned', quantity: 0, unit: 'units', expirationDate: '', location: '', reorderThreshold: 10 });
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <ReorderQueue inventory={inventory} reorders={reorders} onApprove={approveReorder} />
        <ExpiringPanel inventory={inventory} now={now} prioritized={prioritized} onTogglePriority={togglePriority} />
        <ActivityTicker events={events} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className={`${inputClass} max-w-xs`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} max-w-[10rem]`}>
          <option>All</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} max-w-[10rem]`}>
          <option>All</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus size={16} /> Add item
        </button>
      </div>

      <p className="text-sm text-slate-500">
        {filtered.length} of {inventory.length} items
      </p>
      <InventoryTable items={filtered} onAdjust={adjustQuantity} now={now} prioritized={prioritized} />

      <Modal open={open} title="Add inventory item" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Name">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category">
              <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Location">
              <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </FormField>
            <FormField label="Quantity">
              <input type="number" min={0} className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </FormField>
            <FormField label="Unit">
              <input className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </FormField>
            <FormField label="Expiration date">
              <input type="date" className={inputClass} value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} />
            </FormField>
            <FormField label="Reorder threshold">
              <input type="number" min={0} className={inputClass} value={form.reorderThreshold} onChange={(e) => setForm({ ...form, reorderThreshold: Number(e.target.value) })} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Add item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
