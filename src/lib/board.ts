import type { CategoryId, Cell, Rules } from './types';
import { shuffle, type Rng } from './rng';

export const BOARD_SIZE = 5;
export const CENTER_CELL = 12;

/**
 * أسماء المناطق مرتبة تقريبيًا حسب موقعها على خريطة المملكة:
 * الصف الأول شمالًا، والعمود الأول (أقصى اليمين في الواجهة العربية) شرقًا.
 */
export const CITY_GRID: string[] = [
  'الجبيل', 'حفر الباطن', 'عرعر', 'سكاكا', 'تبوك',
  'الدمام', 'بريدة', 'حائل', 'العلا', 'ينبع',
  'الأحساء', 'الخرج', 'الرياض', 'المدينة المنورة', 'جدة',
  'وادي الدواسر', 'بيشة', 'الطائف', 'مكة المكرمة', 'القنفذة',
  'شرورة', 'نجران', 'خميس مشيط', 'أبها', 'جازان',
];

const neighbors = (id: number): number[] => {
  const r = Math.floor(id / BOARD_SIZE);
  const c = id % BOARD_SIZE;
  const out: number[] = [];
  if (r > 0) out.push(id - BOARD_SIZE);
  if (r < BOARD_SIZE - 1) out.push(id + BOARD_SIZE);
  if (c > 0) out.push(id - 1);
  if (c < BOARD_SIZE - 1) out.push(id + 1);
  return out;
};

/** يوزع المناطق الذهبية بحيث لا تتجاور قدر الإمكان */
export function pickGoldenCells(count: number, rng: Rng, exclude: number[] = [CENTER_CELL]): number[] {
  const candidates = shuffle(
    Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => i).filter((i) => !exclude.includes(i)),
    rng,
  );
  const chosen: number[] = [];
  for (const id of candidates) {
    if (chosen.length >= count) break;
    if (neighbors(id).some((n) => chosen.includes(n))) continue;
    chosen.push(id);
  }
  for (const id of candidates) {
    if (chosen.length >= count) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen;
}

/** يوزع الفئات المختارة على المناطق بالتساوي */
export function assignCategories(cellIds: number[], categories: CategoryId[], rng: Rng): Map<number, CategoryId> {
  const map = new Map<number, CategoryId>();
  if (categories.length === 0) return map;
  const pool: CategoryId[] = [];
  const order = shuffle(categories, rng);
  while (pool.length < cellIds.length) pool.push(...order);
  const shuffledPool = shuffle(pool.slice(0, cellIds.length), rng);
  cellIds.forEach((id, i) => map.set(id, shuffledPool[i]));
  return map;
}

export function buildCells(rules: Rules, categories: CategoryId[], rng: Rng): Cell[] {
  const crownId = rules.crownEnabled ? CENTER_CELL : -1;
  const golden = pickGoldenCells(rules.goldenCount, rng, rules.crownEnabled ? [CENTER_CELL] : []);
  const ids = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => i);
  const catMap = assignCategories(
    ids.filter((i) => i !== crownId),
    categories,
    rng,
  );
  return ids.map<Cell>((id) => ({
    id,
    name: CITY_GRID[id],
    kind: id === crownId ? 'crown' : golden.includes(id) ? 'golden' : 'normal',
    owner: null,
    category: id === crownId ? null : (catMap.get(id) ?? null),
    shieldUntil: null,
    immuneUntil: null,
    goldenClaimed: false,
    captures: 0,
    lastCapturedTurn: null,
  }));
}
