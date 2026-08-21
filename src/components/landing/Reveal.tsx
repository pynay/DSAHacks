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
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add('is-visible');
            observer.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={variant} style={{ ['--reveal-delay' as string]: `${delay}ms` }} className={className}>
      {children}
    </div>
  );
}
