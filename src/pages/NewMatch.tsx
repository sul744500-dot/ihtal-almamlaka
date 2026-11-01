import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shell, WizardSteps } from '../components/Shell';
import { Button, Card, Segmented } from '../components/ui';
import { DEFAULT_RULES, RULE_PRESETS } from '../lib/rules';
import { useScreenRole } from '../lib/hooks';
import { useDraft } from '../store/draft';
import { useSettings } from '../store/settings';

export function NewMatch() {
  useScreenRole('other');
  const navigate = useNavigate();
  const d = useDraft();
  const defaults = useSettings((s) => s.settings.defaultRules);

  // أول زيارة: نأخذ القواعد الافتراضية من الإعدادات
  useEffect(() => {
    const st = useDraft.getState();
    if (!st.title && st.preset === 'standard' && JSON.stringify(st.rules) === JSON.stringify(DEFAULT_RULES)) {
      st.applyPreset('standard', defaults);
    }
  }, [defaults]);

  return (
    <Shell title="👑 إنشاء مباراة جديدة">
      <WizardSteps current={0} />
      <div className="grid gap-5">
        <Card title="اسم المباراة / الحلقة" icon="🎬">
          <input
            className="field text-lg"
            placeholder="مثال: الحلقة 1 — الصقور ضد الذئاب"
            value={d.title}
            maxLength={60}
            onChange={(e) => d.set({ title: e.target.value })}
            autoFocus
          />
          <p className="mt-2 text-sm text-slate-400">يظهر الاسم في بداية المباراة وفي قائمة المباريات المحفوظة.</p>
        </Card>

        <Card title="نوع المباراة" icon="⏱️">
          <div className="grid gap-3 sm:grid-cols-3">
            {RULE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => d.applyPreset(p.id, defaults)}
                className={`rounded-2xl border-2 p-4 text-start transition ${d.preset === p.id ? 'border-gold-300 bg-gold-400/15 shadow-[0_0_30px_-8px_rgba(246,196,67,0.6)]' : 'border-white/10 bg-white/5 hover:border-gold-400/40'}`}
              >
                <div className="text-3xl">{p.icon}</div>
                <div className="mt-1 font-display text-xl font-bold text-gold-100">{p.name}</div>
                <div className="mt-1 text-sm text-slate-300">{p.desc}</div>
              </button>
            ))}
          </div>
          {d.preset === 'custom' && <p className="mt-3 text-sm text-gold-200">✏️ قواعد مخصصة (عدّلتها في الخطوة التالية)</p>}
          <p className="mt-3 text-sm text-slate-400">
            الحالي: {d.rules.rounds} جولة × فريقين = <b className="text-white">{d.rules.rounds * 2} سؤالًا</b>، و{d.rules.answerSeconds} ثانية لكل إجابة.
          </p>
        </Card>

        <Card title="من يبدأ؟" icon="🎲">
          <Segmented
            value={d.startingTeam}
            onChange={(v) => d.set({ startingTeam: v })}
            options={[
              { id: 'random', label: '🎲 قرعة عشوائية' },
              { id: 'red', label: `🔴 ${d.teams.red.name}` },
              { id: 'blue', label: `🔵 ${d.teams.blue.name}` },
            ]}
          />
          <p className="mt-2 text-sm text-slate-400">الفريقان يحصلان على عدد الأدوار نفسه دائمًا.</p>
        </Card>

        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="dark" onClick={() => d.reset(defaults)}>
            ↺ البدء من جديد
          </Button>
          <Button variant="gold" size="lg" onClick={() => navigate('/new/teams')}>
            التالي: الفرق والقواعد ←
          </Button>
        </div>
      </div>
    </Shell>
  );
}
