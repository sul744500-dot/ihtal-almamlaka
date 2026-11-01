import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { roundOf, totalTurns } from '../../lib/engine';
import { ABILITY_INFO, EVENT_INFO, TEAM_COLORS } from '../../lib/meta';
import type { TeamScore } from '../../lib/scoring';
import { other, type GameState, type TeamId } from '../../lib/types';
import { useFx } from '../../store/fx';
import { Crown, Emblem } from '../Brand';

export function TeamPanel({ s, team, score, streak, active }: { s: GameState; team: TeamId; score: TeamScore; streak: number; active: boolean }) {
  const t = s.teams[team];
  const col = TEAM_COLORS[team];
  const allPops = useFx((st) => st.pops);
  const pops = useMemo(() => allPops.filter((p) => p.team === team), [allPops, team]);
  const slots = s.rules.abilitiesEnabled ? s.rules.maxAbilities : 0;
  return (
    <div
      className="relative flex h-[820px] w-[380px] shrink-0 flex-col items-center rounded-[40px] px-6 pb-6 pt-8"
      style={{
        background: `linear-gradient(180deg, ${col.dark}cc 0%, rgba(8,17,41,0.92) 55%, rgba(4,8,23,0.95) 100%)`,
        border: `3px solid ${active ? '#ffe7a3' : `${col.light}88`}`,
        boxShadow: active ? `0 0 60px -6px ${col.glow}, 0 0 0 6px ${col.main}33, inset 0 0 50px ${col.main}33` : `0 20px 60px -20px rgba(0,0,0,0.8)`,
        transition: 'box-shadow 0.4s, border-color 0.4s',
      }}
    >
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="absolute -top-6 rounded-full px-6 py-1.5 font-display text-[26px] font-bold text-navy-950 shadow-lg"
            style={{ background: 'linear-gradient(180deg,#ffe7a3,#f6c443)' }}
          >
            🎯 الدور الآن
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex h-[190px] w-[190px] items-center justify-center rounded-full p-[6px]" style={{ background: 'conic-gradient(from 0deg, #ffe7a3, #b98317, #fff3c4, #e2a923, #ffe7a3)' }}>
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${col.light}, ${col.main} 45%, ${col.dark})` }}>
          <Emblem value={t.emblem} size={128} />
        </div>
        {active && <span className="pointer-events-none absolute inset-[-10px] rounded-full border-4 border-gold-300/70" style={{ animation: 'glow 1.4s ease-in-out infinite' }} />}
      </div>

      <h2 className="mt-4 max-w-full truncate text-center font-display text-[46px] font-bold leading-tight text-white" style={{ textShadow: `0 0 24px ${col.glow}` }}>
        {t.name}
      </h2>

      <div className="relative mt-1 flex h-[190px] items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={score.total}
            initial={{ scale: 1.6, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="font-impact text-[190px] leading-none tabular-nums text-white"
            style={{ textShadow: `0 0 40px ${col.glow}, 0 6px 0 ${col.dark}` }}
          >
            {score.total}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence>
          {pops.map((p) => (
            <motion.span
              key={p.id}
              initial={{ y: 0, opacity: 0, scale: 0.6 }}
              animate={{ y: -120, opacity: [0, 1, 1, 0], scale: 1.2 }}
              transition={{ duration: 1.6, ease: 'easeOut' }}
              className="absolute top-6 font-impact text-[64px]"
              style={{ color: p.value > 0 ? '#ffd86b' : '#f87171', textShadow: '0 0 20px rgba(0,0,0,0.8)' }}
            >
              {p.value > 0 ? `+${p.value}` : p.value}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <div className="-mt-2 text-[24px] font-bold text-gold-200/80">نقطة</div>

      <div className="mt-5 flex w-full items-center justify-center gap-3 text-[22px] font-bold">
        <span className="rounded-2xl bg-white/10 px-4 py-2">🏴 {score.cells}</span>
        <span className="rounded-2xl bg-gold-400/15 px-4 py-2 text-gold-200">⭐ {score.golden}</span>
        {score.crown && (
          <span className="flex items-center rounded-2xl bg-gold-400/25 px-3 py-1">
            <Crown size={40} glow={false} />
          </span>
        )}
      </div>

      {slots > 0 && (
        <div className="mt-5 flex items-center gap-3">
          {Array.from({ length: slots }).map((_, i) => {
            const ab = t.abilities[i];
            return (
              <div
                key={i}
                className={`flex h-[78px] w-[78px] flex-col items-center justify-center rounded-2xl ${ab ? 'border-2 border-gold-300/80 bg-gold-400/15' : 'border-2 border-dashed border-white/15'}`}
                title={ab ? ABILITY_INFO[ab].name : 'فارغ'}
              >
                {ab ? (
                  <>
                    <span className="text-[36px] leading-none">{ABILITY_INFO[ab].icon}</span>
                    <span className="mt-1 text-[13px] font-bold text-gold-100">{ABILITY_INFO[ab].name}</span>
                  </>
                ) : (
                  <span className="text-2xl text-white/20">＋</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto flex flex-col items-center gap-2">
        {streak >= 2 && (
          <motion.div key={streak} initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="rounded-full bg-orange-500/20 px-5 py-1.5 text-[24px] font-black text-orange-300">
            🔥 {streak} متتالية
          </motion.div>
        )}
        {score.bonus !== 0 && <div className="text-[20px] font-bold text-slate-300">مكافآت: {score.bonus > 0 ? `+${score.bonus}` : score.bonus}</div>}
      </div>
    </div>
  );
}

export function TopBar({ s }: { s: GameState }) {
  const total = totalTurns(s);
  const turn = Math.min(s.turn, total - 1);
  const round = roundOf(turn);
  const crownIn = s.rules.crownEnabled && !s.crownActive ? s.rules.rounds - s.rules.crownRounds + 1 - round : null;
  const finalRound = s.rules.finalRoundEnabled && round === s.rules.rounds && s.phase !== 'tiebreak' && s.phase !== 'finished';
  const progress = s.phase === 'finished' || s.phase === 'tiebreak' ? 1 : turn / total;
  return (
    <div className="relative flex h-[140px] items-center justify-between px-[50px]">
      <div className="flex w-[520px] flex-wrap items-center gap-3">
        {s.pendingEvent && (
          <span className="rounded-full border-2 border-yellow-300/70 bg-yellow-400/15 px-5 py-2 text-[24px] font-bold text-yellow-200">
            {EVENT_INFO[s.pendingEvent].icon} {EVENT_INFO[s.pendingEvent].name} قادم
          </span>
        )}
        {s.wheelPending && (
          <span className="rounded-full border-2 border-fuchsia-300/60 bg-fuchsia-500/15 px-5 py-2 text-[24px] font-bold text-fuchsia-200">🎡 عجلة الحظ لـ{s.teams[s.wheelPending].name}</span>
        )}
      </div>

      <div className="flex flex-col items-center">
        <div className="flex items-center gap-4">
          <Crown size={64} />
          <h1 className="font-display text-[64px] font-bold leading-none">
            <span className="gold-shine">احتلّ المملكة</span>
          </h1>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <span className="rounded-full border border-gold-400/50 bg-navy-950/70 px-6 py-1 text-[26px] font-bold text-gold-100">
            {s.phase === 'tiebreak' ? '⚖️ الجولة الفاصلة' : s.phase === 'finished' ? '🏁 انتهت المباراة' : `الجولة ${round} من ${s.rules.rounds}`}
          </span>
          <div className="h-3 w-[260px] overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-l from-gold-200 to-gold-500" style={{ width: `${progress * 100}%`, transition: 'width 0.6s' }} />
          </div>
        </div>
      </div>

      <div className="flex w-[520px] flex-wrap items-center justify-end gap-3">
        {finalRound && <span className="rounded-full border-2 border-red-400/70 bg-red-500/20 px-5 py-2 text-[24px] font-black text-red-200">⚔️ الجولة الحاسمة</span>}
        {s.rules.crownEnabled && (
          <span className={`rounded-full border-2 px-5 py-2 text-[24px] font-bold ${s.crownActive ? 'border-gold-300 bg-gold-400/20 text-gold-100' : 'border-white/15 bg-white/5 text-slate-300'}`}>
            👑 {s.crownActive ? 'التاج متاح!' : crownIn && crownIn > 0 ? `التاج بعد ${crownIn} ${crownIn === 1 ? 'جولة' : 'جولات'}` : 'التاج'}
          </span>
        )}
      </div>
    </div>
  );
}

export function Ticker({ s }: { s: GameState }) {
  const c = s.current;
  const name = (t: TeamId | null | undefined) => (t ? s.teams[t].name : '');
  let text: string;
  let color = '#ffe7a3';
  if (s.phase === 'finished') {
    text = s.winner === 'draw' ? '🤝 انتهت المباراة بالتعادل' : `🏆 ${name(s.winner as TeamId)} يحتلّ المملكة!`;
  } else if (s.phase === 'tiebreak') {
    text = c ? '⚖️ سؤال فاصل — أول إجابة صحيحة تحسم المباراة!' : '⚖️ جولة فاصلة — استعدوا للسؤال الحاسم';
  } else if (c && s.phase === 'question') {
    color = TEAM_COLORS[c.answering!].light;
    text = c.rebound ? `↩️ فرصة الرد لـ${name(c.answering)} — أجيبوا لتأخذوا المنطقة` : `⏳ ${name(c.answering)} يجيب الآن`;
  } else if (c && s.phase === 'result') {
    const answer = c.revealed ? ` — الإجابة: ${c.q.answer}` : '';
    if (c.result === 'correct') {
      color = '#6ee7b7';
      text = `✅ إجابة صحيحة من ${name(c.resultTeam)}${answer}`;
    } else {
      color = '#fca5a5';
      text = `❌ ${c.timer.expired ? 'انتهى الوقت' : 'إجابة خاطئة'}${answer}`;
    }
  } else if (s.selectedCell !== null) {
    const cell = s.cells[s.selectedCell];
    const attack = cell.owner && cell.owner !== s.activeTeam;
    color = TEAM_COLORS[s.activeTeam].light;
    text = attack ? `⚔️ ${name(s.activeTeam)} يهاجم «${cell.name}» من ${name(other(s.activeTeam))}!` : `🎯 ${name(s.activeTeam)} اختار «${cell.name}»`;
  } else {
    color = TEAM_COLORS[s.activeTeam].light;
    text = `🎯 دور ${name(s.activeTeam)} — اختاروا منطقة للاحتلال أو الهجوم`;
  }
  return (
    <div className="absolute bottom-[22px] left-1/2 flex h-[86px] w-[1400px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-gold-400/50 bg-navy-950/85 px-10 shadow-2xl">
      <AnimatePresence mode="wait">
        <motion.span
          key={text}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="truncate font-display text-[36px] font-bold"
          style={{ color }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
