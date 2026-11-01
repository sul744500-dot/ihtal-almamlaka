import { describe, expect, it } from 'vitest';
import { ALL_CATEGORY_IDS } from '../meta';
import { mulberry32 } from '../rng';
import { pickQuestion } from '../picker';
import { DEFAULT_QUESTIONS } from './bank';
import { coerceQuestion, findDuplicates, validateQuestion } from './validate';
import { FLAG_CODES } from '../flags';

describe('بنك الأسئلة', () => {
  it('يحتوي على 200 سؤال على الأقل', () => {
    expect(DEFAULT_QUESTIONS.length).toBeGreaterThanOrEqual(200);
  });

  it('كل الأسئلة سليمة', () => {
    const bad = DEFAULT_QUESTIONS.map((q) => ({ id: q.id, errors: validateQuestion(q) })).filter((x) => x.errors.length);
    expect(bad).toEqual([]);
  });

  it('لا توجد معرّفات أو أسئلة مكررة', () => {
    const ids = DEFAULT_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findDuplicates(DEFAULT_QUESTIONS)).toEqual([]);
  });

  it('كل فئة فيها 25 سؤالًا على الأقل وبالمستويات الثلاثة', () => {
    for (const cat of ALL_CATEGORY_IDS) {
      const qs = DEFAULT_QUESTIONS.filter((q) => q.category === cat);
      expect(qs.length, cat).toBeGreaterThanOrEqual(25);
      for (const d of ['easy', 'medium', 'hard'] as const) {
        expect(qs.filter((q) => q.difficulty === d).length, `${cat}/${d}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('الإجابات الصحيحة موزعة على مواقع مختلفة', () => {
    const counts = [0, 0, 0, 0];
    for (const q of DEFAULT_QUESTIONS) if (q.type === 'mcq') counts[q.correct]++;
    const total = counts.reduce((a, b) => a + b, 0);
    for (const c of counts) expect(c / total).toBeGreaterThan(0.15);
  });

  it('كل الأعلام المستخدمة مرسومة', () => {
    for (const q of DEFAULT_QUESTIONS) {
      if (q.media?.kind === 'flag') expect(FLAG_CODES, q.id).toContain(q.media.value);
    }
  });

  it('الاستيراد يرفض الأسئلة غير السليمة ويقبل السليمة', () => {
    expect(coerceQuestion({ text: 'x' }, 'a')).toBeNull();
    const ok = coerceQuestion(
      { category: 'general', difficulty: 'easy', text: 'سؤال؟', options: ['1', '2'], answer: '2' },
      'imp-1',
    );
    expect(ok?.correct).toBe(1);
    const open = coerceQuestion({ category: 'puzzles', difficulty: 'hard', text: 'لغز', answer: 'حل' }, 'imp-2');
    expect(open?.type).toBe('open');
  });
});

describe('اختيار الأسئلة', () => {
  it('لا يكرر أي سؤال داخل المباراة حتى ينفد البنك', () => {
    const rng = mulberry32(1);
    const used = new Set<string>();
    const cats = ALL_CATEGORY_IDS;
    for (let i = 0; i < DEFAULT_QUESTIONS.length; i++) {
      const r = pickQuestion(DEFAULT_QUESTIONS, {
        category: cats[i % cats.length],
        categories: cats,
        difficulty: (['easy', 'medium', 'hard'] as const)[i % 3],
        exclude: used,
        usage: {},
        avoidUsed: true,
        rng,
      })!;
      expect(used.has(r.question.id)).toBe(false);
      expect(r.repeated).toBe(false);
      used.add(r.question.id);
    }
    expect(used.size).toBe(DEFAULT_QUESTIONS.length);
  });

  it('يلتزم بفئة المنطقة ومستوى الصعوبة', () => {
    const r = pickQuestion(DEFAULT_QUESTIONS, {
      category: 'anime',
      categories: ALL_CATEGORY_IDS,
      difficulty: 'hard',
      exclude: new Set(),
      usage: {},
      avoidUsed: true,
      rng: mulberry32(3),
    })!;
    expect(r.question.category).toBe('anime');
    expect(r.question.difficulty).toBe('hard');
    expect(r.fallback).toBe(false);
  });

  it('يفضّل الأسئلة غير المستخدمة في مباريات سابقة', () => {
    const footballEasy = DEFAULT_QUESTIONS.filter((q) => q.category === 'football' && q.difficulty === 'easy');
    const usage = Object.fromEntries(footballEasy.slice(1).map((q) => [q.id, 2]));
    const r = pickQuestion(DEFAULT_QUESTIONS, {
      category: 'football',
      categories: ['football'],
      difficulty: 'easy',
      exclude: new Set(),
      usage,
      avoidUsed: true,
      rng: mulberry32(9),
    })!;
    expect(r.question.id).toBe(footballEasy[0].id);
  });
});
