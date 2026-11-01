import { motion } from 'motion/react';
import { useMemo } from 'react';
import { TEAM_COLORS } from '../../lib/meta';
import { computeScores } from '../../lib/scoring';
import { computeStats, fmtSec } from '../../lib/stats';
import { other, type GameState, type TeamId } from '../../lib/types';
import { Crown, Emblem } from '../Brand';
import { ScoreChart } from '../ScoreChart';

export function WinnerOverlay({ s }: { s: GameState }) {
  const sc = computeScores(s);
  const draw = s.winner === 'draw' || !s.winner;
  const w = draw ? null : (s.winner as TeamId);
  const col = w ? TEAM_COLORS[w] : null;
  return (
    <motion.div className="absolute inset-0 z-[70] flex items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
      <div className="absolute inset-0 bg-navy-950/90" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, ${col ? col.main : '#1f3a7a'}ee 0%, ${col ? col.dark : '#0b1736'}f5 40%, #040817 80%)` }} />
      <div
        className="absolute left-1/2 top-1/2 h-[2600px] w-[2600px] -translate-x-1/2 -translate-y-1/2 opacity-30"
        style={{ background: 'repeating-conic-gradient(from 0deg, rgba(255,231,163,0.55) 0deg 6deg, transparent 6deg 18deg)', animation: 'spin 40s linear infinite' }}
      />
      <div className="relative flex flex-col items-center">
        <motion.div initial={{ y: -300, rotate: -20 }} animate={{ y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 90, damping: 10, delay: 0.3 }} style={{ animation: 'float 4s ease-in-out infinite' }}>
          <Crown size={240} />
        </motion.div>
        {w ? (
          <>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 0.6 }} className="mt-2 flex h-[230px] w-[230px] items-center justify-center rounded-full p-2" style={{ background: 'conic-gradient(#ffe7a3,#b98317,#fff3c4,#e2a923,#ffe7a3)' }}>
              <div className="flex h-full w-full items-center justify-center rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${col!.light}, ${col!.main} 50%, ${col!.dark})` }}>
                <Emblem value={s.teams[w].emblem} size={150} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-4 font-display text-[54px] font-bold text-gold-100">
              🏆 الفائز
            </motion.div>
            <motion.h1 initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.0, duration: 0.6 }} className="font-impact text-[200px] leading-[1.05] gold-shine" style={{ filter: 'drop-shadow(0 10px 0 rgba(0,0,0,0.45))' }}>
              {s.teams[w].name}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="font-display text-[56px] font-bold text-white">
              يحتلّ المملكة! 👑
            </motion.p>
          </>
        ) : (
          <motion.h1 initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6 font-impact text-[200px] leading-none gold-shine">
            تعادل!
          </motion.h1>
        )}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }} className="mt-8 flex items-center gap-10 rounded-full border-4 border-gold-400/70 bg-navy-950/80 px-14 py-4">
          {(['red', 'blue'] as TeamId[]).map((t, i) => (
            <div key={t} className="flex items-center gap-5">
              {i === 1 && <span className="font-impact text-[70px] text-gold-300">-</span>}
              <Emblem value={s.teams[t].emblem} size={70} />
              <span className="font-impact text-[96px] leading-none" style={{ color: TEAM_COLORS[t].light, textShadow: `0 0 30px ${TEAM_COLORS[t].glow}` }}>
                {sc[t].total}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatRow({ label, red, blue, better = 'high' }: { label: string; red: string | number; blue: string | number; better?: 'high' | 'low' | 'none' }) {
  const rn = typeof red === 'number' ? red : parseFloat(red);
  const bn = typeof blue === 'number' ? blue : parseFloat(blue);
  const win = better === 'none' || Number.isNaN(rn) || Number.isNaN(bn) || rn === bn ? null : (better === 'high' ? rn > bn : rn < bn) ? 'red' : 'blue';
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 border-b border-white/10 py-3">
      <span className={`text-center font-impact text-[52px] ${win === 'red' ? 'text-team-red-light' : 'text-white/80'}`}>{red}</span>
      <span className="w-[360px] text-center font-display text-[32px] font-bold text-gold-100">{label}</span>
      <span className={`text-center font-impact text-[52px] ${win === 'blue' ? 'text-team-blue-light' : 'text-white/80'}`}>{blue}</span>
    </div>
  );
}

/** إحصائيات المباراة على شاشة الجمهور */
export function StatsStage({ s }: { s: GameState }) {
  const st = useMemo(() => computeStats(s), [s]);
  const r = st.teams.red;
  const b = st.teams.blue;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <motion.div
      className="absolute inset-0 z-[72] flex flex-col px-[90px] py-[50px]"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #1d3a86 0%, #0b1736 50%, #040817 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex items-center justify-between">
        {(['red', 'blue'] as TeamId[]).map((t) => (
          <div key={t} className="flex items-center gap-5" style={{ order: t === 'red' ? 0 : 2 }}>
            <Emblem value={s.teams[t].emblem} size={90} />
            <div>
              <div className="font-display text-[54px] font-bold" style={{ color: TEAM_COLORS[t].light }}>
                {s.teams[t].name}
              </div>
              <div className="font-impact text-[64px] leading-none text-white">{st.teams[t].score} نقطة</div>
            </div>
          </div>
        ))}
        <div className="order-1 flex flex-col items-center">
          <Crown size={90} />
          <h2 className="font-display text-[64px] font-bold gold-shine">إحصائيات المباراة</h2>
        </div>
      </div>
      <div className="mt-8 grid flex-1 grid-cols-[1fr_640px] gap-12">
        <div>
          <StatRow label="الإجابات الصحيحة" red={r.correct} blue={b.correct} />
          <StatRow label="دقة الإجابة" red={pct(r.accuracy)} blue={pct(b.accuracy)} />
          <StatRow label="المناطق المحتلة" red={r.cells} blue={b.cells} />
          <StatRow label="السرقات الناجحة" red={r.steals} blue={b.steals} />
          <StatRow label="المناطق الذهبية" red={r.golden} blue={b.golden} />
          <StatRow label="متوسط زمن الإجابة" red={fmtSec(r.avgMs)} blue={fmtSec(b.avgMs)} better="low" />
          <StatRow label="أطول سلسلة صحيحة" red={r.longestStreak} blue={b.longestStreak} />
        </div>
        <div className="flex flex-col gap-6">
          <div className="panel p-6">
            <div className="mb-3 font-display text-[34px] font-bold text-gold-200">تطور النتيجة</div>
            <ScoreChart s={s} timeline={st.timeline} height={330} big />
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="panel p-4">
              <div className="text-[26px] text-slate-300">تبدّل الصدارة</div>
              <div className="font-impact text-[60px] text-gold-300">{st.leadChanges}</div>
            </div>
            <div className="panel p-4">
              <div className="text-[26px] text-slate-300">أسرع إجابة</div>
              <div className="font-impact text-[50px]" style={{ color: st.fastest ? TEAM_COLORS[st.fastest.team].light : '#fff' }}>
                {st.fastest ? fmtSec(st.fastest.ms) : '—'}
              </div>
            </div>
            {st.biggestLead && (
              <div className="panel col-span-2 p-4 text-[30px] font-bold">
                أكبر تقدم: <span style={{ color: TEAM_COLORS[st.biggestLead.team].light }}>{s.teams[st.biggestLead.team].name}</span> بفارق {st.biggestLead.value} — أمام {s.teams[other(st.biggestLead.team)].name}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
