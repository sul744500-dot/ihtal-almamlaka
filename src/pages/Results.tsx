import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Board } from '../components/Board';
import { Crown, Emblem } from '../components/Brand';
import { LogPanel } from '../components/host/Panels';
import { ScoreChart } from '../components/ScoreChart';
import { Shell } from '../components/Shell';
import { Button, Card } from '../components/ui';
import { loadMatch } from '../lib/db';
import { downloadJson, formatDate, useScreenRole } from '../lib/hooks';
import { ALL_CATEGORY_IDS, CATEGORY_MAP, TEAM_COLORS } from '../lib/meta';
import { computeStats, fmtSec } from '../lib/stats';
import type { GameState, TeamId } from '../lib/types';
import { useGame } from '../store/game';

function Row({ label, red, blue, better = 'high' }: { label: string; red: number | string; blue: number | string; better?: 'high' | 'low' | 'none' }) {
  const rn = typeof red === 'number' ? red : parseFloat(String(red));
  const bn = typeof blue === 'number' ? blue : parseFloat(String(blue));
  const win = better === 'none' || Number.isNaN(rn) || Number.isNaN(bn) || rn === bn ? null : (better === 'high' ? rn > bn : rn < bn) ? 'red' : 'blue';
  return (
    <tr className="border-b border-white/10">
      <td className={`py-2 text-center font-impact text-2xl ${win === 'red' ? 'text-team-red-light' : 'text-slate-200'}`}>{red}</td>
      <td className="py-2 text-center font-bold text-gold-100">{label}</td>
      <td className={`py-2 text-center font-impact text-2xl ${win === 'blue' ? 'text-team-blue-light' : 'text-slate-200'}`}>{blue}</td>
    </tr>
  );
}

