import { AnimatePresence, motion } from 'motion/react';
import { useNow } from '../../lib/hooks';
import { CATEGORY_MAP, DIFFICULTY_INFO, TEAM_COLORS } from '../../lib/meta';
import type { CurrentQuestion, GameState } from '../../lib/types';
import { Emblem } from '../Brand';
import { Media } from '../Media';
import { TimerRing } from '../TimerRing';

export const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

/** مدة بقاء بطاقة السؤال بعد الحكم قبل أن تختفي لتظهر حركة الاحتلال */
export const RESULT_HOLD_MS = 2200;

function textSize(len: number, hasMedia: boolean): string {
  if (hasMedia) return len > 70 ? 'text-[36px]' : 'text-[44px]';
  if (len > 120) return 'text-[42px]';
  if (len > 80) return 'text-[48px]';
  return 'text-[58px]';
}

function OptionBox({ c, i, revealed }: { c: CurrentQuestion; i: number; revealed: boolean }) {
  const hidden = c.hiddenOptions.includes(i);
  const wrongPick = c.wrongPicks.includes(i);
  const isCorrect = i === c.q.correct;
  const picked = c.picked === i;
  let bg = 'linear-gradient(180deg, rgba(31,58,122,0.85), rgba(15,31,71,0.9))';
  let border = 'rgba(246,196,67,0.45)';
  let mark = '';
  let glow = 'none';
  if (revealed && isCorrect) {
    bg = 'linear-gradient(180deg, #34d399, #047857)';
    border = '#a7f3d0';
    mark = '✔';
    glow = '0 0 40px rgba(52,211,153,0.7)';
  } else if (wrongPick || (c.result === 'wrong' && picked)) {
    bg = 'linear-gradient(180deg, #f87171, #991b1b)';
    border = '#fecaca';
    mark = '✖';
  } else if (picked && !c.result) {
    bg = 'linear-gradient(180deg, #fbbf24, #b45309)';
    border = '#fde68a';
    mark = '🔒';
    glow = '0 0 34px rgba(251,191,36,0.7)';
  } else if (picked && c.result === 'correct') {
    bg = 'linear-gradient(180deg, #34d399, #047857)';
    border = '#a7f3d0';
    mark = '✔';
  }
  const len = c.q.options[i].length;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: hidden ? 0.18 : 1, y: 0, scale: picked && !c.result ? 1.03 : 1 }}
      transition={{ delay: 0.25 + i * 0.08 }}
      className="relative flex h-[112px] items-center gap-5 rounded-[28px] px-6"
      style={{ background: bg, border: `3px solid ${border}`, boxShadow: glow, textDecoration: hidden ? 'line-through' : undefined }}
    >
      <span className="flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full bg-navy-950/70 font-display text-[36px] font-bold text-gold-300">{LETTERS[i]}</span>
      <span className={`flex-1 font-bold leading-tight text-white ${len > 32 ? 'text-[28px]' : len > 20 ? 'text-[34px]' : 'text-[40px]'}`}>{c.q.options[i]}</span>
      {mark && <span className="text-[44px]">{mark}</span>}
      {hidden && <span className="text-[32px]">✂️</span>}
    </motion.div>
  );
}

export function StageQuestion({ s }: { s: GameState }) {
  const c = s.current;
  const now = useNow(200, !!c?.result);
  const visible = !!c && !(c.result && c.judgedAt && now - c.judgedAt > RESULT_HOLD_MS);
  return <AnimatePresence>{visible && c && <QuestionCard key={`${c.q.id}:${c.shownAt}`} s={s} c={c} />}</AnimatePresence>;
}

