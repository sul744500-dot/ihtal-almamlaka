import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSoundOn } from '../components/FxDirector';
import { MiniBoard, TeamsControl, ToolsControl, type PickMode } from '../components/host/Panels';
import { QuestionControl } from '../components/host/QuestionControl';
import { useHostActions, useHostHotkeys, type HostActions } from '../components/host/useHostActions';
import { Stage } from '../components/Stage';
import { AudienceStage } from '../components/stage/AudienceStage';
import { LETTERS } from '../components/stage/StageQuestion';
import { TimerBar } from '../components/TimerRing';
import { Button, Card, Kbd } from '../components/ui';
import { useFullscreen, useScreenRole, useWakeLock } from '../lib/hooks';
import { TEAM_COLORS } from '../lib/meta';
import type { TeamId } from '../lib/types';
import { useGame } from '../store/game';
import { NoMatch } from './Host';

function PlayDock({ a, openPanel }: { a: HostActions; openPanel: () => void }) {
  const [peek, setPeek] = useState(false);
  const s = a.s!;
  const c = s.current;
  const team = c?.answering ?? (s.phase === 'tiebreak' || s.phase === 'finished' ? null : s.activeTeam);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-gold-400/25 bg-navy-950/95 px-3 py-2">
      {team ? (
        <span className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: TEAM_COLORS[team].dark }}>
          {s.teams[team].emblem} {s.teams[team].name}
        </span>
      ) : (
        <span className="rounded-full bg-gold-400/15 px-3 py-1 text-sm font-bold text-gold-200">{s.phase === 'finished' ? '🏁 انتهت' : '⚖️ فاصلة'}</span>
      )}

      {s.phase === 'select' && (
        <>
          <span className="text-sm text-slate-300">{s.selectedCell !== null ? `المنطقة: ${s.cells[s.selectedCell].name}` : 'اضغط على منطقة في اللوحة'}</span>
          <Button variant="gold" disabled={s.selectedCell === null} onClick={a.draw}>
            🎬 اعرض السؤال <Kbd>Enter</Kbd>
          </Button>
          <Button variant="dark" size="sm" onClick={a.next}>
            ⏭ تخطي
          </Button>
        </>
      )}

      {c && !c.result && (
        <>
          <div className="w-44">
            <TimerBar timer={c.timer} />
          </div>
          <Button variant={a.running ? 'dark' : 'gold'} size="sm" onClick={a.toggleTimer}>
            {a.running ? '⏸' : '▶'} <Kbd>Space</Kbd>
          </Button>
          <Button variant="dark" size="sm" onClick={() => a.addTime(5)}>
            +5
          </Button>
          {c.q.type === 'mcq' &&
            c.q.options.map((_, i) => (
              <Button
                key={i}
                size="sm"
                variant={c.picked === i ? 'gold' : 'dark'}
                disabled={c.hiddenOptions.includes(i) || c.wrongPicks.includes(i)}
                onClick={() => a.pick(i)}
                title="تحديد خيار الفريق على الشاشة"
              >
                {LETTERS[i]}
              </Button>
            ))}
          {c.mode !== 'tiebreak' ? (
            <>
              {c.picked !== null && (
                <Button variant="gold" size="sm" onClick={a.confirmPick}>
                  تأكيد <Kbd>Enter</Kbd>
                </Button>
              )}
              <Button variant="green" onClick={() => a.judge(true)}>
                ✔ صحيح
              </Button>
              <Button variant="danger" onClick={() => a.judge(false)}>
                ✖ خطأ
              </Button>
            </>
          ) : (
            (['red', 'blue'] as TeamId[]).map((t) => (
              <Button key={t} variant={t} size="sm" onClick={() => a.dispatch({ type: 'TIEBREAK_RESULT', winner: t })}>
                ✔ {s.teams[t].name}
              </Button>
            ))
          )}
          <button
            type="button"
            onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)}
            onPointerLeave={() => setPeek(false)}
            className="btn btn-dark rounded-lg px-3 py-1.5 text-sm"
          >
            {peek ? `🔓 ${c.q.answer}` : '🔒 اضغط مطولًا للإجابة'}
          </button>
        </>
      )}

      {s.phase === 'result' && (
        <>
          <span className={`text-sm font-bold ${c?.result === 'correct' ? 'text-emerald-300' : 'text-red-300'}`}>{c?.result === 'correct' ? '✅ صحيح' : '❌ خطأ'}</span>
          <Button variant="gold" onClick={a.next}>
            ⏭ الدور التالي <Kbd>Enter</Kbd>
          </Button>
        </>
      )}

      {s.phase === 'tiebreak' && !c && (
        <Button variant="gold" onClick={a.draw}>
          ⚖️ اعرض السؤال الفاصل
        </Button>
      )}

      {s.phase === 'finished' && (
        <>
          <Button size="sm" variant={s.audienceView === 'board' ? 'gold' : 'dark'} onClick={() => a.dispatch({ type: 'SET_VIEW', view: 'board' })}>
            🎉 الاحتفال
          </Button>
          <Button size="sm" variant={s.audienceView === 'final' ? 'gold' : 'dark'} onClick={() => a.dispatch({ type: 'SET_VIEW', view: 'final' })}>
            🗺️ اللوحة
          </Button>
          <Button size="sm" variant={s.audienceView === 'stats' ? 'gold' : 'dark'} onClick={() => a.dispatch({ type: 'SET_VIEW', view: 'stats' })}>
            📊 الإحصائيات
          </Button>
        </>
      )}

      {c && (
        <Button size="sm" variant="dark" onClick={() => a.reveal()}>
          {c.revealed ? '🙈' : '👁'} <Kbd>R</Kbd>
        </Button>
      )}
      <div className="ms-auto flex items-center gap-1.5">
        <Button size="sm" variant="dark" disabled={!a.canUndo} onClick={a.undo}>
          ↶ تراجع
        </Button>
        <Button size="sm" variant="ghost" onClick={openPanel}>
          🎛️ التحكم الكامل
        </Button>
      </div>
    </div>
  );
}

