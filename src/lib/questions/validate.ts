import { ALL_CATEGORY_IDS } from '../meta';
import type { Difficulty, Question } from '../types';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

/** توحيد النص العربي للمقارنة (إزالة التشكيل والتطويل وتوحيد الألف والياء والتاء المربوطة) */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[«»"'“”‘’؟?!.,،:؛;()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function questionKey(q: Pick<Question, 'text' | 'media'>): string {
  return `${normalizeArabic(q.text)}|${q.media ? `${q.media.kind}:${q.media.value}` : ''}`;
}

/** يعيد قائمة بالأخطاء (فارغة إذا كان السؤال سليمًا) */
export function validateQuestion(q: Partial<Question>): string[] {
  const errors: string[] = [];
  if (!q.id || typeof q.id !== 'string') errors.push('معرّف السؤال مفقود');
  if (!q.category || !ALL_CATEGORY_IDS.includes(q.category)) errors.push('الفئة غير صحيحة');
  if (!q.difficulty || !DIFFS.includes(q.difficulty)) errors.push('مستوى الصعوبة غير صحيح');
  if (!q.text || !q.text.trim()) errors.push('نص السؤال فارغ');
  if (q.type === 'mcq') {
    const opts = q.options ?? [];
    if (opts.length < 2 || opts.length > 6) errors.push('يجب أن يكون عدد الخيارات بين 2 و6');
    if (opts.some((o) => !o || !String(o).trim())) errors.push('يوجد خيار فارغ');
    const norm = opts.map((o) => normalizeArabic(String(o)));
    if (new Set(norm).size !== norm.length) errors.push('يوجد خيارات مكررة');
    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= opts.length) errors.push('رقم الإجابة الصحيحة خارج نطاق الخيارات');
    else if (q.answer !== opts[q.correct]) errors.push('نص الإجابة لا يطابق الخيار الصحيح');
  } else if (q.type === 'open') {
    if (!q.answer || !q.answer.trim()) errors.push('الإجابة الصحيحة فارغة');
  } else {
    errors.push('نوع السؤال غير معروف');
  }
  if (q.media) {
    if (!['emoji', 'flag', 'image'].includes(q.media.kind)) errors.push('نوع الوسائط غير معروف');
    if (!q.media.value) errors.push('قيمة الوسائط فارغة');
  }
  return errors;
}

/** يجمع الأسئلة المكررة (بالنص الموحد + الوسائط) */
export function findDuplicates(questions: Question[]): Question[][] {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const k = questionKey(q);
    const g = groups.get(k);
    if (g) g.push(q);
    else groups.set(k, [q]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** يحوّل كائنًا مستوردًا إلى سؤال سليم، أو يعيد null */
export function coerceQuestion(raw: unknown, fallbackId: string): Question | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const options = Array.isArray(r.options) ? r.options.map((o) => String(o ?? '').trim()) : [];
  const type = r.type === 'open' || options.length === 0 ? 'open' : 'mcq';
  let correct = typeof r.correct === 'number' ? r.correct : -1;
  let answer = typeof r.answer === 'string' ? r.answer.trim() : '';
  if (type === 'mcq') {
    if (correct < 0 && answer) correct = options.indexOf(answer);
    if (correct >= 0 && correct < options.length) answer = options[correct];
  } else {
    correct = -1;
  }
  const media = r.media && typeof r.media === 'object' ? (r.media as Question['media']) : undefined;
  const q: Question = {
    id: typeof r.id === 'string' && r.id ? r.id : fallbackId,
    category: r.category as Question['category'],
    difficulty: r.difficulty as Difficulty,
    type,
    text: String(r.text ?? '').trim(),
    options: type === 'mcq' ? options : [],
    correct,
    answer,
    note: typeof r.note === 'string' && r.note.trim() ? r.note.trim() : undefined,
    media,
    custom: r.custom === undefined ? true : Boolean(r.custom),
    updatedAt: Date.now(),
  };
  return validateQuestion(q).length === 0 ? q : null;
}
