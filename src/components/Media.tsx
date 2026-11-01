import { useMemo } from 'react';
import { flagSvg } from '../lib/flags';
import { useNow } from '../lib/hooks';
import { timerElapsed } from '../lib/timer';
import type { QuestionMedia, TimerState } from '../lib/types';

/** يعرض صورة السؤال (إيموجي/علم/صورة) مع إمكانية الكشف التدريجي مع المؤقت */
export function Media({
  media,
  height = 280,
  timer,
  clear = false,
}: {
  media: QuestionMedia;
  height?: number;
  timer?: TimerState;
  /** إظهار كامل (بعد الإجابة أو للمقدم) */
  clear?: boolean;
}) {
  const progressive = !!media.progressive && !clear && !!timer;
  const now = useNow(100, progressive && timer?.startedAt !== null);
  const svg = useMemo(() => (media.kind === 'flag' ? flagSvg(media.value) : null), [media]);

  let blur = 0;
  let scale = 1;
  if (progressive && timer) {
    const p = Math.min(1, timerElapsed(timer, now) / Math.max(1, timer.durationMs));
    blur = 22 * Math.pow(1 - p, 1.3);
    scale = 1 + 1.4 * (1 - p);
  }
  const style = { filter: blur > 0.2 ? `blur(${blur}px)` : undefined, transform: `scale(${scale})`, transition: 'filter 0.15s linear, transform 0.15s linear' };

  if (media.kind === 'emoji') {
    return (
      <div className="flex items-center justify-center" style={{ height }} dir="ltr">
        <span className="leading-none tracking-wide" style={{ fontSize: Math.min(height * 0.62, 2600 / Math.max(3, [...media.value].length)), ...style }}>
          {media.value}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div
        className="overflow-hidden rounded-2xl border-4 border-white/80 bg-white/5 shadow-2xl"
        style={{ height, aspectRatio: media.kind === 'flag' ? '3 / 2' : undefined, maxWidth: '100%' }}
      >
        {svg ? (
          <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" style={style} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : media.kind === 'image' ? (
          <img src={media.value} alt="" className="h-full w-auto max-w-full object-contain" style={style} draggable={false} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-slate-400">علم غير معروف</div>
        )}
      </div>
    </div>
  );
}
