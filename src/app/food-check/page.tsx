'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ScanLine, XCircle } from 'lucide-react';

interface Check {
  label: 'fresh' | 'spoiled' | 'no food' | 'unknown';
  rawLabel: string;
  category?: string;
  confidence: number;
  ms: number;
  at: string;
  thumb: string;
}

export default function FoodCheckPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Check | null>(null);
  const [log, setLog] = useState<Check[]>([]);

  async function startCamera() {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
      // Warm up the EyePop worker so the first check isn't slow.
      fetch('/api/eyepop/food').catch(() => {});
    } catch {
      setCamError('Could not access the camera. Grant permission and use https or localhost.');
    }
  }

  useEffect(() => {
    return () => {
      const s = videoRef.current?.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function check() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || busy) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/eyepop/food', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const d = await r.json();
      const check: Check = {
        label: d.label ?? 'unknown',
        rawLabel: d.rawLabel ?? d.error ?? 'unknown',
        category: d.category,
        confidence: d.confidence ?? 0,
        ms: d.ms ?? 0,
        at: new Date().toLocaleTimeString(),
        thumb: dataUrl,
      };
      setResult(check);
      setLog((prev) => [check, ...prev].slice(0, 6));
    } catch {
      setResult({ label: 'unknown', rawLabel: 'request failed', confidence: 0, ms: 0, at: '', thumb: dataUrl });
    } finally {
      setBusy(false);
    }
  }

  const verdict = result?.label;
  const tone =
    verdict === 'fresh'
      ? 'bg-emerald-100 text-emerald-800'
      : verdict === 'spoiled'
        ? 'bg-red-100 text-red-800'
        : 'bg-stone-100 text-stone-600';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-stone-900">Food intake vision (EyePop.ai)</h2>
        <p className="text-sm text-stone-500">
          Point your camera at a donated item and check it. EyePop.ai&apos;s vision model runs live
          on the frame and identifies the item; with a food-freshness ability it returns a
          fresh / spoiled verdict so bad donations are caught at intake.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {!camOn && (
              <div className="absolute inset-0 grid place-items-center text-center text-stone-400">
                <div>
                  <Camera size={32} className="mx-auto mb-2" />
                  <p className="text-sm">Camera is off</p>
                </div>
              </div>
            )}
            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-black/50 text-center text-white">
                <div>
                  <ScanLine size={30} className="mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Analyzing with EyePop VLM…</p>
                  <p className="text-xs text-stone-300">~10-15s per check</p>
                </div>
              </div>
            )}
            {result && !busy && (
              <div className="absolute left-3 top-3 rounded-lg bg-black/65 px-3 py-2 backdrop-blur">
                <div className="text-[10px] uppercase tracking-wide text-stone-400">EyePop.ai verdict</div>
                <div
                  className={`flex items-center gap-2 text-base font-bold ${verdict === 'fresh' ? 'text-emerald-400' : verdict === 'spoiled' ? 'text-red-400' : 'text-stone-200'}`}
                >
                  {verdict === 'fresh' ? <CheckCircle2 size={18} /> : verdict === 'spoiled' ? <XCircle size={18} /> : null}
                  {(verdict === 'unknown' ? result.rawLabel : result.label).toUpperCase()}
                </div>
                <div className="text-[11px] text-stone-400">
                  EyePop{result.category ? ` · ${result.category}` : ''} · {result.ms} ms
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="mt-3 flex gap-2">
            {!camOn ? (
              <button onClick={startCamera} className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700">
                <Camera size={16} /> Start camera
              </button>
            ) : (
              <button onClick={check} disabled={busy} className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50">
                <ScanLine size={16} /> {busy ? 'Checking…' : 'Check this item'}
              </button>
            )}
          </div>
          {camError && <p className="mt-2 text-sm text-red-600">{camError}</p>}
        </div>

        {/* Result + recent checks */}
        <div className="space-y-3">
          <div className={`rounded-xl border border-stone-200 p-4 shadow-sm ${result ? tone : 'bg-white'}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">
              {result && verdict === 'unknown' ? 'EyePop detected' : 'Latest verdict'}
            </div>
            <div className="mt-1 text-2xl font-bold">
              {result ? (verdict === 'unknown' ? result.rawLabel : result.label) : '—'}
            </div>
            {result && (
              <div className="mt-1 text-xs opacity-80">
                {result.category ? `${result.category} · ` : ''}confidence {(result.confidence * 100).toFixed(0)}%
              </div>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="mb-2 text-xs font-medium text-stone-500">Recent checks</div>
            <ul className="space-y-2">
              {log.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.thumb} alt="" className="h-9 w-12 rounded object-cover" />
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.label === 'fresh' ? 'bg-emerald-100 text-emerald-800' : c.label === 'spoiled' ? 'bg-red-100 text-red-800' : 'bg-stone-100 text-stone-600'}`}>
                    {c.label}
                  </span>
                  <span className="text-xs text-stone-400">{c.at}</span>
                </li>
              ))}
              {log.length === 0 && <li className="text-xs text-stone-400">No checks yet.</li>}
            </ul>
          </div>
          <p className="text-[11px] text-stone-400">
            Runs EyePop.ai&apos;s image-contents VLM with a fresh/spoiled inspection prompt. Camera
            frames are sent to the server for one-shot analysis; nothing is stored.
          </p>
        </div>
      </div>
    </div>
  );
}
