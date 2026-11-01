import { useEffect, useMemo, useRef, useState } from 'react';
import { Media } from '../components/Media';
import { Shell } from '../components/Shell';
import { Badge, Button, Card, Modal, Segmented, Toggle } from '../components/ui';
import { csvToRawQuestions, CSV_HEADER } from '../lib/csv';
import * as DB from '../lib/db';
import { FLAGS } from '../lib/flags';
import { compressImage, downloadJson, readFileAsText, useScreenRole } from '../lib/hooks';
import { CATEGORIES, CATEGORY_MAP, DIFFICULTY_INFO } from '../lib/meta';
import { uid } from '../lib/rng';
import { coerceQuestion, findDuplicates, normalizeArabic, questionKey, validateQuestion } from '../lib/questions/validate';
import { getBus } from '../lib/sync';
import type { CategoryId, Difficulty, Question, QuestionMedia } from '../lib/types';
import { useGame } from '../store/game';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

function emptyQuestion(): Question {
  return { id: '', category: 'general', difficulty: 'medium', type: 'mcq', text: '', options: ['', '', '', ''], correct: 0, answer: '', custom: true };
}

function QuestionForm({ initial, onSave, onCancel }: { initial: Question; onSave: (q: Question) => void; onCancel: () => void }) {
  const [q, setQ] = useState<Question>(() => ({ ...initial, options: initial.type === 'mcq' ? [...initial.options] : ['', '', '', ''] }));
  const [errors, setErrors] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const toast = useGame((s) => s.toast);
  const mediaKind = q.media?.kind ?? 'none';

  const setOption = (i: number, v: string) => setQ((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? v : o)) }));
  const setMedia = (m: QuestionMedia | undefined) => setQ((x) => ({ ...x, media: m }));

  const submit = () => {
    const out: Question = {
      ...q,
      id: q.id || uid('custom-'),
      text: q.text.trim(),
      options: q.type === 'mcq' ? q.options.map((o) => o.trim()) : [],
      correct: q.type === 'mcq' ? q.correct : -1,
      answer: q.type === 'mcq' ? (q.options[q.correct] ?? '').trim() : q.answer.trim(),
      note: q.note?.trim() || undefined,
      updatedAt: Date.now(),
    };
    const errs = validateQuestion(out);
    setErrors(errs);
    if (!errs.length) onSave(out);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          الفئة
          <select className="field" value={q.category} onChange={(e) => setQ({ ...q, category: e.target.value as CategoryId })}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-sm font-bold">
          الصعوبة
          <Segmented
            value={q.difficulty}
            onChange={(v) => setQ({ ...q, difficulty: v })}
            options={(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => ({ id: d, label: DIFFICULTY_INFO[d].name }))}
          />
        </div>
        <div className="flex flex-col gap-1 text-sm font-bold">
          النوع
          <Segmented
            value={q.type}
            onChange={(v) => setQ({ ...q, type: v })}
            options={[
              { id: 'mcq', label: 'اختيارات' },
              { id: 'open', label: 'مفتوح' },
            ]}
          />
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold">
        نص السؤال
        <textarea className="field min-h-[80px] text-base font-normal" value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} maxLength={240} placeholder="اكتب السؤال هنا…" />
      </label>

      {q.type === 'mcq' ? (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold">الخيارات (حدد الصحيح)</div>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQ({ ...q, correct: i })}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-bold ${q.correct === i ? 'border-emerald-300 bg-emerald-500 text-white' : 'border-white/20 text-slate-300'}`}
                title="الإجابة الصحيحة"
              >
                {q.correct === i ? '✔' : LETTERS[i]}
              </button>
              <input className="field" value={o} onChange={(e) => setOption(i, e.target.value)} maxLength={60} placeholder={`الخيار ${LETTERS[i]}`} />
              {q.options.length > 2 && (
                <Button
                  size="sm"
                  variant="dark"
                  onClick={() => setQ((x) => ({ ...x, options: x.options.filter((_, j) => j !== i), correct: x.correct === i ? 0 : x.correct > i ? x.correct - 1 : x.correct }))}
                >
                  ✕
                </Button>
              )}
            </div>
          ))}
          {q.options.length < 6 && (
            <Button size="sm" variant="dark" className="self-start" onClick={() => setQ((x) => ({ ...x, options: [...x.options, ''] }))}>
              + خيار
            </Button>
          )}
          <Toggle
            label="الحفاظ على ترتيب الخيارات"
            desc="افتراضيًا تُخلط الخيارات عند العرض حتى لا يُعرف موقع الإجابة"
            checked={!!q.keepOrder}
            onChange={(v) => setQ((x) => ({ ...x, keepOrder: v || undefined }))}
          />
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm font-bold">
          الإجابة الصحيحة
          <input className="field text-base font-normal" value={q.answer} onChange={(e) => setQ({ ...q, answer: e.target.value })} maxLength={80} />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm font-bold">
        ملاحظة للمقدم (اختياري)
        <input className="field text-base font-normal" value={q.note ?? ''} onChange={(e) => setQ({ ...q, note: e.target.value })} maxLength={140} placeholder="معلومة إضافية تظهر للمقدم فقط" />
      </label>

      <div className="rounded-2xl border border-white/10 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold">صورة السؤال</span>
          <Segmented
            value={mediaKind}
            onChange={(v) => {
              if (v === 'none') setMedia(undefined);
              else if (v === 'emoji') setMedia({ kind: 'emoji', value: q.media?.kind === 'emoji' ? q.media.value : '🦁👑' });
              else if (v === 'flag') setMedia({ kind: 'flag', value: q.media?.kind === 'flag' ? q.media.value : 'jp' });
              else setMedia({ kind: 'image', value: q.media?.kind === 'image' ? q.media.value : '' });
            }}
            options={[
              { id: 'none', label: 'بدون' },
              { id: 'emoji', label: 'إيموجي' },
              { id: 'flag', label: 'علم' },
              { id: 'image', label: 'صورة' },
            ]}
          />
        </div>
        {q.media?.kind === 'emoji' && <input className="field text-center text-3xl" dir="ltr" value={q.media.value} onChange={(e) => setMedia({ ...q.media!, value: e.target.value })} maxLength={40} />}
        {q.media?.kind === 'flag' && (
          <select className="field" value={q.media.value} onChange={(e) => setMedia({ ...q.media!, value: e.target.value })}>
            {Object.entries(FLAGS)
              .sort((a, b) => a[1].name.localeCompare(b[1].name, 'ar'))
              .map(([code, f]) => (
                <option key={code} value={code}>
                  {f.name}
                </option>
              ))}
          </select>
        )}
        {q.media?.kind === 'image' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => file.current?.click()}>
              🖼️ رفع صورة من الجهاز
            </Button>
            <input className="field flex-1" dir="ltr" placeholder="أو رابط صورة https://…" value={q.media.value.startsWith('data:') ? '' : q.media.value} onChange={(e) => setMedia({ ...q.media!, value: e.target.value.trim() })} />
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setMedia({ ...q.media!, kind: 'image', value: await compressImage(f) });
                } catch {
                  toast('تعذر قراءة الصورة', 'error');
                }
                e.target.value = '';
              }}
            />
          </div>
        )}
        {q.media && q.media.value && (
          <>
            <div className="mt-3 rounded-xl bg-navy-950/60 p-2">
              <Media media={q.media} height={140} clear />
            </div>
            {q.media.kind !== 'emoji' && (
              <Toggle label="كشف تدريجي" desc="تبدأ الصورة مكبرة وضبابية وتتضح مع مرور الوقت" checked={!!q.media.progressive} onChange={(v) => setMedia({ ...q.media!, progressive: v })} />
            )}
          </>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="rounded-xl border border-red-400/50 bg-red-500/10 p-3 text-sm text-red-200">
          {errors.map((e) => (
            <li key={e}>⛔ {e}</li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="dark" onClick={onCancel}>
          إلغاء
        </Button>
        <Button variant="gold" onClick={submit}>
          💾 حفظ السؤال
        </Button>
      </div>
    </div>
  );
}

const PAGE = 60;

export function Editor() {
  useScreenRole('other');
  const toast = useGame((s) => s.toast);
  const [qs, setQs] = useState<Question[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [diff, setDiff] = useState<Difficulty | 'all'>('all');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Question | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const [b, u] = await Promise.all([DB.ensureBank(), DB.getUsage()]);
    setQs(b);
    setUsage(u);
    setLoading(false);
  };
  const notify = () => getBus().post({ t: 'bank', from: getBus().id });

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const term = normalizeArabic(search);
    return qs
      .filter((q) => (cat === 'all' || q.category === cat) && (diff === 'all' || q.difficulty === diff) && (!onlyCustom || q.custom))
      .filter((q) => !term || normalizeArabic(`${q.text} ${q.answer} ${q.options.join(' ')}`).includes(term))
      .sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  }, [qs, search, cat, diff, onlyCustom]);

  const dupes = useMemo(() => findDuplicates(qs), [qs]);
  const dupIds = useMemo(() => new Set(dupes.flat().map((q) => q.id)), [dupes]);
  const usedCount = Object.keys(usage).length;

  const save = async (q: Question) => {
    const dupe = qs.find((x) => x.id !== q.id && questionKey(x) === questionKey(q));
    if (dupe && !window.confirm('يوجد سؤال مطابق في البنك. حفظه على أي حال؟')) return;
    await DB.putQuestions([q]);
    setEditing(null);
    await reload();
    notify();
    toast('تم حفظ السؤال', 'success');
  };

  const remove = async (q: Question) => {
    if (!window.confirm(`حذف السؤال؟\n«${q.text}»`)) return;
    await DB.deleteQuestions([q.id]);
    await reload();
    notify();
    toast('تم حذف السؤال', 'info');
  };

  const doImport = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      let raws: unknown[];
      if (file.name.toLowerCase().endsWith('.csv')) raws = csvToRawQuestions(text);
      else {
        const data = JSON.parse(text);
        raws = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : [];
      }
      const existingKeys = new Map(qs.map((q) => [questionKey(q), q.id]));
      const accepted: Question[] = [];
      let invalid = 0;
      let duplicates = 0;
      raws.forEach((r, i) => {
        const q = coerceQuestion(r, uid(`imp${i}-`));
        if (!q) {
          invalid++;
          return;
        }
        const k = questionKey(q);
        const existing = existingKeys.get(k);
        if (existing && existing !== q.id) {
          duplicates++;
          return;
        }
        existingKeys.set(k, q.id);
        accepted.push(q);
      });
      if (accepted.length) await DB.putQuestions(accepted);
      await reload();
      notify();
      toast(`تم استيراد ${accepted.length} سؤالًا${duplicates ? ` • تجاهل ${duplicates} مكررًا` : ''}${invalid ? ` • ${invalid} غير صالح` : ''}`, accepted.length ? 'success' : 'warn');
    } catch (err) {
      console.error(err);
      toast('الملف غير صالح — استخدم JSON أو CSV', 'error');
    }
  };

  const exportFile = (list: Question[]) => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`ihtal-questions-${date}.json`, { app: 'ihtal-almamlaka', kind: 'questions', exportedAt: Date.now(), questions: list });
  };

  return (
    <Shell
      title="📝 محرر الأسئلة"
      wide
      actions={
        <>
          <Button variant="gold" onClick={() => setEditing(emptyQuestion())}>
            ➕ سؤال جديد
          </Button>
          <Button variant="ghost" onClick={() => importRef.current?.click()}>
            📥 استيراد
          </Button>
          <Button variant="ghost" onClick={() => exportFile(qs)}>
            📤 تصدير الكل
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {CATEGORIES.map((c) => {
          const n = qs.filter((q) => q.category === c.id).length;
          return (
            <button key={c.id} type="button" onClick={() => setCat(cat === c.id ? 'all' : c.id)} className={`panel p-3 text-start transition ${cat === c.id ? 'ring-2 ring-gold-300' : ''}`}>
              <div className="text-2xl">{c.icon}</div>
              <div className="text-sm font-bold" style={{ color: c.color }}>
                {c.name}
              </div>
              <div className="font-impact text-2xl">{n}</div>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <input className="field max-w-sm" placeholder="🔍 بحث في الأسئلة والإجابات…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="field w-auto" value={cat} onChange={(e) => setCat(e.target.value as CategoryId | 'all')}>
            <option value="all">كل الفئات</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="field w-auto" value={diff} onChange={(e) => setDiff(e.target.value as Difficulty | 'all')}>
            <option value="all">كل المستويات</option>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_INFO[d].name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyCustom} onChange={(e) => setOnlyCustom(e.target.checked)} /> المضافة فقط
          </label>
          <span className="ms-auto text-sm text-slate-400">
            {filtered.length} من {qs.length} سؤال • استُخدم {usedCount} في مباريات سابقة
          </span>
        </div>
        {dupes.length > 0 && <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-500/10 p-2 text-sm text-amber-200">⚠️ يوجد {dupes.length} مجموعة أسئلة مكررة (مميزة بعلامة ⚠️).</div>}

        <div className="mt-4 flex flex-col gap-2">
          {loading && <div className="py-8 text-center text-slate-400">جارٍ التحميل…</div>}
          {!loading && !filtered.length && <div className="py-8 text-center text-slate-400">لا توجد أسئلة مطابقة</div>}
          {filtered.slice(0, limit).map((q) => {
            const c = CATEGORY_MAP[q.category];
            const open = expanded === q.id;
            return (
              <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-start" onClick={() => setExpanded(open ? null : q.id)}>
                    <span className="text-xl">{c.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-white">
                        {dupIds.has(q.id) && '⚠️ '}
                        {q.text}
                        {q.media && <span className="ms-2 text-sm text-fuchsia-300">{q.media.kind === 'emoji' ? q.media.value : q.media.kind === 'flag' ? `🏳️ ${FLAGS[q.media.value]?.name ?? q.media.value}` : '🖼️ صورة'}</span>}
                      </span>
                      <span className="mt-0.5 block text-sm text-emerald-300">✔ {q.answer}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Badge color={DIFFICULTY_INFO[q.difficulty].color}>{DIFFICULTY_INFO[q.difficulty].name}</Badge>
                    {q.type === 'open' && <Badge color="#93c5fd">مفتوح</Badge>}
                    {q.custom && <Badge color="#f0abfc">مضاف</Badge>}
                    {usage[q.id] ? <Badge color="#94a3b8">استُخدم {usage[q.id]}×</Badge> : null}
                    <Button size="sm" variant="dark" onClick={() => setEditing(q)}>
                      ✏️
                    </Button>
                    <Button size="sm" variant="dark" onClick={() => setEditing({ ...q, id: '', custom: true, text: `${q.text}` })} title="نسخ">
                      ⧉
                    </Button>
                    <Button size="sm" variant="dark" className="text-red-300" onClick={() => void remove(q)}>
                      🗑
                    </Button>
                  </div>
                </div>
                {open && (
                  <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
                    {q.options.map((o, i) => (
                      <div key={i} className={`rounded-lg px-3 py-1.5 text-sm ${i === q.correct ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/5'}`}>
                        {LETTERS[i]}) {o}
                      </div>
                    ))}
                    {q.note && <div className="text-sm text-slate-400 sm:col-span-2">💡 {q.note}</div>}
                    {q.media && (
                      <div className="sm:col-span-2">
                        <Media media={q.media} height={110} clear />
                      </div>
                    )}
                    <div className="text-xs text-slate-500 sm:col-span-2">المعرّف: {q.id}</div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > limit && (
            <Button variant="dark" className="self-center" onClick={() => setLimit((l) => l + PAGE)}>
              عرض المزيد ({filtered.length - limit})
            </Button>
          )}
        </div>
      </Card>

      <Card title="أدوات البنك" icon="🧰" className="mt-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="dark" onClick={() => exportFile(filtered)}>
            📤 تصدير النتائج المعروضة ({filtered.length})
          </Button>
          <Button
            variant="dark"
            onClick={() => {
              const sample = `${CSV_HEADER.join(',')}\nfootball,easy,"كم عدد لاعبي الفريق؟",11,10,12,9,1,,\npuzzles,medium,"ما الشيء الذي كلما زاد نقص؟",,,,,,العمر,سؤال مفتوح`;
              const blob = new Blob(['﻿' + sample], { type: 'text/csv;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'ihtal-questions-template.csv';
              a.click();
            }}
          >
            📄 تنزيل قالب CSV
          </Button>
          <Button
            variant="dark"
            onClick={async () => {
              if (!window.confirm('إعادة الأسئلة الأصلية (المحذوفة والمعدلة) إلى حالتها الافتراضية؟ أسئلتك المضافة لن تُحذف.')) return;
              await DB.restoreDefaultQuestions();
              await reload();
              notify();
              toast('تمت استعادة البنك الأصلي', 'success');
            }}
          >
            ♻️ استعادة الأسئلة الأصلية
          </Button>
          <Button
            variant="dark"
            disabled={!usedCount}
            onClick={async () => {
              if (!window.confirm('مسح سجل الأسئلة المستخدمة؟ ستعود كل الأسئلة «جديدة» للمباريات القادمة.')) return;
              await DB.resetUsage();
              await reload();
              toast('تم مسح سجل الاستخدام', 'success');
            }}
          >
            🧹 مسح سجل الاستخدام
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          الاستيراد يقبل ملف JSON (مصفوفة أسئلة أو ملف تصدير) أو CSV بالأعمدة: {CSV_HEADER.join('، ')}. حقل correct رقم الخيار الصحيح (1-4)، واتركه مع الخيارات فارغة للسؤال المفتوح. الأسئلة المكررة تُتجاهل تلقائيًا.
        </p>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '✏️ تعديل سؤال' : '➕ سؤال جديد'} width="max-w-3xl">
        {editing && <QuestionForm key={editing.id || 'new'} initial={editing} onSave={(q) => void save(q)} onCancel={() => setEditing(null)} />}
      </Modal>
    </Shell>
  );
}
