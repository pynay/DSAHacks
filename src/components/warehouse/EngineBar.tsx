'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';

const SPEEDS = [1, 2, 4];

export default function EngineBar({
  running,
  speed,
  simDate,
  onToggle,
  onSpeed,
  onReset,
}: {
  running: boolean;
  speed: number;
  simDate: string;
  onToggle: () => void;
  onSpeed: (n: number) => void;
  onReset: () => void;
}) {
  const label = new Date(simDate + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        {running ? <Pause size={15} /> : <Play size={15} />}
        {running ? 'Pause' : 'Run'}
      </button>

      <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeed(s)}
            className={`px-2.5 py-2 font-medium transition ${speed === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs font-medium">
        <span className={`inline-block h-2 w-2 rounded-full ${running ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
        <span className={running ? 'text-emerald-700' : 'text-slate-400'}>{running ? 'LIVE' : 'Paused'}</span>
      </div>

      <div className="ml-auto flex items-center gap-4 text-sm">
        <span className="text-slate-500">
          Simulated day <span className="font-semibold text-slate-800">{label}</span>
        </span>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          title="Restore the seeded demo state"
        >
          <RotateCcw size={13} /> Reset demo
        </button>
      </div>
    </div>
  );
}
