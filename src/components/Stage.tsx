import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/**
 * مسرح بدقة ثابتة 1920×1080 يتم تصغيره/تكبيره ليناسب أي نافذة
 * (مهم لتصوير OBS: يبقى التصميم متطابقًا في أي حجم)
 */
export function Stage({ children, className = '', background = '#000' }: { children: ReactNode; className?: string; background?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ s: 0, x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.min(w / STAGE_W, h / STAGE_H);
      setBox({ s, x: (w - STAGE_W * s) / 2, y: (h - STAGE_H * s) / 2 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative h-full w-full overflow-hidden ${className}`} style={{ background }}>
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: STAGE_W,
          height: STAGE_H,
          transformOrigin: '0 0',
          transform: `translate(${box.x}px, ${box.y}px) scale(${box.s})`,
          visibility: box.s ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
