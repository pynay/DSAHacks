'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import type { Category, Donation } from '@/lib/types';
import Modal from '@/components/Modal';
import FormField, { inputClass } from '@/components/FormField';

const CATEGORIES: Category[] = ['Canned', 'Produce', 'Dairy', 'Grains', 'Frozen', 'Protein', 'Beverages', 'Household'];
const DONOR_TYPES: Donation['donorType'][] = ['individual', 'grocery', 'corporate', 'food-drive'];

export default function DonationsPage() {
  const { donations, logDonation } = useInventory();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    donorName: '',
    donorType: 'grocery' as Donation['donorType'],
    itemName: '',
    category: 'Canned' as Category,
    quantity: 0,
    unit: 'units',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.donorName.trim() || !form.itemName.trim()) return;
    logDonation({
      date: new Date().toISOString().slice(0, 10),
      donorName: form.donorName.trim(),
      donorType: form.donorType,
      items: [{ name: form.itemName.trim(), category: form.category, quantity: Number(form.quantity), unit: form.unit }],
    });
    setForm({ donorName: '', donorType: 'grocery', itemName: '', category: 'Canned', quantity: 0, unit: 'units' });
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{donations.length} recorded donations</p>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus size={16} /> Log donation
        </button>
      </div>

      <div className="space-y-3">
        {donations.map((d) => (
          <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">{d.donorName}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">{d.donorType}</div>
              </div>
              <div className="text-sm text-slate-500">{d.date}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.items.map((it, idx) => (
                <span key={idx} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                  {it.quantity} {it.unit} · {it.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} title="Log donation" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Donor name">
              <input className={inputClass} value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} required />
            </FormField>
            <FormField label="Donor type">
              <select className={inputClass} value={form.donorType} onChange={(e) => setForm({ ...form, donorType: e.target.value as Donation['donorType'] })}>
                {DONOR_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Item">
              <input className={inputClass} value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} required />
            </FormField>
            <FormField label="Category">
              <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantity">
              <input type="number" min={0} className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </FormField>
            <FormField label="Unit">
              <input className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </FormField>
          </div>
          <p className="text-xs text-slate-400">Matching inventory increases automatically; unknown items are added to stock.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Log donation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
