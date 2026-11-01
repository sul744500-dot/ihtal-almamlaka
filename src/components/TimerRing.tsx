import { useNow } from '../lib/hooks';
import { timerRemaining } from '../lib/timer';
import type { TimerState } from '../lib/types';

export function TimerRing({ timer, size = 150, stroke = 12, frozen = false }: { timer: TimerState; size?: number; stroke?: number; frozen?: boolean }) {
  const now = useNow(100, timer.startedAt !== null && !frozen);
  const remaining = timerRemaining(timer, frozen ? (timer.startedAt ?? now) : now);
  const p = timer.durationMs ? remaining / timer.durationMs : 0;
  const sec = Math.ceil(remaining / 1000);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const running = timer.startedAt !== null;
  const color = timer.expired || sec <= 0 ? '#ef4444' : sec <= 3 ? '#f97316' : sec <= 5 ? '#fbbf24' : '#ffd86b';
  const urgent = running && sec <= 5 && sec > 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="rgba(4,8,23,0.85)" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s', filter: `drop-shadow(0 0 ${size / 12}px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-impact leading-none tabular-nums"
          style={{
            fontSize: size * 0.44,
            color,
            textShadow: `0 0 ${size / 8}px ${color}`,
            animation: urgent ? 'glow 0.5s ease-in-out infinite' : timer.expired ? 'blink-red 0.8s ease-in-out infinite' : undefined,
          }}
        >
          {Math.max(0, sec)}
        </span>
        {!running && !timer.expired && remaining > 0 && (
          <span className="font-bold text-slate-300" style={{ fontSize: size * 0.1 }}>
            {timer.elapsedMs > 0 ? 'متوقف' : 'جاهز'}
          </span>
        )}
      </div>
    </div>
  );
}

/** شريط وقت أفقي صغير (للوحة المقدم) */
export function TimerBar({ timer }: { timer: TimerState }) {
  const now = useNow(100, timer.startedAt !== null);
  const remaining = timerRemaining(timer, now);
  const p = timer.durationMs ? remaining / timer.durationMs : 0;
  const sec = Math.ceil(remaining / 1000);
  const color = sec <= 3 ? '#ef4444' : sec <= 5 ? '#fbbf24' : '#34d399';
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-center font-impact text-4xl tabular-nums" style={{ color }}>
        {sec}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: color, transition: 'width 0.1s linear' }} />
      </div>
    </div>
  );
}
