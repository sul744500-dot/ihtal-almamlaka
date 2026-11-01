import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Emblem, Logo } from '../components/Brand';
import { Shell } from '../components/Shell';
import { Button, Card, Modal } from '../components/ui';
import { listMatches } from '../lib/db';
import { formatDate, openAudienceWindow, useScreenRole } from '../lib/hooks';
import { TEAM_COLORS } from '../lib/meta';
import { usePwa } from '../lib/pwa';
import type { MatchSummary, TeamId } from '../lib/types';
import { useGame } from '../store/game';

export function HowToPlay() {
  return (
    <div className="space-y-4 leading-relaxed text-slate-200">
      <p>
        يتنافس <b className="text-team-red-light">الفريق الأحمر</b> و<b className="text-team-blue-light">الفريق الأزرق</b> على احتلال <b>25 منطقة</b> من مدن المملكة في لوحة 5×5.
      </p>
      <ul className="list-disc space-y-2 ps-6">
        <li>في كل دور يختار الفريق منطقة: <b>محايدة للاحتلال</b> أو <b>منطقة للخصم للهجوم</b>. الإجابة الصحيحة تمنحه المنطقة.</li>
        <li>كل جولة = دور لكل فريق، فعدد الأسئلة متساوٍ بين الفريقين دائمًا. المؤقت 15 ثانية افتراضيًا.</li>
        <li>المنطقة العادية = نقطة، الذهبية ⭐ = نقطتان وتمنح قدرة خاصة عند احتلالها أول مرة.</li>
        <li>أسئلة الهجوم والمناطق الذهبية أصعب بمستوى. المنطقة المسروقة لا تُسترجع في الدور التالي مباشرة 🔒.</li>
        <li>القدرات: 🛡️ درع يحمي منطقة لجولتين، ⏱️ وقت إضافي، ✂️ حذف إجابتين، 🔁 فرصة ثانية. لكل فريق حد أقصى من القدرات.</li>
        <li>👑 منطقة التاج في المنتصف تُفتح في الجولات الأخيرة وتساوي 3 نقاط.</li>
        <li>🎡 عجلة الحظ تدور للفريق المتأخر كل عدة جولات، و⚡ الأحداث المفاجئة محدودة العدد.</li>
        <li>في <b>الجولة النهائية الحاسمة</b> تسقط كل الدروع وكل سرقة ناجحة تمنح نقطة إضافية.</li>
        <li>الفريق الأعلى نقاطًا يفوز، وعند التعادل جولة فاصلة: أول إجابة صحيحة تحسم.</li>
      </ul>
      <p className="text-sm text-slate-400">كل القواعد قابلة للتعديل عند إنشاء المباراة أو من الإعدادات.</p>
    </div>
  );
}

function MatchCard({ m, onResume, onDelete }: { m: MatchSummary; onResume: () => void; onDelete: () => void }) {
  const finished = m.phase === 'finished';
  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-bold text-gold-100">{m.title}</div>
          <div className="text-xs text-slate-400">{formatDate(m.updatedAt)}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${finished ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
          {finished ? 'انتهت' : m.phase === 'tiebreak' ? 'جولة فاصلة' : `الجولة ${m.round}/${m.rounds}`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        {(['red', 'blue'] as TeamId[]).map((t) => (
          <div key={t} className={`flex min-w-0 items-center gap-2 ${t === 'blue' ? 'flex-row-reverse' : ''}`}>
            <Emblem value={m.teams[t].emblem} size={30} />
            <span className="truncate text-sm font-bold">{m.teams[t].name}</span>
            <span className="font-impact text-2xl" style={{ color: TEAM_COLORS[t].light }}>
              {m.teams[t].score}
            </span>
            {m.winner === t && <span>🏆</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {!finished && (
          <Button size="sm" variant="gold" onClick={onResume}>
            ▶ استكمال
          </Button>
        )}
        <Link to={`/results/${m.id}`} className="btn btn-dark text-sm px-3 py-1.5 rounded-lg">
          📊 النتائج
        </Link>
        <Button size="sm" variant="dark" className="ms-auto text-red-300" onClick={onDelete}>
          🗑 حذف
        </Button>
      </div>
    </div>
  );
}

export function Home() {
  useScreenRole('other');
  const navigate = useNavigate();
  const record = useGame((s) => s.record);
  const activate = useGame((s) => s.activate);
  const remove = useGame((s) => s.remove);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [how, setHow] = useState(false);
  const pwa = usePwa();

  useEffect(() => {
    void listMatches().then(setMatches).catch(() => setMatches([]));
  }, [record?.id]);

  const active = record && record.state.phase !== 'finished' ? record.state : null;

  const resume = async (id: string, to = '/host') => {
    if (await activate(id)) navigate(to);
  };

  return (
    <Shell>
      <section className="relative flex flex-col items-center py-8 text-center sm:py-14">
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <Logo size="xl" tagline />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="gold" size="xl" onClick={() => navigate('/new')}>
            👑 مباراة جديدة
          </Button>
          {active && (
            <Button variant="ghost" size="xl" onClick={() => resume(active.id)}>
              ▶ استكمال «{active.title}»
            </Button>
          )}
        </motion.div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/host" className="btn btn-dark">
            🎛️ لوحة المقدم
          </Link>
          <Link to="/play" className="btn btn-dark">
            🎮 شاشة اللعب
          </Link>
          <Button variant="dark" onClick={() => openAudienceWindow()}>
            📺 فتح شاشة الجمهور
          </Button>
          <Button variant="dark" onClick={() => setHow(true)}>
            📖 كيف تلعب
          </Button>
          {pwa.deferred && !pwa.installed && (
            <Button variant="dark" onClick={() => void pwa.install()}>
              📲 تثبيت التطبيق
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: '📺', title: 'شاشتان متزامنتان', text: 'شاشة جمهور نظيفة للتصوير، ولوحة تحكم سرية للمقدم فيها الإجابات.' },
          { icon: '⚔️', title: 'احتلال وسرقة', text: '25 منطقة، مناطق ذهبية، دروع، منطقة التاج، وجولة نهائية حاسمة.' },
          { icon: '💾', title: 'يحفظ تلقائيًا', text: 'كل حركة تُحفظ في المتصفح، ويمكنك التراجع أو استكمال المباراة لاحقًا.' },
        ].map((f) => (
          <div key={f.title} className="panel p-5">
            <div className="text-3xl">{f.icon}</div>
            <div className="mt-2 font-display text-lg font-bold text-gold-200">{f.title}</div>
            <p className="mt-1 text-sm text-slate-300">{f.text}</p>
          </div>
        ))}
      </section>

      <Card title="المباريات المحفوظة" icon="🗂️" className="mt-6">
        {matches.length ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                m={m}
                onResume={() => void resume(m.id)}
                onDelete={async () => {
                  if (!window.confirm(`حذف المباراة «${m.title}» نهائيًا؟`)) return;
                  await remove(m.id);
                  setMatches(await listMatches());
                }}
              />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-slate-400">لا توجد مباريات محفوظة بعد. ابدأ أول مباراة!</p>
        )}
      </Card>

      <Modal open={how} onClose={() => setHow(false)} title="📖 كيف تلعب «احتلّ المملكة»">
        <HowToPlay />
      </Modal>
    </Shell>
  );
}
