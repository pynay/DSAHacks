'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import type { Distribution } from '@/lib/types';
import Modal from '@/components/Modal';
import FormField, { inputClass } from '@/components/FormField';

const DIST_TYPES: Distribution['type'][] = ['household', 'partner-agency', 'mobile-pantry'];

export default function DistributionsPage() {
  const { distributions, recordDistribution, inventory } = useInventory();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    recipient: '',
    type: 'partner-agency' as Distribution['type'],
    itemName: inventory[0]?.name ?? '',
    quantity: 0,
    householdsServed: 0,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.recipient.trim() || !form.itemName) return;
    const unit = inventory.find((i) => i.name === form.itemName)?.unit ?? 'units';
    recordDistribution({
      date: new Date().toISOString().slice(0, 10),
      recipient: form.recipient.trim(),
      type: form.type,
      items: [{ name: form.itemName, quantity: Number(form.quantity), unit }],
      householdsServed: Number(form.householdsServed) || undefined,
    });
    setForm({ recipient: '', type: 'partner-agency', itemName: inventory[0]?.name ?? '', quantity: 0, householdsServed: 0 });
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{distributions.length} recorded distributions</p>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus size={16} /> Record distribution
        </button>
      </div>

      <div className="space-y-3">
        {distributions.map((d) => (
          <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">{d.recipient}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  {d.type}
                  {d.householdsServed ? ` · ${d.householdsServed} households` : ''}
                </div>
              </div>
              <div className="text-sm text-slate-500">{d.date}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.items.map((it, idx) => (
                <span key={idx} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {it.quantity} {it.unit} · {it.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} title="Record distribution" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Recipient / partner">
              <input className={inputClass} value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} required />
            </FormField>
            <FormField label="Type">
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Distribution['type'] })}>
                {DIST_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Item">
              <select className={inputClass} value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })}>
                {inventory.map((i) => (
                  <option key={i.id}>{i.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantity">
              <input type="number" min={0} className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </FormField>
            <FormField label="Households served">
              <input type="number" min={0} className={inputClass} value={form.householdsServed} onChange={(e) => setForm({ ...form, householdsServed: Number(e.target.value) })} />
            </FormField>
          </div>
          <p className="text-xs text-slate-400">Recording reduces the selected item&apos;s inventory (not below zero).</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Record distribution
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
