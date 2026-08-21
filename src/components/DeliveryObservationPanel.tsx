'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  CheckCircle2,
  ImageUp,
  Loader2,
  ScanFace,
  ScanLine,
  ShieldCheck,
  Video,
} from 'lucide-react';
import {
  detectedClassCounts,
  detectedPeople,
  personConfidence,
  type CameraDetectionResult,
} from '@/lib/cameraDetection';

export interface SavedDeliveryObservation {
  count: number;
  confidence: number;
  observedAt: string;
  affectedBlocks: number;
  modelNeedBefore: number;
  modelNeedAfter: number;
}

interface DeliveryObservationPanelProps {
  active: boolean;
  missionId: string;
  destination: string;
  modelNeedBefore: number;
  onSave: (observation: { count: number; confidence: number; observedAt: string }) => Promise<{
    affectedBlocks: number;
    modelNeedAfter: number;
  }>;
}

type CameraState = 'standby' | 'starting' | 'live' | 'unavailable';
type CaptureState = 'idle' | 'detecting' | 'saving' | 'saved' | 'error';

export default function DeliveryObservationPanel({
  active,
  missionId,
  destination,
  modelNeedBefore,
  onSave,
}: DeliveryObservationPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('standby');
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [detection, setDetection] = useState<CameraDetectionResult | null>(null);
  const [saved, setSaved] = useState<SavedDeliveryObservation | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!active || saved) return;
    let cancelled = false;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable in this browser');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState('live');
      } catch (error) {
        if (cancelled) return;
        setCameraState('unavailable');
        setMessage(error instanceof Error && error.name === 'NotAllowedError'
          ? 'Camera permission was not granted. Allow access or upload a photo instead.'
          : 'Laptop camera unavailable. Upload a photo to continue this mission.');
      }
    }

    void startCamera();
    void fetch('/api/eyepop/detect').catch(() => undefined);
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active, saved]);

  async function analyzeAndSave(image: string) {
    setCaptureUrl(image);
    setCaptureState('detecting');
    setMessage(null);
    try {
      const response = await fetch('/api/eyepop/detect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const result = await response.json() as CameraDetectionResult & { error?: string };
      if (!response.ok || !Array.isArray(result.objects)) {
        throw new Error(result.error || 'EyePop could not analyze this frame');
      }
      setDetection(result);
      const people = detectedPeople(result.objects);
      const observedAt = new Date().toISOString();
      setCaptureState('saving');
      const feedback = await onSave({
        count: people.length,
        confidence: personConfidence(result.objects),
        observedAt,
      });
      setSaved({
        count: people.length,
        confidence: personConfidence(result.objects),
        observedAt,
        affectedBlocks: feedback.affectedBlocks,
        modelNeedBefore,
        modelNeedAfter: feedback.modelNeedAfter,
      });
      setCaptureState('saved');
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    } catch (error) {
      setCaptureState('error');
      setMessage(error instanceof Error ? error.message : 'Could not save the field observation');
    }
  }

  function takePicture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const width = Math.min(960, sourceWidth);
    const height = Math.round((sourceHeight / sourceWidth) * width);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    void analyzeAndSave(canvas.toDataURL('image/jpeg', 0.82));
  }

  function uploadPicture(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') void analyzeAndSave(reader.result);
    };
    reader.onerror = () => {
      setCaptureState('error');
      setMessage('Could not read that image. Try another file.');
    };
    reader.readAsDataURL(file);
  }

  const people = detection ? detectedPeople(detection.objects) : [];
  const classes = detection ? detectedClassCounts(detection.objects) : [];
  const busy = captureState === 'detecting' || captureState === 'saving';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Delivery-zone EyePop verification">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="font-semibold text-slate-900">Delivery-zone verification</h3>
          <p className="text-xs text-slate-500">{destination} · mission {missionId}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${saved ? 'bg-emerald-100 text-emerald-800' : active ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
          <span className={`h-2 w-2 rounded-full ${active && !saved ? 'animate-pulse bg-red-500' : saved ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {saved ? 'OBSERVATION SAVED' : active ? 'CAMERA LIVE' : 'STARTS AT DELIVERY ZONE'}
        </span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.5fr_.8fr]">
        <div>
          <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            {captureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- operator-captured frame remains in memory only.
              <img src={captureUrl} alt="Captured delivery line" className="h-full w-full object-cover" />
            ) : active ? (
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" aria-label="Laptop camera preview" />
            ) : (
              <div className="grid h-full place-items-center text-center text-slate-400">
                <div><Video size={30} className="mx-auto mb-2" /><p className="text-sm">Camera deploys when the drone reaches the site.</p></div>
              </div>
            )}

            {detection && detection.sourceWidth > 0 && detection.sourceHeight > 0 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${detection.sourceWidth} ${detection.sourceHeight}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                {detection.objects.map((object, index) => (
                  <g key={`${object.label}-${index}`}>
                    <rect x={object.x} y={object.y} width={object.width} height={object.height} fill="none" stroke={object.label.toLowerCase() === 'person' ? '#fbbf24' : '#67e8f9'} strokeWidth="3" />
                    <text x={object.x} y={Math.max(14, object.y - 5)} fill="white" fontSize="14" fontWeight="700">{object.label} {(object.confidence * 100).toFixed(0)}%</text>
                  </g>
                ))}
              </svg>
            )}

            <div className="absolute left-3 top-3 rounded-lg bg-black/65 px-3 py-2 text-white backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">EyePop.ai · common objects</div>
              <div className="mt-0.5 flex items-center gap-2 text-sm font-bold text-emerald-300">
                <ScanLine size={16} />
                {detection ? `${people.length} ${people.length === 1 ? 'PERSON' : 'PEOPLE'} OBSERVED` : 'AWAITING CAPTURE'}
              </div>
            </div>
            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/65 text-sm font-semibold text-white backdrop-blur-sm">
                <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" />{captureState === 'detecting' ? 'EyePop is counting people…' : 'Saving evidence to the need model…'}</span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {active && !saved && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={takePicture} disabled={cameraState !== 'live' || busy} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Take picture &amp; save count
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                <ImageUp size={16} /> Upload photo instead
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => uploadPicture(event.target.files?.[0])} />
            </div>
          )}
          {message && <p className={`mt-2 text-xs ${captureState === 'error' || cameraState === 'unavailable' ? 'text-red-700' : 'text-slate-500'}`}>{message}</p>}
        </div>

        <div className="space-y-3">
          <div className={`rounded-xl border p-3 ${saved ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500"><span>Observation snapshot</span>{saved && <CheckCircle2 size={15} className="text-emerald-600" />}</div>
            <div className="mt-1 flex items-center gap-2 text-3xl font-semibold text-slate-950"><ScanFace size={23} className="text-emerald-600" />{detection ? people.length : '—'}</div>
            <p className="mt-1 text-xs text-slate-600">{detection ? `${people.length} visible ${people.length === 1 ? 'person' : 'people'} in the captured line` : 'One reviewed capture will be saved for this mission.'}</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Activity size={13} /> Detected in frame</div>
            {classes.length ? <div className="flex flex-wrap gap-1.5">{classes.map(([label, count]) => <span key={label} className={`rounded-full px-2 py-1 text-[11px] font-medium ${label === 'person' || label === 'people' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'}`}>{label}{count > 1 ? ` ×${count}` : ''}</span>)}</div> : <p className="text-xs text-slate-400">Capture a frame to inspect its objects.</p>}
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-medium text-slate-500">Need-model feedback</div>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
              <div><p className="text-xl font-semibold text-slate-900">{modelNeedBefore}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">prior need</p></div>
              <span className="text-slate-300">→</span>
              <div><p className="text-xl font-semibold text-emerald-700">{saved?.modelNeedAfter ?? '—'}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">updated need</p></div>
            </div>
            {saved && <p className="mt-2 text-center text-[11px] text-emerald-700">Observation assimilated across {saved.affectedBlocks} model blocks.</p>}
          </div>

          <div className="flex gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-4 text-slate-500">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <p>Only aggregate counts and confidence are saved. The captured image stays in this browser session and is not written to the model log.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
