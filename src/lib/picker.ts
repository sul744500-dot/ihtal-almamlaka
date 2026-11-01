// اختيار الأسئلة: مستوى الصعوبة المناسب + منع التكرار داخل المباراة + تفضيل الأسئلة الأقل استخدامًا

import { isFinalRound, totalTurns } from './engine';
import { pickOne, shuffle, type Rng } from './rng';
import type { CategoryId, Cell, Difficulty, GameState, Question, QuestionMode } from './types';

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

export function targetDifficulty(s: GameState, cell: Cell | null, mode: QuestionMode, rng: Rng): Difficulty {
  const m = s.difficultyMode;
  if (m === 'easy' || m === 'medium' || m === 'hard') return m;
  if (mode === 'tiebreak') return 'medium';
  let level: number;
  if (m === 'mixed') {
    level = Math.floor(rng() * 2);
  } else {
    const p = s.turn / Math.max(1, totalTurns(s));
    level = p < 0.3 ? 0 : 1;
  }
  if (cell?.kind === 'golden') level += 1;
  if (mode === 'attack') level += 1;
  if (cell?.kind === 'crown' || isFinalRound(s)) level = 2;
  return LEVELS[Math.min(2, level)];
}

/** ترتيب البدائل عند نفاد الأسئلة من المستوى المطلوب */
const FALLBACK: Record<Difficulty, Difficulty[]> = {
  easy: ['easy', 'medium', 'hard'],
  medium: ['medium', 'easy', 'hard'],
  hard: ['hard', 'medium', 'easy'],
};

export interface PickOptions {
  category: CategoryId | null;
  categories: CategoryId[];
  difficulty: Difficulty;
  exclude: ReadonlySet<string>;
  usage: Record<string, number>;
  avoidUsed: boolean;
  rng: Rng;
}

export interface PickResult {
  question: Question;
  difficulty: Difficulty;
  /** سؤال من مستوى/فئة مختلفة لأن المطلوب نفد */
  fallback: boolean;
  /** اضطررنا لإعادة سؤال سبق طرحه في المباراة */
  repeated: boolean;
}

function leastUsed(list: Question[], usage: Record<string, number>, avoidUsed: boolean, rng: Rng): Question | undefined {
  if (!list.length) return undefined;
  if (!avoidUsed) return pickOne(list, rng);
  const min = Math.min(...list.map((q) => usage[q.id] ?? 0));
  return pickOne(
    list.filter((q) => (usage[q.id] ?? 0) === min),
    rng,
  );
}

/** يخلط ترتيب الخيارات عند العرض حتى لا يكون موقع الإجابة الصحيحة متوقعًا */
export function withShuffledOptions(q: Question, rng: Rng): Question {
  if (q.type !== 'mcq' || q.keepOrder || q.options.length < 2) return q;
  const order = shuffle(
    q.options.map((_, i) => i),
    rng,
  );
  return { ...q, options: order.map((i) => q.options[i]), correct: order.indexOf(q.correct) };
}

export function pickQuestion(bank: Question[], o: PickOptions): PickResult | null {
  const pool = bank.filter((q) => o.categories.includes(q.category));
  const fresh = pool.filter((q) => !o.exclude.has(q.id));
  // فئة المنطقة (أو فئة عشوائية من المختارة لمنطقة التاج)
  const cats = o.category ? [o.category] : shuffle(o.categories, o.rng);
  for (const diff of FALLBACK[o.difficulty]) {
    for (const cat of cats) {
      const q = leastUsed(
        fresh.filter((x) => x.category === cat && x.difficulty === diff),
        o.usage,
        o.avoidUsed,
        o.rng,
      );
      if (q) return { question: q, difficulty: diff, fallback: diff !== o.difficulty, repeated: false };
    }
  }
  // نفدت فئة المنطقة: نأخذ من أي فئة مختارة
  for (const diff of FALLBACK[o.difficulty]) {
    const q = leastUsed(
      fresh.filter((x) => x.difficulty === diff),
      o.usage,
      o.avoidUsed,
      o.rng,
    );
    if (q) return { question: q, difficulty: diff, fallback: true, repeated: false };
  }
  // نفد كل شيء: نسمح بالتكرار كحل أخير
  const any = leastUsed(pool.length ? pool : bank, o.usage, true, o.rng);
  return any ? { question: any, difficulty: any.difficulty, fallback: true, repeated: true } : null;
}
