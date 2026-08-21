'use client';

// Scroll-reveal wrapper: adds .is-visible once ~20% of the element enters the
// viewport (once only — story pages should not re-hide on scroll-back).
// Motion itself lives in globals.css under [data-reveal], where the global
// reduced-motion kill-switch already neutralizes it.
import { useEffect, useRef, type ReactNode } from 'react';

export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  className,
}: {
  children: ReactNode;
  variant?: 'up' | 'left' | 'scale';
  delay?: number; // ms, staggering siblings
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Attach after first paint settles: elements already in the viewport at
    // load (hero-adjacent sections) then transition visibly instead of
    // snapping to visible mid-hydration.
    let observer: IntersectionObserver | undefined;
    const timer = window.setTimeout(() => {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              node.classList.add('is-visible');
              observer?.disconnect();
            }
          }
        },
        // Fire once ~12% of the element is inside the viewport's inner band,
        // so scrolling into a section reads unmistakably as the trigger.
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
      );
      observer.observe(node);
    }, 140);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={ref} data-reveal={variant} style={{ ['--reveal-delay' as string]: `${delay}ms` }} className={className}>
      {children}
    </div>
  );
}
