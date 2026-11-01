import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from '../components/Brand';
import { FxDirector, TimerTicker, useSoundOn } from '../components/FxDirector';
import { LogPanel, MiniBoard, TeamsControl, ToolsControl, type PickMode } from '../components/host/Panels';
import { QuestionControl } from '../components/host/QuestionControl';
import { RelayBadge, RemoteConnectModal } from '../components/host/RemoteConnect';
import { SHORTCUTS, useHostActions, useHostHotkeys } from '../components/host/useHostActions';
import { RulesForm } from '../components/RulesForm';
import { Button, Card, Kbd, Modal } from '../components/ui';
import { roundOf, totalTurns } from '../lib/engine';
import { openAudienceWindow, useScreenRole, useWakeLock } from '../lib/hooks';
import { useAudienceCount, useGame } from '../store/game';
import { useSettings } from '../store/settings';

export function NoMatch() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
      <Crown size={110} />
      <h1 className="font-display text-3xl font-bold text-gold-100">لا توجد مباراة نشطة</h1>
      <p className="text-slate-300">أنشئ مباراة جديدة أو استكمل مباراة محفوظة من الصفحة الرئيسية.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/new" className="btn btn-gold">
          👑 مباراة جديدة
        </Link>
        <Link to="/" className="btn btn-ghost">
          🏠 الرئيسية
        </Link>
      </div>
    </div>
  );
}

export function Host() {
  useScreenRole('host');
  useWakeLock();
  const a = useHostActions();
  useHostHotkeys(a);
  const ready = useGame((s) => s.ready);
  const audience = useAudienceCount();
  const sound = useSoundOn();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const [pick, setPick] = useState<PickMode>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const s = a.s;

  useEffect(() => {
    document.title = 'لوحة المقدم — احتلّ المملكة';
  }, []);

  if (!s) return ready ? <NoMatch /> : <div className="flex h-full items-center justify-center text-gold-200">جارٍ التحميل…</div>;

  const turn = Math.min(s.turn, totalTurns(s) - 1);
  return (
    <div className="min-h-full bg-navy-950" style={{ background: 'radial-gradient(ellipse at top, #12245a, #040817 70%)' }}>
      <FxDirector sound={sound} visuals={false} />
      <TimerTicker sound={sound} />
      <header className="sticky top-0 z-40 border-b border-gold-400/15 bg-navy-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2 px-3 py-2">
          <Link to="/" className="flex items-center gap-2" title="الرئيسية">
            <Crown size={30} />
          </Link>
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold text-gold-100">{s.title}</div>
            <div className="text-xs text-slate-400">
              {s.phase === 'finished' ? 'انتهت المباراة' : s.phase === 'tiebreak' ? 'جولة فاصلة' : `الجولة ${roundOf(turn)} من ${s.rules.rounds} • الدور ${turn + 1} من ${totalTurns(s)}`}
            </div>
          </div>
          <span
            className={`ms-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${audience ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}
            title="شاشات الجمهور المفتوحة في هذا المتصفح"
          >
            <span className={`h-2 w-2 rounded-full ${audience ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {audience ? `شاشة الجمهور متصلة${audience > 1 ? ` (${audience})` : ''}` : 'شاشة الجمهور غير متصلة'}
          </span>
          <RelayBadge onClick={() => setRemoteOpen(true)} />
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => openAudienceWindow()}>
              📺 شاشة الجمهور
            </Button>
            <Link to="/play" className="btn btn-dark rounded-lg px-3 py-1.5 text-sm">
              🎮 شاشة اللعب
            </Link>
            <Button size="sm" variant="dark" disabled={!a.canUndo} onClick={a.undo} title="Ctrl+Z">
              ↶ تراجع {a.pastLen ? `(${a.pastLen})` : ''}
            </Button>
            <Button size="sm" variant="dark" onClick={() => setRulesOpen(true)}>
              📜 القواعد
            </Button>
            <Button size="sm" variant="dark" onClick={() => setKeysOpen(true)}>
              ⌨️
            </Button>
            <Button size="sm" variant="dark" onClick={() => updateSettings({ sfx: !settings.sfx })} title="تشغيل/كتم كل الأصوات">
              {settings.sfx ? '🔊' : '🔇'}
            </Button>
            <Link to={`/results/${s.id}`} className="btn btn-dark rounded-lg px-3 py-1.5 text-sm" title="الإحصائيات">
              📊
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1800px] gap-4 p-3 lg:grid-cols-2 xl:grid-cols-[minmax(320px,1fr)_minmax(380px,1.15fr)_minmax(300px,0.85fr)]">
        <div className="flex flex-col gap-4">
          <Card title="اللوحة" icon="🗺️">
            <MiniBoard a={a} pick={pick} setPick={setPick} />
          </Card>
          <Card title="سجل المباراة" icon="📜">
            <LogPanel s={s} />
          </Card>
        </div>
        <div className="order-first flex flex-col gap-4 lg:order-none">
          <Card title={s.phase === 'tiebreak' ? 'الجولة الفاصلة' : s.phase === 'finished' ? 'النتيجة' : 'التحكم بالسؤال'} icon="🎯" className="lg:sticky lg:top-20">
            <QuestionControl a={a} />
          </Card>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:items-start xl:col-span-1 xl:flex">
          <Card title="الفرق والنقاط" icon="🏆">
            <TeamsControl a={a} setPick={setPick} />
          </Card>
          <Card title="أدوات المقدم" icon="🧰">
            <ToolsControl a={a} />
          </Card>
        </div>
      </main>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="📜 قواعد هذه المباراة" width="max-w-4xl">
        <p className="mb-3 text-sm text-slate-400">التعديلات تُطبق فورًا على المباراة الحالية (ويمكن التراجع عنها).</p>
        <RulesForm rules={s.rules} live onChange={(patch) => a.dispatch({ type: 'UPDATE_RULES', rules: patch })} />
      </Modal>
      <RemoteConnectModal open={remoteOpen} onClose={() => setRemoteOpen(false)} />
      <Modal open={keysOpen} onClose={() => setKeysOpen(false)} title="⌨️ اختصارات لوحة المفاتيح" width="max-w-md">
        <ul className="space-y-2">
          {SHORTCUTS.map(([k, d]) => (
            <li key={k} className="flex items-center justify-between gap-3">
              <span>{d}</span>
              <Kbd>{k}</Kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-400">تعمل الاختصارات مع لوحة المفاتيح العربية أيضًا. يمكن إيقافها من الإعدادات.</p>
      </Modal>
    </div>
  );
}
