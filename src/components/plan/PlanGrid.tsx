'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import EvidenceChip from '@/components/EvidenceChip';
import ZoneEvidenceDrawer from './ZoneEvidenceDrawer';
import type { PlanGrid as PlanGridData } from '@/lib/plan/forecast';
import type { ZoneEvidence } from '@/lib/plan/evidence';
import type { DeliveryZone } from '@/lib/delivery';
import type { OutlookPayload } from '@/lib/outlookServer';
import type { LedgerEvent, PlanParams } from '@/lib/store/types';

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function PlanGrid({
  grid,
  evidenceByZone,
  params,
  activeWeek,
  onSelectWeek,
  onOverrideClick,
  outlook,
  zones,
  ledger,
}: {
  grid: PlanGridData;
  evidenceByZone: Record<string, ZoneEvidence>;
  params: PlanParams;
  activeWeek: string | null;
  onSelectWeek: (week: string) => void;
  onOverrideClick: (zoneId: string) => void;
  outlook: OutlookPayload;
  zones: DeliveryZone[];
  ledger: LedgerEvent[];
}) {
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ zoneId: string; week: string } | null>(null);

  const selected =
    selectedCell &&
    grid.zones.find((z) => z.id === selectedCell.zoneId) &&
    grid.cells[selectedCell.zoneId]?.[selectedCell.week];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-slate-900">Resource plan</h2>
        <p className="text-[11px] text-slate-400">
          Click a week to select it below · click a cell for the formula · plan to{' '}
          {params.planTo === 'point' ? 'point estimate' : 'upper 80% band'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="w-56 px-4 py-2 font-medium">Zone</th>
              {grid.weeks.map((w) => (
                <th key={w} className="px-2 py-2 font-medium">
                  <button
                    onClick={() => onSelectWeek(w)}
                    className={`rounded-md px-2 py-1 transition ${
                      activeWeek === w ? 'bg-[#54b889]/20 text-[#0b6b45]' : 'hover:bg-slate-100'
                    }`}
                  >
                    {weekLabel(w)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.zones.map((z) => {
              const evidence = evidenceByZone[z.id];
              const isExpanded = expandedZone === z.id;
              return (
                <Fragment key={z.id}>
                  <tr className="border-b border-slate-50 align-top">
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setExpandedZone(isExpanded ? null : z.id)}
                        className="flex items-center gap-1 font-medium text-slate-900 hover:text-slate-600"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {z.label}
                      </button>
                      <div className="mt-1 flex items-center gap-1.5">
                        {evidence && <EvidenceChip evidence={evidence} />}
                        <button
                          onClick={() => onOverrideClick(z.id)}
                          title="Set an override for this zone"
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <SlidersHorizontal size={12} />
                        </button>
                      </div>
                    </td>
                    {grid.weeks.map((w) => {
                      const cell = grid.cells[z.id]?.[w];
                      if (!cell) return <td key={w} className="px-2 py-2" />;
                      const isSelectedCell = selectedCell?.zoneId === z.id && selectedCell.week === w;
                      return (
                        <td key={w} className="px-2 py-2">
                          <button
                            onClick={() => setSelectedCell(isSelectedCell ? null : { zoneId: z.id, week: w })}
                            className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${
                              isSelectedCell
                                ? 'border-slate-400 bg-slate-50'
                                : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                            } ${cell.overridden ? 'ring-1 ring-violet-200' : ''}`}
                          >
                            <div className="font-medium text-slate-900">{fmt(cell.need)}</div>
                            <div className="text-[10px] text-slate-400">
                              {fmt(cell.lo)}&ndash;{fmt(cell.hi)}
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {fmt(cell.meals)} meals &middot; {cell.runs} run{cell.runs === 1 ? '' : 's'} &middot;{' '}
                              {fmt(cell.hours)}h
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={grid.weeks.length + 1} className="p-0">
                        <ZoneEvidenceDrawer
                          neighborhoodId={z.id}
                          label={z.label}
                          outlook={outlook}
                          zones={zones}
                          ledger={ledger}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="bg-slate-50 font-medium text-slate-900">
              <td className="px-4 py-2">Total</td>
              {grid.weeks.map((w) => {
                const t = grid.totals[w];
                return (
                  <td key={w} className="px-2 py-2">
                    <div>{fmt(t.need)}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      {fmt(t.lo)}&ndash;{fmt(t.hi)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                      {fmt(t.meals)} meals &middot; {t.runs} runs &middot; {fmt(t.hours)}h
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {selected && selectedCell && (
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            {grid.zones.find((z) => z.id === selectedCell.zoneId)?.label} &middot; week of{' '}
            {weekLabel(selectedCell.week)}
          </span>
          <span className="ml-2">
            need {fmt(selected.need)} ({fmt(selected.lo)}&ndash;{fmt(selected.hi)}) &times; mealsPerPerson{' '}
            {params.mealsPerPerson} &times; visits/wk {params.visitsPerWeek[selectedCell.zoneId] ?? 1} ={' '}
            {fmt(selected.meals)} meals &rarr; &lceil;meals / {params.vehicleCapacity}&rceil; ={' '}
            {selected.runs} run{selected.runs === 1 ? '' : 's'} &times; {params.hoursPerRun}h ={' '}
            {fmt(selected.hours)}h
            {selected.overridden ? ' (override active)' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
