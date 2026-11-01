import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Emblem } from '../components/Brand';
import { RulesForm } from '../components/RulesForm';
import { Shell, WizardSteps } from '../components/Shell';
import { Button, Card } from '../components/ui';
import { compressImage, useScreenRole } from '../lib/hooks';
import { EMBLEMS, TEAM_COLORS, TEAM_NAME_IDEAS } from '../lib/meta';
import type { TeamId } from '../lib/types';
import { useDraft } from '../store/draft';
import { useGame } from '../store/game';

function TeamEditor({ team }: { team: TeamId }) {
  const d = useDraft();
  const t = d.teams[team];
  const col = TEAM_COLORS[team];
  const file = useRef<HTMLInputElement>(null);
  const toast = useGame((s) => s.toast);
  return (
    <div className="panel overflow-hidden p-0">
      <div className="flex items-center gap-4 p-4" style={{ background: `linear-gradient(135deg, ${col.main}, ${col.dark})` }}>
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-gold-300 bg-black/20">
          <Emblem value={t.emblem} size={60} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white/80">{col.name}</div>
          <input
            className="mt-1 w-full rounded-xl border border-white/30 bg-black/20 px-3 py-2 font-display text-2xl font-bold text-white outline-none focus:border-gold-300"
            value={t.name}
            maxLength={18}
            onChange={(e) => d.setTeam(team, { name: e.target.value })}
            aria-label={`اسم ${col.name}`}
          />
        </div>
      </div>
      <div className="p-4">
        <div className="mb-2 text-sm font-bold text-slate-300">أسماء مقترحة</div>
        <div className="flex flex-wrap gap-1.5">
          {TEAM_NAME_IDEAS.map((n) => (
            <button key={n} type="button" onClick={() => d.setTeam(team, { name: n })} className="rounded-full border border-white/15 px-3 py-1 text-sm hover:bg-white/10">
              {n}
            </button>
          ))}
        </div>
        <div className="mb-2 mt-4 text-sm font-bold text-slate-300">الشعار</div>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {EMBLEMS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => d.setTeam(team, { emblem: e })}
              className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition ${t.emblem === e ? 'bg-gold-400/30 ring-2 ring-gold-300' : 'bg-white/5 hover:bg-white/10'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => file.current?.click()}>
            🖼️ رفع شعار مخصص
          </Button>
          <input
            className="field w-28 text-center text-xl"
            placeholder="إيموجي"
            maxLength={4}
            onChange={(e) => e.target.value.trim() && d.setTeam(team, { emblem: e.target.value.trim() })}
            aria-label="شعار مكتوب"
          />
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                d.setTeam(team, { emblem: await compressImage(f, 256, 0.9) });
              } catch {
                toast('تعذر قراءة الصورة', 'error');
              }
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function TeamsSetup() {
  useScreenRole('other');
  const navigate = useNavigate();
  const d = useDraft();
  return (
    <Shell title="🛡️ إعداد الفرق والقواعد">
      <WizardSteps current={1} />
      <div className="grid gap-5 md:grid-cols-2">
        <TeamEditor team="red" />
        <TeamEditor team="blue" />
      </div>
      <Card title="قواعد المباراة" icon="📜" className="mt-5">
        <RulesForm rules={d.rules} onChange={d.setRules} />
      </Card>
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <Button variant="dark" onClick={() => navigate('/new')}>
          → السابق
        </Button>
        <Button variant="gold" size="lg" onClick={() => navigate('/new/categories')}>
          التالي: فئات الأسئلة ←
        </Button>
      </div>
    </Shell>
  );
}
