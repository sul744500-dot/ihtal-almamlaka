import { AnimatePresence, motion } from 'motion/react';
import { TEAM_COLORS } from '../../lib/meta';
import type { GameState } from '../../lib/types';
import { useFx, type Banner } from '../../store/fx';
import { Crown, Emblem } from '../Brand';

const VARIANT_STYLE: Partial<Record<Banner['variant'], { from: string; to: string; title: string }>> = {
  remontada: { from: '#7c2d12', to: '#dc2626', title: 'linear-gradient(180deg,#fff7ed,#fdba74 40%,#f97316 70%,#fde68a)' },
  'final-round': { from: '#450a0a', to: '#991b1b', title: 'linear-gradient(180deg,#fff,#fecaca 50%,#f87171)' },
  event: { from: '#3b0764', to: '#7e22ce', title: 'linear-gradient(180deg,#fff,#f5d0fe 50%,#e879f9)' },
  tiebreak: { from: '#0c4a6e', to: '#0369a1', title: 'linear-gradient(180deg,#fff,#bae6fd 50%,#38bdf8)' },
  announce: { from: '#1e3a8a', to: '#1e40af', title: 'linear-gradient(180deg,#fffbe8,#ffe39a 40%,#f6c443 70%,#ffe7a3)' },
};

function BigBanner({ b, s }: { b: Banner; s: GameState }) {
  const team = b.team ? TEAM_COLORS[b.team] : null;
  const v = VARIANT_STYLE[b.variant];
  const from = team && b.variant !== 'event' ? team.dark : (v?.from ?? '#0b1736');
  const to = team && b.variant !== 'event' ? team.main : (v?.to ?? '#16295c');
  const titleBg = v?.title ?? 'linear-gradient(180deg,#fffbe8,#ffe39a 30%,#f6c443 60%,#c98f1a 80%,#ffe7a3)';
  const crownish = b.variant === 'crown-appears' || b.variant === 'crown-capture' || b.variant === 'start';
  return (
    <motion.div className="absolute inset-0 z-[60] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/55" />
      <motion.div
        className="relative flex h-[420px] w-[2100px] items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(90deg, transparent, ${from} 12%, ${to} 50%, ${from} 88%, transparent)`, borderTop: '5px solid #f6c443', borderBottom: '5px solid #f6c443' }}
        initial={{ scaleY: 0, skewY: -4 }}
        animate={{ scaleY: 1, skewY: -2 }}
        exit={{ scaleY: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      >
        <motion.div
          className="absolute inset-y-0 w-[400px]"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
          initial={{ x: 1400 }}
          animate={{ x: -1400 }}
          transition={{ duration: 1.4, delay: 0.25, ease: 'easeInOut' }}
        />
        <div className="relative flex flex-col items-center">
          <motion.div initial={{ y: -80, scale: 0.3, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}>
            {crownish ? (
              <Crown size={150} />
            ) : b.team && b.variant === 'remontada' ? (
              <div className="flex items-center gap-4 text-[110px] leading-none">
                🔥
                <Emblem value={s.teams[b.team].emblem} size={120} />
                🔥
              </div>
            ) : (
              <span className="text-[120px] leading-none" style={{ filter: 'drop-shadow(0 0 30px rgba(0,0,0,0.6))' }}>
                {b.icon}
              </span>
            )}
          </motion.div>
          <motion.h2
            initial={{ scale: 2.4, opacity: 0, letterSpacing: '0.2em' }}
            animate={{ scale: 1, opacity: 1, letterSpacing: '0em' }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
            className="mt-2 font-impact text-[150px] leading-[1.05]"
            style={{ backgroundImage: titleBg, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.45))' }}
          >
            {b.title}
          </motion.h2>
          {b.sub && (
            <motion.p initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="mt-1 max-w-[1500px] text-center font-display text-[44px] font-bold text-white" style={{ textShadow: '0 3px 10px rgba(0,0,0,0.6)' }}>
              {b.sub}
            </motion.p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MidBanner({ b }: { b: Banner }) {
  const team = b.team ? TEAM_COLORS[b.team] : null;
  const steal = b.variant === 'steal';
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-[55] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {steal && team && (
        <motion.div
          className="absolute h-[260px] w-[2600px]"
          style={{ background: `linear-gradient(90deg, transparent, ${team.main}, ${team.light}, ${team.main}, transparent)`, rotate: -12 }}
          initial={{ x: 2400 }}
          animate={{ x: 0 }}
          exit={{ x: -2400 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      )}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, rotate: steal ? -12 : 0 }}
        animate={{ scale: 1, opacity: 1, rotate: steal ? -6 : 0 }}
        exit={{ scale: 1.3, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="relative flex max-w-[1300px] items-center gap-8 rounded-[40px] px-14 py-8"
        style={{
          background: steal ? 'rgba(4,8,23,0.92)' : `linear-gradient(180deg, ${team ? team.dark : '#16295c'}f2, rgba(4,8,23,0.95))`,
          border: '5px solid #f6c443',
          boxShadow: `0 0 90px ${team ? team.glow : 'rgba(246,196,67,0.5)'}`,
        }}
      >
        {b.icon && <span className="text-[120px] leading-none">{b.icon}</span>}
        <div className="flex flex-col">
          <span className="font-impact text-[110px] leading-none gold-text" style={{ filter: 'drop-shadow(0 5px 0 rgba(0,0,0,0.5))' }}>
            {b.title}
          </span>
          {b.sub && <span className="mt-3 font-display text-[40px] font-bold text-white">{b.sub}</span>}
        </div>
      </motion.div>
    </motion.div>
  );
}

function LowerBanner({ b, s }: { b: Banner; s: GameState }) {
  const team = b.team ? TEAM_COLORS[b.team] : TEAM_COLORS.red;
  return (
    <motion.div
      className="pointer-events-none absolute bottom-[140px] left-1/2 z-[50] -translate-x-1/2"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div className="flex items-center gap-5 rounded-full px-12 py-4" style={{ background: `linear-gradient(90deg, ${team.dark}, ${team.main}, ${team.dark})`, border: '4px solid #f6c443', boxShadow: `0 0 60px ${team.glow}` }}>
        {b.team && <Emblem value={s.teams[b.team].emblem} size={70} />}
        <div className="flex flex-col">
          <span className="font-display text-[54px] font-bold leading-tight text-white">{b.title}</span>
          {b.sub && <span className="text-[26px] font-bold text-gold-100/90">{b.sub}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function Banners({ s }: { s: GameState }) {
  const b = useFx((st) => st.current);
  const flash = useFx((st) => st.flash);
  return (
    <>
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.key}
            className="pointer-events-none absolute inset-0 z-[45]"
            style={{ background: `radial-gradient(circle at center, ${flash.color}88, transparent 70%)` }}
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {b && b.kind === 'big' && <BigBanner key={b.id} b={b} s={s} />}
        {b && b.kind === 'mid' && <MidBanner key={b.id} b={b} />}
        {b && b.kind === 'lower' && <LowerBanner key={b.id} b={b} s={s} />}
      </AnimatePresence>
    </>
  );
}
