'use client';

// A 2px emerald thread under the landing header showing scroll progress —
// the story has a length, and the thread tells you where you are in it.
import { useEffect, useState } from 'react';

export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-200/60">
      <div className="h-full bg-[#3ca875]" style={{ width: `${pct}%` }} />
    </div>
  );
}
