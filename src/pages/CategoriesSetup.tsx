import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Board } from '../components/Board';
import { Shell, WizardSteps } from '../components/Shell';
import { Button, Card } from '../components/ui';
import { ensureBank, getUsage } from '../lib/db';
import { createMatch } from '../lib/engine';
import { openAudienceWindow, useScreenRole } from '../lib/hooks';
import { CATEGORIES, DIFFICULTY_INFO, DIFFICULTY_MODES } from '../lib/meta';
import type { Difficulty, Question } from '../lib/types';
import { useDraft } from '../store/draft';
import { useGame } from '../store/game';

export function CategoriesSetup() {
  useScreenRole('other');
  const navigate = useNavigate();
  const d = useDraft();
  const newMatch = useGame((s) => s.newMatch);
  const toast = useGame((s) => s.toast);
  const [bank, setBank] = useState<Question[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([ensureBank(), getUsage()]).then(([b, u]) => {
      setBank(b);
      setUsage(u);
    });
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, { total: number; fresh: number; by: Record<Difficulty, number> }>();
    for (const c of CATEGORIES) m.set(c.id, { total: 0, fresh: 0, by: { easy: 0, medium: 0, hard: 0 } });
    for (const q of bank) {
      const x = m.get(q.category);
      if (!x) continue;
      x.total++;
      x.by[q.difficulty]++;
      if (!usage[q.id]) x.fresh++;
    }
    return m;
  }, [bank, usage]);

  const preview = useMemo(
    () =>
      createMatch({
        id: 'preview',
        title: d.title,
        now: 0,
        seed: d.seed,
        teams: d.teams,
        rules: d.rules,
        categories: d.categories,
        difficultyMode: d.difficultyMode,
        startingTeam: d.startingTeam,
      }),
    [d.title, d.seed, d.teams, d.rules, d.categories, d.difficultyMode, d.startingTeam],
  );

  const available = d.categories.reduce((sum, c) => sum + (counts.get(c)?.total ?? 0), 0);
  const freshAvail = d.categories.reduce((sum, c) => sum + (counts.get(c)?.fresh ?? 0), 0);
  const needed = d.rules.rounds * 2;

  const toggle = (id: (typeof CATEGORIES)[number]['id']) => {
    const has = d.categories.includes(id);
    if (has && d.categories.length === 1) return toast('يجب اختيار فئة واحدة على الأقل', 'warn');
    d.set({ categories: has ? d.categories.filter((c) => c !== id) : [...d.categories, id] });
  };

  const start = async (mode: 'play' | 'host') => {
    setBusy(true);
    // نفتح النافذة فورًا (قبل أي انتظار) حتى لا يمنعها مانع النوافذ المنبثقة
    if (mode === 'host') openAudienceWindow();
    try {
      await newMatch({
        title: d.title,
        seed: d.seed,
        teams: d.teams,
        rules: d.rules,
        categories: d.categories,
        difficultyMode: d.difficultyMode,
        startingTeam: d.startingTeam,
      });
      d.set({ seed: Math.floor(Math.random() * 4294967296), title: '' });
      navigate(mode === 'host' ? '/host' : '/play');
    } catch (err) {
      console.error(err);
      toast('تعذر إنشاء المباراة', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="🧩 اختيار فئات الأسئلة" wide>
      <WizardSteps current={2} />
      <div className="grid gap-5 xl:grid-cols-[1fr_520px]">
        <div className="flex flex-col gap-5">
          <Card
            title="الفئات"
            icon="📚"
            actions={
              <>
                <Button size="sm" variant="dark" onClick={() => d.set({ categories: CATEGORIES.map((c) => c.id) })}>
                  تحديد الكل
                </Button>
              </>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CATEGORIES.map((c) => {
                const on = d.categories.includes(c.id);
                const n = counts.get(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={`relative rounded-2xl border-2 p-4 text-start transition ${on ? 'bg-white/10' : 'border-white/10 bg-white/[0.03] opacity-60 hover:opacity-90'}`}
                    style={on ? { borderColor: c.color, boxShadow: `0 0 26px -10px ${c.color}` } : undefined}
                  >
                    <span className="absolute end-3 top-3 text-lg">{on ? '✅' : '⬜'}</span>
                    <div className="text-4xl">{c.icon}</div>
                    <div className="mt-1 font-display text-lg font-bold" style={{ color: on ? c.color : undefined }}>
                      {c.name}
                    </div>
                    {n && (
                      <div className="mt-1 text-xs text-slate-300">
                        {n.total} سؤال • {n.fresh} لم تُستخدم
                        <div className="mt-1 flex gap-2">
                          {(['easy', 'medium', 'hard'] as Difficulty[]).map((df) => (
                            <span key={df} style={{ color: DIFFICULTY_INFO[df].color }}>
                              {DIFFICULTY_INFO[df].name} {n.by[df]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="مستوى الصعوبة" icon="📈">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {DIFFICULTY_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => d.set({ difficultyMode: m.id })}
                  className={`rounded-xl border-2 p-3 text-start transition ${d.difficultyMode === m.id ? 'border-gold-300 bg-gold-400/15' : 'border-white/10 bg-white/5 hover:border-gold-400/40'}`}
                >
                  <div className="font-bold text-gold-100">{m.name}</div>
                  <div className="text-xs text-slate-300">{m.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          <div className={`rounded-2xl border p-4 text-sm ${available < needed ? 'border-amber-400/50 bg-amber-500/10 text-amber-100' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'}`}>
            تحتاج المباراة إلى <b>{needed}</b> سؤالًا تقريبًا (بدون الأسئلة البديلة). المتاح في الفئات المختارة: <b>{available}</b> (منها {freshAvail} لم تُستخدم من قبل).
            {available < needed && ' — قد تتكرر بعض الأسئلة. أضف فئات أو أسئلة من المحرر.'}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Card
            title="معاينة اللوحة"
            icon="🗺️"
            actions={
              <Button size="sm" variant="dark" onClick={() => d.set({ seed: Math.floor(Math.random() * 4294967296) })}>
                🔀 إعادة التوزيع
              </Button>
            }
          >
            <Board state={preview} size="compact" />
            <p className="mt-3 text-xs text-slate-400">
              ⭐ {d.rules.goldenCount} مناطق ذهبية موزعة دون تجاور، وأيقونة كل منطقة تحدد فئة سؤالها. {d.rules.crownEnabled ? '👑 التاج في المنتصف.' : ''}
            </p>
          </Card>
          <Card title="جاهز؟" icon="🚀">
            <div className="flex flex-col gap-2">
              <Button variant="gold" size="lg" disabled={busy} onClick={() => void start('host')}>
                🎛️ ابدأ بلوحة المقدم + شاشة الجمهور
              </Button>
              <Button variant="ghost" size="lg" disabled={busy} onClick={() => void start('play')}>
                🎮 ابدأ على شاشة واحدة (شاشة اللعب)
              </Button>
              <p className="text-xs text-slate-400">
                شاشة الجمهور تُفتح في نافذة مستقلة؛ اسحبها إلى الشاشة الثانية أو التقطها في OBS. إذا منع المتصفح النافذة المنبثقة، افتحها من زر «شاشة الجمهور» في لوحة المقدم.
              </p>
              <Button variant="dark" onClick={() => navigate('/new/teams')}>
                → السابق
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
