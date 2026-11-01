import { useState } from 'react';
import { Link } from 'react-router-dom';
import { hasTargets, roundOf, targetInfo } from '../../lib/engine';
import { CATEGORY_MAP, DIFFICULTY_INFO, TEAM_COLORS } from '../../lib/meta';
import { cellValue, computeScores } from '../../lib/scoring';
import { other, type TeamId } from '../../lib/types';
import { useSettings } from '../../store/settings';
import { Emblem } from '../Brand';
import { Media } from '../Media';
import { TimerBar } from '../TimerRing';
import { Badge, Button, Kbd } from '../ui';
import { LETTERS } from '../stage/StageQuestion';
import type { HostActions } from './useHostActions';

function TeamTag({ name, emblem, team }: { name: string; emblem: string; team: TeamId }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-white" style={{ background: `linear-gradient(90deg, ${TEAM_COLORS[team].main}, ${TEAM_COLORS[team].dark})` }}>
      <Emblem value={emblem} size={22} /> {name}
    </span>
  );
}

/** لوحة التحكم بالسؤال الحالي حسب مرحلة اللعب */
export function QuestionControl({ a, answerHidden }: { a: HostActions; answerHidden?: boolean }) {
  const hideSetting = useSettings((st) => st.settings.hideAnswerOnHost);
  const [peek, setPeek] = useState(false);
  const s = a.s;
  if (!s) return null;
  const c = s.current;
  const hide = (answerHidden ?? hideSetting) && !peek;

  // ───── اختيار المنطقة ─────
  if (s.phase === 'select') {
    const cell = s.selectedCell !== null ? s.cells[s.selectedCell] : null;
    const info = cell ? targetInfo(s, cell.id) : null;
    const t = s.teams[s.activeTeam];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg text-slate-300">الدور الآن:</span>
          <TeamTag name={t.name} emblem={t.emblem} team={s.activeTeam} />
          <span className="text-sm text-slate-400">الجولة {roundOf(s.turn)} من {s.rules.rounds}</span>
        </div>
        {cell && info ? (
          <div className="rounded-2xl border border-gold-400/30 bg-navy-950/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-2xl font-bold text-white">{cell.name}</span>
              {cell.category && <Badge color={CATEGORY_MAP[cell.category].color}>{CATEGORY_MAP[cell.category].icon} {CATEGORY_MAP[cell.category].name}</Badge>}
              {cell.kind === 'golden' && <Badge>⭐ ذهبية</Badge>}
              {cell.kind === 'crown' && <Badge>👑 التاج</Badge>}
              <Badge color="#e2e8f0">{cellValue(cell, s.rules)} نقطة</Badge>
              {info.mode === 'attack' ? <Badge color="#f87171">⚔️ هجوم على {s.teams[other(s.activeTeam)].name}</Badge> : <Badge color="#6ee7b7">🏴 احتلال</Badge>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="gold" size="lg" onClick={a.draw} className="flex-1">
                🎬 اعرض السؤال <Kbd>Enter</Kbd>
              </Button>
              <Button variant="dark" onClick={() => a.select(null)}>
                إلغاء التحديد
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gold-400/30 p-6 text-center text-lg text-slate-300">
            {hasTargets(s) ? '👈 اختر منطقة من اللوحة (احتلال منطقة محايدة أو هجوم على منطقة الخصم)' : '⚠️ لا توجد مناطق متاحة لهذا الفريق — تخطَّ الدور'}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="dark" size="sm" onClick={a.next}>
            ⏭ تخطي الدور
          </Button>
          <Button variant="dark" size="sm" onClick={() => a.dispatch({ type: 'SET_ACTIVE_TEAM', team: other(s.activeTeam) })}>
            🔄 الدور لـ{s.teams[other(s.activeTeam)].name}
          </Button>
        </div>
      </div>
    );
  }

  // ───── انتهت المباراة ─────
  if (s.phase === 'finished') {
    const sc = computeScores(s);
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="text-5xl">🏆</div>
        <div className="font-display text-3xl font-bold text-gold-200">
          {s.winner === 'draw' ? 'تعادل!' : `فاز ${s.teams[s.winner as TeamId].name}`}
        </div>
        <div className="font-impact text-4xl">
          <span className="text-team-red-light">{sc.red.total}</span> <span className="text-gold-300">-</span> <span className="text-team-blue-light">{sc.blue.total}</span>
        </div>
        <div className="text-sm text-slate-400">ماذا يعرض للجمهور؟</div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant={s.audienceView === 'board' ? 'gold' : 'dark'} onClick={() => a.dispatch({ type: 'SET_VIEW', view: 'board' })}>
            🎉 احتفال الفائز
          </Button>
          <Button variant={s.audienceView === 'final' ? 'gold' : 'dark'} onClick={() => a.dispatch({ type: 'SET_VIEW', view: 'final' })}>
            🗺️ اللوحة النهائية
          </Button>
          <Button variant={s.audienceView === 'stats' ? 'gold' : 'dark'} onClick={() => a.dispatch({ type: 'SET_VIEW', view: 'stats' })}>
            📊 الإحصائيات
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to={`/results/${s.id}`} className="btn btn-ghost">
            صفحة النتائج والإحصائيات
          </Link>
          <Link to="/new" className="btn btn-ghost">
            مباراة جديدة
          </Link>
        </div>
      </div>
    );
  }

  // ───── الجولة الفاصلة بدون سؤال ─────
  if (s.phase === 'tiebreak' && !c) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="text-5xl">⚖️</div>
        <div className="font-display text-2xl font-bold text-gold-200">تعادل! جولة فاصلة</div>
        <p className="text-slate-300">يُعرض سؤال على الفريقين، وأول فريق يجيب صحيحًا يفوز بنقطة الحسم.</p>
        <Button variant="gold" size="lg" onClick={a.draw}>
          🎬 اعرض السؤال الفاصل <Kbd>Enter</Kbd>
        </Button>
        <Button variant="dark" size="sm" onClick={() => a.dispatch({ type: 'FINISH', draw: true })}>
          إنهاء المباراة بالتعادل
        </Button>
      </div>
    );
  }

  if (!c) return null;

  // ───── سؤال جارٍ / نتيجة ─────
  const cat = CATEGORY_MAP[c.q.category];
  const diff = DIFFICULTY_INFO[c.difficulty];
  const cell = c.cellId !== null ? s.cells[c.cellId] : null;
  const isResult = s.phase === 'result';
  const tiebreak = c.mode === 'tiebreak';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={cat.color}>
          {cat.icon} {cat.name}
        </Badge>
        <Badge color={diff.color}>{diff.name}</Badge>
        {cell && (
          <Badge color={c.mode === 'attack' ? '#f87171' : '#e2e8f0'}>
            {c.mode === 'attack' ? '⚔️ هجوم' : '🏴'} {cell.name}
          </Badge>
        )}
        {tiebreak && <Badge>⚖️ سؤال فاصل</Badge>}
        {c.lightning && <Badge color="#fde047">⚡ البرق</Badge>}
        {c.rebound && <Badge color="#93c5fd">↩️ فرصة الرد</Badge>}
        {c.secondChance === 'armed' && <Badge color="#6ee7b7">🔁 فرصة ثانية</Badge>}
        {c.answering && <TeamTag name={s.teams[c.answering].name} emblem={s.teams[c.answering].emblem} team={c.answering} />}
      </div>

      <p className="text-xl font-bold leading-relaxed text-white sm:text-2xl">{c.q.text}</p>
      {c.q.media && (
        <div className="rounded-xl bg-navy-950/50 p-2">
          <Media media={c.q.media} height={130} clear />
        </div>
      )}

      {/* الإجابة السرية */}
      <button
        type="button"
        onPointerDown={() => setPeek(true)}
        onPointerUp={() => setPeek(false)}
        onPointerLeave={() => setPeek(false)}
        className="relative overflow-hidden rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-start"
      >
        <span className="text-xs font-bold text-emerald-300">🔒 الإجابة الصحيحة (لك فقط)</span>
        <span className={`block text-xl font-extrabold text-emerald-100 transition ${hide ? 'select-none blur-md' : ''}`}>{c.q.answer}</span>
        {c.q.note && <span className={`mt-1 block text-sm text-emerald-200/70 ${hide ? 'blur-md' : ''}`}>💡 {c.q.note}</span>}
        {hide && <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-emerald-200">اضغط مطولًا للإظهار</span>}
      </button>

      {/* الخيارات */}
      {c.q.type === 'mcq' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {c.q.options.map((o, i) => {
            const hidden = c.hiddenOptions.includes(i);
            const wrong = c.wrongPicks.includes(i);
            const correct = i === c.q.correct;
            const picked = c.picked === i;
            return (
              <button
                key={i}
                type="button"
                disabled={isResult || hidden || wrong}
                onClick={() => a.pick(i)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start font-bold transition ${
                  picked ? 'border-amber-300 bg-amber-500/25 text-amber-100' : wrong ? 'border-red-400/50 bg-red-500/15 text-red-200 line-through' : hidden ? 'border-white/10 text-slate-500 line-through' : 'border-white/15 bg-white/5 hover:bg-white/10'
                } ${!hide && correct ? 'ring-2 ring-emerald-400/70' : ''}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-950 text-gold-300">{LETTERS[i]}</span>
                <span className="flex-1">{o}</span>
                {!hide && correct && <span className="text-emerald-300">✔</span>}
                {picked && <span>🔒</span>}
                <Kbd>{i + 1}</Kbd>
              </button>
            );
          })}
        </div>
      )}

      {/* المؤقت */}
      {!isResult && (
        <div className="rounded-xl bg-navy-950/50 p-3">
          <TimerBar timer={c.timer} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant={a.running ? 'dark' : 'gold'} size="sm" onClick={a.toggleTimer}>
              {a.running ? '⏸ إيقاف' : '▶ تشغيل'} <Kbd>Space</Kbd>
            </Button>
            <Button variant="dark" size="sm" onClick={a.resetTimer}>
              ↺ إعادة
            </Button>
            <Button variant="dark" size="sm" onClick={() => a.addTime(5)}>
              +5 ث <Kbd>T</Kbd>
            </Button>
            <Button variant="dark" size="sm" onClick={() => a.addTime(-5)}>
              −5 ث
            </Button>
          </div>
        </div>
      )}

      {/* الحكم */}
      {!isResult && !tiebreak && (
        <div className="flex flex-col gap-2">
          {c.q.type === 'mcq' && c.picked !== null && (
            <Button variant="gold" size="lg" onClick={a.confirmPick}>
              ✅ تأكيد خيار «{LETTERS[c.picked]}» <Kbd>Enter</Kbd>
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="green" size="lg" onClick={() => a.judge(true)}>
              ✔ صحيح <Kbd>C</Kbd>
            </Button>
            <Button variant="danger" size="lg" onClick={() => a.judge(false)}>
              ✖ خطأ <Kbd>X</Kbd>
            </Button>
          </div>
        </div>
      )}

      {!isResult && tiebreak && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(['red', 'blue'] as TeamId[]).map((t) => (
            <Button key={t} variant={t} size="lg" onClick={() => a.dispatch({ type: 'TIEBREAK_RESULT', winner: t })}>
              ✔ {s.teams[t].name} أجاب أولًا
            </Button>
          ))}
          <Button variant="dark" className="sm:col-span-2" onClick={() => a.dispatch({ type: 'TIEBREAK_RESULT', winner: null })}>
            لا أحد — سؤال فاصل جديد
          </Button>
        </div>
      )}

      {isResult && (
        <div className={`rounded-2xl border p-4 text-center ${c.result === 'correct' ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-red-400/50 bg-red-500/10'}`}>
          <div className="font-display text-2xl font-bold">
            {c.result === 'correct' ? `✅ إجابة صحيحة — ${c.resultTeam ? s.teams[c.resultTeam].name : ''}` : c.timer.expired ? '⏰ انتهى الوقت' : '❌ إجابة خاطئة'}
          </div>
          {c.result === 'correct' && cell && <div className="mt-1 text-slate-300">احتلّ «{cell.name}»</div>}
          <Button variant="gold" size="xl" className="mt-4 w-full" onClick={a.next}>
            ⏭ الدور التالي <Kbd>Enter</Kbd>
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant={c.revealed ? 'ghost' : 'dark'} size="sm" onClick={() => a.reveal()}>
          {c.revealed ? '🙈 إخفاء الإجابة عن الجمهور' : '👁 كشف الإجابة للجمهور'} <Kbd>R</Kbd>
        </Button>
        {!isResult && (
          <>
            <Button variant="dark" size="sm" onClick={a.replace}>
              🔄 سؤال آخر
            </Button>
            {!tiebreak && (
              <Button variant="dark" size="sm" onClick={a.cancel}>
                ✖ إلغاء السؤال
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
