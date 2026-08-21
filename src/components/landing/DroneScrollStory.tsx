'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, Navigation, ScanLine } from 'lucide-react';

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export default function DroneScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      setProgress(clamp(-rect.top / Math.max(distance, 1)));
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const flight = clamp(progress / 0.64);
  const scan = clamp((progress - 0.48) / 0.18);
  const verified = progress > 0.64;
  const allocated = progress > 0.82;
  const droneX = 12 + flight * 66;
  const droneY = 68 - Math.sin(flight * Math.PI) * 39;
  const phase = progress < 0.34
    ? { title: 'First, predict where need is moving.', body: 'The model spots a rise in neighborhood pressure before the next distribution window.' }
    : progress < 0.68
      ? { title: 'Then, verify what the data cannot see.', body: 'The drone reaches the zone and computer vision checks current conditions in real time.' }
      : { title: 'Now, send exactly what is needed.', body: 'Verified demand meets available inventory. Parsel turns both into a clear, reviewable allocation.' };

  return (
    <section ref={sectionRef} className="relative h-[360vh] bg-[#071a2b] text-white" aria-label="From prediction to verified delivery">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#54b889]">A decision, in motion</p>
            <div className="mt-5 min-h-52">
              <div key={phase.title} className="animate-[fade-in_.45s_ease-out]">
                <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl">{phase.title}</h2>
                <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">{phase.body}</p>
              </div>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs font-medium text-slate-400">
              <span className="tabular-nums">{String(Math.round(progress * 100)).padStart(2, '0')}</span>
              <span className="h-px w-32 overflow-hidden bg-white/15"><span className="block h-full bg-[#54b889]" style={{ width: `${progress * 100}%` }} /></span>
              <span>100</span>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b2538] shadow-2xl shadow-black/30">
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(#ffffff0d_1px,transparent_1px),linear-gradient(90deg,#ffffff0d_1px,transparent_1px)] [background-size:44px_44px]" />
            <div className="absolute left-[7%] top-[68%] h-24 w-32 rounded-md border border-white/10 bg-[#0e3046] shadow-xl">
              <span className="absolute -top-7 left-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Food bank</span>
              <div className="grid h-full grid-cols-3 gap-1 p-3 opacity-60">{Array.from({ length: 9 }).map((_, i) => <span key={i} className="rounded-sm bg-[#54b889]/20" />)}</div>
            </div>

            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 600" aria-hidden="true">
              <path d="M105 430 C260 155 445 130 640 385" fill="none" stroke="#54b889" strokeWidth="2" strokeDasharray="7 12" opacity="0.65" />
              <circle cx="640" cy="385" r="74" fill="#54b889" opacity={0.04 + scan * 0.08} />
              <circle cx="640" cy="385" r={28 + scan * 48} fill="none" stroke="#54b889" strokeWidth="2" opacity={scan} />
            </svg>

            <div className="absolute transition-transform duration-100 ease-linear" style={{ left: `${droneX}%`, top: `${droneY}%`, transform: `translate(-50%, -50%) rotate(${Math.sin(flight * Math.PI * 2) * 4}deg)` }}>
              <div className="relative grid h-16 w-24 place-items-center">
                <span className="absolute left-0 top-1 h-8 w-8 rounded-full border-2 border-[#76d6a7]/70" />
                <span className="absolute right-0 top-1 h-8 w-8 rounded-full border-2 border-[#76d6a7]/70" />
                <span className="absolute bottom-1 left-2 h-8 w-8 rounded-full border-2 border-[#76d6a7]/70" />
                <span className="absolute bottom-1 right-2 h-8 w-8 rounded-full border-2 border-[#76d6a7]/70" />
                <Navigation className="relative z-10 rotate-45 text-white" size={28} fill="currentColor" />
              </div>
            </div>

            <div className="absolute right-[8%] top-[57%] flex gap-5">
              {[0, 1, 2, 3, 4].map((person) => (
                <div key={person} className="relative flex flex-col items-center" style={{ transform: `translateY(${person % 2 ? 14 : 0}px)` }}>
                  <span className="h-3.5 w-3.5 rounded-full bg-slate-300" />
                  <span className="mt-1 h-8 w-3 rounded-full bg-slate-400" />
                  <span className={`absolute -inset-x-3 -inset-y-2 border transition-opacity duration-300 ${verified ? 'border-[#54b889] opacity-100' : 'border-transparent opacity-0'}`} />
                </div>
              ))}
            </div>

            <div className={`absolute right-5 top-5 w-48 rounded-xl border bg-[#071a2b]/90 p-4 backdrop-blur transition-all duration-500 ${scan > 0.05 ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'} ${verified ? 'border-[#54b889]/50' : 'border-white/10'}`}>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">{verified ? <Check size={13} className="text-[#54b889]" /> : <ScanLine size={13} className="text-[#54b889]" />}{verified ? 'Verification complete' : 'Scanning zone'}</div>
              <p className="mt-3 text-3xl font-semibold tabular-nums">{verified ? '5' : '—'}</p>
              <p className="mt-1 text-xs text-slate-400">people detected · operator review required</p>
            </div>

            <div className={`absolute bottom-5 left-5 right-5 rounded-xl border border-[#54b889]/30 bg-[#071a2b]/95 p-4 backdrop-blur transition-all duration-500 ${allocated ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#54b889] text-[#071a2b]"><Crosshair size={18} /></span><div><p className="text-sm font-semibold">East Village allocation ready</p><p className="text-xs text-slate-400">Human-verified · FEFO inventory</p></div></div><p className="text-xl font-semibold text-[#76d6a7]">15 units</p></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
