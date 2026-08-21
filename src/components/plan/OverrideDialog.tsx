'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import FormField, { inputClass } from '@/components/FormField';
import type { Override } from '@/lib/store/types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateISO: string, n: number): string {
  return new Date(new Date(dateISO + 'T00:00:00Z').getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export default function OverrideDialog({
  zoneId,
  zoneLabel,
  existing,
  onClose,
  onSave,
  onClear,
}: {
  zoneId: string;
  zoneLabel: string;
  existing?: Override;
  onClose: () => void;
  onSave: (override: Override) => void;
  onClear: () => void;
}) {
  const [mode, setMode] = useState<Override['mode']>(existing?.mode ?? 'factor');
  const [value, setValue] = useState<number>(existing?.value ?? (existing?.mode === 'absolute' ? 0 : 1));
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [expiresAt, setExpiresAt] = useState(existing?.expiresAt ?? addDays(today(), 14));

  const save = () => {
    if (!reason.trim()) return;
    onSave({ zoneId, mode, value, reason: reason.trim(), setAt: new Date().toISOString(), expiresAt });
  };

  return (
    <Modal open title={`Override — ${zoneLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <FormField label="Mode">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 text-xs">
            {(['factor', 'absolute'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                  mode === m ? 'bg-[#54b889] text-[#071a2b]' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {m === 'factor' ? 'Scale (x)' : 'Absolute need'}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label={mode === 'factor' ? 'Factor (e.g. 0.8 = -20%)' : 'Absolute weekly need'}>
          <input
            type="number"
            step={mode === 'factor' ? 0.05 : 1}
            min={0}
            className={inputClass}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </FormField>
        <FormField label="Reason">
          <input
            type="text"
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Safe-sleeping site opened nearby"
          />
        </FormField>
        <FormField label="Expires">
          <input
            type="date"
            className={inputClass}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </FormField>
        <div className="flex items-center justify-between pt-2">
          {existing ? (
            <button onClick={onClear} className="text-xs font-medium text-red-600 hover:text-red-700">
              Clear override
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!reason.trim()}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Save override
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