export function Play() {
  useScreenRole('play');
  useWakeLock();
  const a = useHostActions();
  useHostHotkeys(a);
  const ready = useGame((s) => s.ready);
  const sound = useSoundOn();
  const [, toggleFs] = useFullscreen();
  const [dock, setDock] = useState(true);
  const [panel, setPanel] = useState(false);
  const [pick, setPick] = useState<PickMode>(null);

  useEffect(() => {
    document.title = 'شاشة اللعب — احتلّ المملكة';
  }, []);

  if (!a.s) return ready ? <NoMatch /> : <div className="flex h-full items-center justify-center text-gold-200">جارٍ التحميل…</div>;
  const s = a.s;

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="group relative min-h-0 flex-1">
        <Stage>
          <AudienceStage sound={sound} onCellClick={(id) => a.select(s.selectedCell === id ? null : id)} />
        </Stage>
        <div className="absolute start-2 top-2 z-50 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
          <Link to="/" className="btn btn-dark rounded-lg px-2.5 py-1 text-sm">
            🏠
          </Link>
          <Button size="sm" variant="dark" onClick={toggleFs}>
            ⛶ ملء الشاشة
          </Button>
          <Button size="sm" variant="dark" onClick={() => setDock((d) => !d)}>
            {dock ? '⬇ إخفاء التحكم' : '⬆ إظهار التحكم'}
          </Button>
          <Link to="/host" className="btn btn-dark rounded-lg px-2.5 py-1 text-sm">
            🎛️ لوحة المقدم
          </Link>
        </div>
      </div>
      {dock && <PlayDock a={a} openPanel={() => setPanel(true)} />}

      <AnimatePresence>
        {panel && (
          <motion.div className="fixed inset-0 z-[90] flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex-1 bg-black/50" onClick={() => setPanel(false)} />
            <motion.aside
              className="h-full w-[min(560px,100vw)] overflow-y-auto border-s border-gold-400/25 bg-navy-900 p-3"
              initial={{ x: -560 }}
              animate={{ x: 0 }}
              exit={{ x: -560 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-xl font-bold text-gold-200">🎛️ التحكم الكامل</span>
                <Button size="sm" variant="dark" onClick={() => setPanel(false)}>
                  ✕ إغلاق
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <Card title="السؤال" icon="🎯">
                  <QuestionControl a={a} answerHidden />
                </Card>
                <Card title="اللوحة" icon="🗺️">
                  <MiniBoard a={a} pick={pick} setPick={setPick} />
                </Card>
                <Card title="الفرق" icon="🏆">
                  <TeamsControl a={a} setPick={setPick} />
                </Card>
                <Card title="الأدوات" icon="🧰">
                  <ToolsControl a={a} />
                </Card>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
