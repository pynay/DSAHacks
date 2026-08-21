'use client';

// Counts a stat like "850K", "4.1M", or "52M lbs" up from zero the first time
// it scrolls into view. The finished value is always in the accessibility
// tree; the animation is presentation only and is skipped for reduced motion.
import { useEffect, useRef, useState } from 'react';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function CountUp({ value, duration = 1400 }: { value: string; duration?: number }) {
  const match = /^([\d.]+)(.*)$/.exec(value);
  const target = match ? Number(match[1]) : NaN;
  const suffix = match ? match[2] : '';
  const decimals = match && match[1].includes('.') ? match[1].split('.')[1].length : 0;

  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || Number.isNaN(target)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          setDisplay(`${(target * easeOut(t)).toFixed(decimals)}${suffix}`);
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        setDisplay(`${(0).toFixed(decimals)}${suffix}`);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- value parsing is derived from the prop
  }, [value, duration]);

  return (
    <span ref={ref}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