export function Results() {
  useScreenRole('other');
  const { id } = useParams();
  const live = useGame((s) => s.record?.state);
  const ready = useGame((s) => s.ready);
  const [loaded, setLoaded] = useState<GameState | null>(null);
  const [missing, setMissing] = useState(false);

  const targetId = id ?? live?.id;
  useEffect(() => {
    if (!targetId) {
      if (ready) setMissing(true);
      return;
    }
    if (live && live.id === targetId) return;
    void loadMatch(targetId).then((m) => (m ? setLoaded(m.state) : setMissing(true)));
  }, [targetId, live, ready]);

  const s = live && live.id === targetId ? live : loaded;
  const st = useMemo(() => (s ? computeStats(s) : null), [s]);

  if (!s || !st) {
    return (
      <Shell title="📊 النتائج والإحصائيات">
        <div className="py-16 text-center text-slate-300">{missing ? 'لم يتم العثور على المباراة.' : 'جارٍ التحميل…'}</div>
      </Shell>
    );
  }

  const r = st.teams.red;
  const b = st.teams.blue;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const finished = s.phase === 'finished';
  const winner = finished && s.winner && s.winner !== 'draw' ? (s.winner as TeamId) : null;

  return (
    <Shell
      title="📊 النتائج والإحصائيات"
      wide
      actions={
        <>
          {!finished && (
            <Link to="/host" className="btn btn-gold">
              ▶ العودة للمباراة
            </Link>
          )}
          <Button variant="dark" onClick={() => downloadJson(`ihtal-match-${s.id}.json`, { app: 'ihtal-almamlaka', matches: [{ state: s }], questions: [], usage: {}, version: 1, exportedAt: Date.now() })}>
            💾 تصدير المباراة
          </Button>
          <Button variant="dark" onClick={() => window.print()}>
            🖨️ طباعة
          </Button>
        </>
      }
    >
      <section className="panel relative overflow-hidden p-6 text-center">
        <div className="absolute inset-0 opacity-40" style={{ background: winner ? `radial-gradient(circle at 50% 0%, ${TEAM_COLORS[winner].main}, transparent 70%)` : undefined }} />
        <div className="relative">
          <Crown size={70} className="mx-auto" />
          <h2 className="mt-2 font-display text-2xl font-bold text-gold-100">{s.title}</h2>
          <div className="text-sm text-slate-400">{formatDate(s.createdAt)}</div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
            {(['red', 'blue'] as TeamId[]).map((t, i) => (
              <div key={t} className="flex items-center gap-3" style={{ order: i * 2 }}>
                <Emblem value={s.teams[t].emblem} size={56} />
                <div>
                  <div className="font-display text-xl font-bold" style={{ color: TEAM_COLORS[t].light }}>
                    {s.teams[t].name} {winner === t && '🏆'}
                  </div>
                  <div className="font-impact text-5xl">{st.teams[t].score}</div>
                </div>
              </div>
            ))}
            <span className="order-1 font-impact text-4xl text-gold-300">-</span>
          </div>
          <div className="mt-3 font-display text-lg font-bold text-gold-200">
            {finished ? (winner ? `${s.teams[winner].name} يحتلّ المملكة!` : 'تعادل!') : 'المباراة ما زالت جارية'}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="مقارنة الفريقين" icon="⚔️">
          <table className="w-full">
            <thead>
              <tr className="text-sm text-slate-400">
                <th className="pb-2" style={{ color: TEAM_COLORS.red.light }}>
                  {s.teams.red.name}
                </th>
                <th className="pb-2" />
                <th className="pb-2" style={{ color: TEAM_COLORS.blue.light }}>
                  {s.teams.blue.name}
                </th>
              </tr>
            </thead>
            <tbody>
              <Row label="النقاط" red={r.score} blue={b.score} />
              <Row label="المناطق المملوكة" red={r.cells} blue={b.cells} />
              <Row label="الإجابات الصحيحة" red={r.correct} blue={b.correct} />
              <Row label="الإجابات الخاطئة" red={r.wrong} blue={b.wrong} better="low" />
              <Row label="انتهاء الوقت" red={r.timeouts} blue={b.timeouts} better="low" />
              <Row label="دقة الإجابة" red={pct(r.accuracy)} blue={pct(b.accuracy)} />
              <Row label="عمليات الاحتلال" red={r.captures} blue={b.captures} />
              <Row label="سرقات ناجحة" red={r.steals} blue={b.steals} />
              <Row label="هجمات (محاولات)" red={r.attacks} blue={b.attacks} better="none" />
              <Row label="مناطق خسرها بالسرقة" red={r.lostToSteals} blue={b.lostToSteals} better="low" />
              <Row label="مناطق ذهبية" red={r.golden} blue={b.golden} />
              <Row label="القدرات المستخدمة" red={r.abilitiesUsed} blue={b.abilitiesUsed} better="none" />
              <Row label="النقاط الإضافية" red={r.bonus} blue={b.bonus} />
              <Row label="متوسط زمن الإجابة الصحيحة" red={fmtSec(r.avgMs)} blue={fmtSec(b.avgMs)} better="low" />
              <Row label="أسرع إجابة" red={fmtSec(r.fastestMs)} blue={fmtSec(b.fastestMs)} better="low" />
              <Row label="أطول سلسلة صحيحة" red={r.longestStreak} blue={b.longestStreak} />
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="تطور النتيجة" icon="📈">
            <ScoreChart s={s} timeline={st.timeline} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-white/5 p-2">
                <div className="text-slate-400">الأسئلة</div>
                <div className="font-impact text-2xl">{st.questions}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <div className="text-slate-400">تبدّل الصدارة</div>
                <div className="font-impact text-2xl">{st.leadChanges}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <div className="text-slate-400">أكبر تقدم</div>
                <div className="font-impact text-2xl" style={{ color: st.biggestLead ? TEAM_COLORS[st.biggestLead.team].light : undefined }}>
                  {st.biggestLead ? st.biggestLead.value : 0}
                </div>
              </div>
            </div>
          </Card>
          <Card title="اللوحة النهائية" icon="🗺️">
            <Board state={s} size="compact" />
          </Card>
        </div>
      </div>

      <Card title="الأداء حسب الفئة" icon="📚" className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ALL_CATEGORY_IDS.filter((c) => r.byCategory[c].total + b.byCategory[c].total > 0).map((c) => (
            <div key={c} className="rounded-xl bg-white/5 p-3">
              <div className="font-bold" style={{ color: CATEGORY_MAP[c].color }}>
                {CATEGORY_MAP[c].icon} {CATEGORY_MAP[c].name}
              </div>
              {(['red', 'blue'] as TeamId[]).map((t) => {
                const v = st.teams[t].byCategory[c];
                return (
                  <div key={t} className="mt-2">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>{s.teams[t].name}</span>
                      <span>
                        {v.correct}/{v.total}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${v.total ? (v.correct / v.total) * 100 : 0}%`, background: TEAM_COLORS[t].main }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <Card title="سجل المباراة الكامل" icon="📜" className="mt-5">
        <LogPanel s={s} limit={1000} />
      </Card>
    </Shell>
  );
}
