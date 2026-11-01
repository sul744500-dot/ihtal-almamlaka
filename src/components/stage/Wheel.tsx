import { motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { WHEEL_INFO, TEAM_COLORS } from '../../lib/meta';
import { hashString } from '../../lib/rng';
import { now as clockNow } from '../../lib/clock';
import { sfx } from '../../lib/sound';
import type { GameState, WheelState } from '../../lib/types';
import { Emblem } from '../Brand';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** زاوية الدوران النهائية: ست لفات كاملة ثم التوقف عند منتصف الجائزة (مع إزاحة طبيعية صغيرة) */
export function wheelFinalAngle(w: WheelState): number {
  const seg = 360 / w.segments.length;
  const jitter = ((hashString(w.id) % 1000) / 1000 - 0.5) * seg * 0.6;
  return 360 * 6 - (w.result * seg + seg / 2) + jitter;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function WheelOverlay({ s, sound }: { s: GameState; sound: boolean }) {
  const w = s.wheel;
  if (!w) return null;
  return <WheelView key={w.id} s={s} w={w} sound={sound} />;
}

function WheelView({ s, w, sound }: { s: GameState; w: WheelState; sound: boolean }) {
  const ref = useRef<SVGGElement>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const final = useMemo(() => wheelFinalAngle(w), [w]);
  const n = w.segments.length;
  const seg = 360 / n;
  const team = TEAM_COLORS[w.team];
  const done = clockNow() > w.startedAt + w.durationMs;

  useEffect(() => {
    let raf = 0;
    let lastSeg = -1;
    let stopped = false;
    const loop = () => {
      const t = Math.min(1, Math.max(0, (clockNow() - w.startedAt) / w.durationMs));
      const angle = final * easeOut(t);
      if (ref.current) ref.current.style.transform = `rotate(${angle}deg)`;
      const segIdx = Math.floor((angle + seg / 2) / seg);
      if (segIdx !== lastSeg) {
        if (lastSeg !== -1 && t < 1 && soundRef.current) sfx.play('wheelTick');
        lastSeg = segIdx;
      }
      if (t >= 1) {
        if (!stopped && soundRef.current && clockNow() - (w.startedAt + w.durationMs) < 1500) sfx.play('wheelStop');
        stopped = true;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [w, final, seg]);

  const R = 300;
  const C = 320;
  const prize = w.segments[w.result];
  return (
    <motion.div className="absolute inset-0 z-[58] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex items-center gap-24">
        <div className="flex w-[520px] flex-col items-center gap-6 text-center">
          <h2 className="font-impact text-[120px] leading-none gold-shine">عجلة الحظ</h2>
          <div className="flex items-center gap-4 rounded-full px-8 py-3" style={{ background: `linear-gradient(90deg, ${team.dark}, ${team.main})`, border: '3px solid #f6c443' }}>
            <Emblem value={s.teams[w.team].emblem} size={60} />
            <span className="font-display text-[46px] font-bold">{s.teams[w.team].name}</span>
          </div>
          {w.applied || done ? (
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 flex flex-col items-center">
              <span className="text-[130px] leading-none">{WHEEL_INFO[prize].icon}</span>
              <span className="mt-2 font-display text-[64px] font-bold text-white">{WHEEL_INFO[prize].name}</span>
            </motion.div>
          ) : (
            <span className="mt-6 text-[40px] font-bold text-gold-100/80" style={{ animation: 'glow 1s ease-in-out infinite' }}>
              تدور… 🎡
            </span>
          )}
        </div>
        <div className="relative" style={{ width: C * 2, height: C * 2 }}>
          <svg width={C * 2} height={C * 2} viewBox={`0 0 ${C * 2} ${C * 2}`} style={{ filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.6))' }}>
            <defs>
              <radialGradient id="wheelHub">
                <stop offset="0" stopColor="#fff6cf" />
                <stop offset="1" stopColor="#b98317" />
              </radialGradient>
            </defs>
            <circle cx={C} cy={C} r={R + 18} fill="#0b1736" stroke="#f6c443" strokeWidth="10" />
            {Array.from({ length: 24 }).map((_, i) => {
              const [x, y] = polar(C, C, R + 10, (i * 360) / 24);
              return <circle key={i} cx={x} cy={y} r="6" fill={i % 2 ? '#fff6cf' : '#f6c443'} />;
            })}
            <g ref={ref} style={{ transformOrigin: `${C}px ${C}px` }}>
              {w.segments.map((p, i) => {
                const [x1, y1] = polar(C, C, R, i * seg);
                const [x2, y2] = polar(C, C, R, (i + 1) * seg);
                const [tx, ty] = polar(C, C, R * 0.64, i * seg + seg / 2);
                const info = WHEEL_INFO[p];
                return (
                  <g key={i}>
                    <path d={`M${C},${C} L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} Z`} fill={info.color} stroke="#fff3c4" strokeWidth="4" />
                    <g transform={`translate(${tx} ${ty}) rotate(${i * seg + seg / 2})`}>
                      <text textAnchor="middle" y="-14" fontSize="62">
                        {info.icon}
                      </text>
                      <text textAnchor="middle" y="44" fontSize="32" fontWeight="800" fill="#fff" style={{ fontFamily: 'var(--font-sans)' }}>
                        {info.name}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
            <circle cx={C} cy={C} r="58" fill="url(#wheelHub)" stroke="#8a5f0f" strokeWidth="5" />
            <text x={C} y={C + 18} textAnchor="middle" fontSize="50">
              👑
            </text>
          </svg>
          <div className="absolute left-1/2 top-[-18px] -translate-x-1/2">
            <svg width="70" height="90" viewBox="0 0 70 90">
              <path d="M35 88 L6 20 Q35 -10 64 20 Z" fill="#f6c443" stroke="#8a5f0f" strokeWidth="4" />
              <circle cx="35" cy="28" r="10" fill="#fff6cf" />
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
