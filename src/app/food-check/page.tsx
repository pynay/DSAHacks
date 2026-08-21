'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ScanLine, XCircle } from 'lucide-react';

interface Box {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Fresh {
  label: 'fresh' | 'spoiled' | 'no food' | 'unknown';
  rawLabel: string;
  category?: string;
  confidence: number;
  ms: number;
}

const PW = 720; // processing width

export default function FoodCheckPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null); // visible: video + boxes
  const grabRef = useRef<HTMLCanvasElement>(null); // hidden: clean frame to send
  const boxesRef = useRef<Box[]>([]);
  const runningRef = useRef(false);
  const rafRef = useRef(0);

  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [det, setDet] = useState<{ count: number; ms: number; labels: string[] }>({ count: 0, ms: 0, labels: [] });
  const [freshBusy, setFreshBusy] = useState(false);
  const [fresh, setFresh] = useState<Fresh | null>(null);

  function procSize() {
    const v = videoRef.current!;
    const w = PW;
    const h = Math.round((PW * (v.videoHeight || 480)) / (v.videoWidth || 640));
    return { w, h };
  }

  function draw() {
    const v = videoRef.current;
    const c = viewRef.current;
    if (v && c && v.readyState >= 2) {
      const { w, h } = procSize();
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      const ctx = c.getContext('2d')!;
      ctx.drawImage(v, 0, 0, w, h);
      for (const b of boxesRef.current) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#22d3ee';
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        const tag = `${b.label} ${(b.confidence * 100) | 0}%`;
        ctx.font = '13px Inter, sans-serif';
        const tw = ctx.measureText(tag).width + 8;
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(b.x, Math.max(0, b.y - 18), tw, 18);
        ctx.fillStyle = '#08343f';
        ctx.fillText(tag, b.x + 4, Math.max(11, b.y - 5));
      }
    }
    rafRef.current = requestAnimationFrame(draw);
  }

  function grabFrame(): string | null {
    const v = videoRef.current;
    const g = grabRef.current;
    if (!v || !g || v.readyState < 2) return null;
    const { w, h } = procSize();
    g.width = w;
    g.height = h;
    g.getContext('2d')!.drawImage(v, 0, 0, w, h);
    return g.toDataURL('image/jpeg', 0.6);
  }

  async function detectLoop() {
    if (!runningRef.current) return;
    const frame = grabFrame();
    if (frame) {
      try {
        const r = await fetch('/api/eyepop/detect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: frame }),
        });
        const d = await r.json();
        if (d.objects) {
          boxesRef.current = d.objects;
          setDet({ count: d.objects.length, ms: d.ms ?? 0, labels: d.objects.map((o: Box) => o.label) });
        }
      } catch {
        /* skip a frame */
      }
    }
    if (runningRef.current) setTimeout(detectLoop, 150);
  }

  async function startCamera() {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setCamOn(true);
      fetch('/api/eyepop/detect').catch(() => {}); // warm up
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(draw);
      detectLoop();
    } catch {
      setCamError('Could not access the camera. Grant permission (localhost/https is required).');
    }
  }

  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function checkFreshness() {
    const frame = grabFrame();
    if (!frame || freshBusy) return;
    setFreshBusy(true);
    setFresh(null);
    try {
      const r = await fetch('/api/eyepop/food', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: frame }),
      });
      const d = await r.json();
      setFresh({ label: d.label ?? 'unknown', rawLabel: d.rawLabel ?? d.error ?? '—', category: d.category, confidence: d.confidence ?? 0, ms: d.ms ?? 0 });
    } catch {
      setFresh({ label: 'unknown', rawLabel: 'request failed', confidence: 0, ms: 0 });
    } finally {
      setFreshBusy(false);
    }
  }

  const verdict = fresh?.label;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-stone-900">Food intake vision (EyePop.ai)</h2>
        <p className="text-sm text-stone-500">
          Live object detection on your camera (~1s) identifies donated items. Run a freshness
          check for a fresh / spoiled verdict, so bad donations are caught at intake.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={viewRef} className="h-auto w-full" />
            <canvas ref={grabRef} className="hidden" />
            {!camOn && (
              <div className="absolute inset-0 grid aspect-video place-items-center text-center text-stone-400">
                <div>
                  <Camera size={32} className="mx-auto mb-2" />
                  <p className="text-sm">Camera is off</p>
                </div>
              </div>
            )}
            {camOn && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-stone-100 backdrop-blur">
                {det.count} objects · {det.ms} ms · EyePop.ai
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {!camOn ? (
              <button onClick={startCamera} className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700">
                <Camera size={16} /> Start camera
              </button>
            ) : (
              <button onClick={checkFreshness} disabled={freshBusy} className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50">
                <ScanLine size={16} /> {freshBusy ? 'Analyzing… (~15s)' : 'Check freshness (VLM)'}
              </button>
            )}
          </div>
          {camError && <p className="mt-2 text-sm text-red-600">{camError}</p>}
        </div>

        <div className="space-y-3">
          <div
            className={`rounded-xl border border-stone-200 p-4 shadow-sm ${verdict === 'fresh' ? 'bg-emerald-100 text-emerald-800' : verdict === 'spoiled' ? 'bg-red-100 text-red-800' : 'bg-white'}`}
          >
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">
              {fresh && verdict === 'unknown' ? 'EyePop detected' : 'Freshness verdict'}
            </div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-bold">
              {verdict === 'fresh' ? <CheckCircle2 size={22} /> : verdict === 'spoiled' ? <XCircle size={22} /> : null}
              {freshBusy ? '…' : fresh ? (verdict === 'unknown' ? fresh.rawLabel : fresh.label) : '—'}
            </div>
            {fresh && !freshBusy && (
              <div className="mt-1 text-xs opacity-80">
                {fresh.category ? `${fresh.category} · ` : ''}
                {fresh.confidence > 0 ? `${(fresh.confidence * 100).toFixed(0)}% · ` : ''}
                {fresh.ms} ms (VLM)
              </div>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="mb-1 text-xs font-medium text-stone-500">Live detections</div>
            {det.labels.length ? (
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(det.labels)].map((l) => (
                  <span key={l} className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-800">{l}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400">{camOn ? 'Scanning…' : 'Start the camera to detect items.'}</p>
            )}
          </div>
          <p className="text-[11px] text-stone-400">
            Fast pass = EyePop common-objects detection. Freshness = EyePop VLM (slower); set a
            food-freshness ability UUID for true fresh/spoiled. Frames are analyzed one-shot, not stored.
          </p>
        </div>
      </div>
    </div>
  );
}