function QuestionCard({ s, c }: { s: GameState; c: CurrentQuestion }) {
  const cat = CATEGORY_MAP[c.q.category];
  const diff = DIFFICULTY_INFO[c.difficulty];
  const cell = c.cellId !== null ? s.cells[c.cellId] : null;
  const team = c.answering;
  const col = team ? TEAM_COLORS[team] : null;
  const revealed = c.revealed;
  const hasMedia = !!c.q.media;
  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <div className="absolute inset-[-20px] rounded-[48px] bg-navy-950/70 backdrop-blur-[3px]" />
      <motion.div
        initial={{ scale: 0.6, rotateX: 35, y: 60 }}
        animate={{ scale: 1, rotateX: 0, y: 0 }}
        exit={{ scale: 0.85, y: 40 }}
        transition={{ type: 'spring', stiffness: 170, damping: 18 }}
        className="relative flex h-[800px] w-[1080px] flex-col rounded-[44px] px-10 pb-8 pt-7"
        style={{
          background: 'linear-gradient(180deg, rgba(22,41,92,0.98) 0%, rgba(8,17,41,0.98) 100%)',
          border: '4px solid #f6c443',
          boxShadow: `0 0 0 8px rgba(246,196,67,0.12), 0 30px 120px -20px ${col ? col.glow : 'rgba(246,196,67,0.5)'}`,
          transformPerspective: 1200,
        }}
      >
        {/* الرأس */}
        <div className="flex items-center gap-3 pe-[150px]">
          <span className="flex items-center gap-2 rounded-full px-5 py-2 text-[26px] font-bold" style={{ background: `${cat.color}22`, color: cat.color, border: `2px solid ${cat.color}66` }}>
            {cat.icon} {cat.name}
          </span>
          <span className="rounded-full px-4 py-2 text-[24px] font-bold" style={{ color: diff.color, background: `${diff.color}1f`, border: `2px solid ${diff.color}55` }}>
            {'★'.repeat(diff.stars)}
            {'☆'.repeat(3 - diff.stars)} {diff.name}
          </span>
          {c.mode === 'tiebreak' ? (
            <span className="rounded-full bg-gold-400 px-5 py-2 text-[26px] font-black text-navy-950">⚖️ سؤال فاصل</span>
          ) : cell ? (
            <span className={`rounded-full px-5 py-2 text-[26px] font-black ${c.mode === 'attack' ? 'bg-red-600 text-white' : 'bg-white/10 text-gold-100'}`}>
              {c.mode === 'attack' ? '⚔️ هجوم:' : cell.kind === 'crown' ? '👑' : '🏴'} {cell.name}
              {cell.kind === 'golden' && ' ⭐'}
            </span>
          ) : null}
        </div>

        <div className="absolute -top-10 end-6">
          <TimerRing timer={c.timer} size={170} stroke={14} />
        </div>

        {/* الفريق المجيب */}
        <div className="mt-5 flex items-center gap-4">
          {team && col ? (
            <div className="flex items-center gap-3 rounded-2xl px-5 py-2" style={{ background: `linear-gradient(90deg, ${col.main}, ${col.dark})` }}>
              <Emblem value={s.teams[team].emblem} size={46} />
              <span className="font-display text-[32px] font-bold">{c.rebound ? 'فرصة الرد:' : 'يجيب:'} {s.teams[team].name}</span>
            </div>
          ) : (
            <div className="rounded-2xl bg-gold-400/15 px-5 py-2 font-display text-[30px] font-bold text-gold-100">⚡ أول فريق يجيب إجابة صحيحة يفوز!</div>
          )}
          {c.lightning && <span className="rounded-full bg-yellow-400/20 px-4 py-2 text-[26px] font-bold text-yellow-200">⚡ سؤال البرق (+1)</span>}
          {c.bonusOnCorrect > 0 && !c.lightning && <span className="rounded-full bg-red-500/20 px-4 py-2 text-[26px] font-bold text-red-200">⚔️ +1 مكافأة السرقة</span>}
          {c.secondChance === 'armed' && <span className="rounded-full bg-emerald-400/20 px-4 py-2 text-[26px] font-bold text-emerald-200">🔁 فرصة ثانية مفعلة</span>}
          {c.secondChance === 'used' && !c.result && <span className="rounded-full bg-emerald-400/20 px-4 py-2 text-[26px] font-bold text-emerald-200">🔁 المحاولة الثانية</span>}
        </div>

        {/* نص السؤال */}
        <div className={`flex ${hasMedia ? 'mt-4' : 'mt-8'} flex-1 flex-col justify-center gap-4`}>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`text-center font-extrabold leading-snug text-white ${textSize(c.q.text.length, hasMedia)}`}
            style={{ textShadow: '0 3px 14px rgba(0,0,0,0.6)' }}
          >
            {c.q.text}
          </motion.p>
          {c.q.media && <Media media={c.q.media} timer={c.timer} height={c.q.type === 'mcq' ? 250 : 340} clear={revealed || !!c.result} />}
        </div>

        {/* الخيارات */}
        {c.q.type === 'mcq' ? (
          <div className="mt-4 grid grid-cols-2 gap-5">
            {c.q.options.map((_, i) => (
              <OptionBox key={i} c={c} i={i} revealed={revealed} />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex h-[130px] items-center justify-center">
            {revealed ? (
              <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-[28px] border-4 border-emerald-200 bg-gradient-to-b from-emerald-400 to-emerald-700 px-12 py-5 text-[48px] font-black text-white shadow-[0_0_50px_rgba(52,211,153,0.6)]">
                ✔ {c.q.answer}
              </motion.div>
            ) : (
              <div className="rounded-[28px] border-2 border-dashed border-gold-400/50 px-12 py-5 text-[36px] font-bold text-gold-100/80">🎤 الإجابة شفهيًا</div>
            )}
          </div>
        )}

        {/* ختم النتيجة */}
        <AnimatePresence>
          {c.result && (
            <motion.div
              initial={{ scale: 3, opacity: 0, rotate: -18 }}
              animate={{ scale: 1, opacity: 1, rotate: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14 }}
              className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-[30px] border-[8px] px-14 py-4 font-impact text-[120px] leading-none"
              style={{
                color: c.result === 'correct' ? '#6ee7b7' : '#fca5a5',
                borderColor: c.result === 'correct' ? '#34d399' : '#ef4444',
                background: 'rgba(4,8,23,0.88)',
                boxShadow: `0 0 80px ${c.result === 'correct' ? 'rgba(52,211,153,0.6)' : 'rgba(239,68,68,0.6)'}`,
              }}
            >
              {c.result === 'correct' ? 'صحيح!' : c.timer.expired ? 'انتهى الوقت' : 'خطأ!'}
            </motion.div>
          )}
        </AnimatePresence>
        {!c.result && c.timer.expired && (
          <div
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-red-600/90 px-10 py-2 text-[46px] font-black text-white shadow-[0_0_40px_rgba(239,68,68,0.6)] ${c.q.type === 'mcq' ? 'bottom-[290px]' : 'bottom-[170px]'}`}
            style={{ animation: 'blink-red 0.9s ease-in-out infinite' }}
          >
            ⏰ انتهى الوقت!
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
