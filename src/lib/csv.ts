// استيراد الأسئلة من ملف CSV (مثلًا من Excel أو Google Sheets)

import { ALL_CATEGORY_IDS, CATEGORIES } from './meta';
import type { CategoryId, Difficulty } from './types';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const DIFF_ALIASES: Record<string, Difficulty> = {
  easy: 'easy',
  سهل: 'easy',
  medium: 'medium',
  متوسط: 'medium',
  hard: 'hard',
  صعب: 'hard',
};

function categoryOf(v: string): CategoryId | null {
  const t = v.trim();
  if ((ALL_CATEGORY_IDS as string[]).includes(t)) return t as CategoryId;
  return CATEGORIES.find((c) => c.name === t || c.short === t)?.id ?? null;
}

export const CSV_HEADER = ['category', 'difficulty', 'text', 'option1', 'option2', 'option3', 'option4', 'correct', 'answer', 'note'];

/**
 * الأعمدة: category, difficulty, text, option1..option4, correct (1-4), answer, note
 * إذا كانت الخيارات فارغة يُعد السؤال مفتوحًا ويُستخدم عمود answer.
 */
export function csvToRawQuestions(text: string): Record<string, unknown>[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes('text') || header.includes('category');
  const idx = (name: string, fallback: number) => (hasHeader ? header.indexOf(name) : fallback);
  const col = Object.fromEntries(CSV_HEADER.map((h, i) => [h, idx(h, i)]));
  return rows.slice(hasHeader ? 1 : 0).map((r) => {
    const get = (k: string) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '');
    const options = ['option1', 'option2', 'option3', 'option4'].map(get).filter(Boolean);
    const correctRaw = get('correct');
    const n = parseInt(correctRaw, 10);
    return {
      category: categoryOf(get('category')),
      difficulty: DIFF_ALIASES[get('difficulty').toLowerCase()] ?? 'medium',
      text: get('text'),
      options,
      correct: Number.isFinite(n) ? n - 1 : -1,
      answer: get('answer') || (Number.isFinite(n) ? options[n - 1] : ''),
      note: get('note') || undefined,
      type: options.length ? 'mcq' : 'open',
    };
  });
}
