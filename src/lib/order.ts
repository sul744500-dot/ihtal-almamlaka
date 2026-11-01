import type { GameState } from './types';

type Ordered = Pick<GameState, 'id' | 'rev' | 'activeAt' | 'updatedAt'> & { origin?: string };

/**
 * هل الحالة r أحدث من mine؟ (القاعدة نفسها في relay/logic.mjs)
 * مباراة مختلفة ← الأحدث تفعيلًا. نفس المباراة ← رقم المراجعة، ثم وقت التحديث، ثم مصدر التعديل،
 * حتى تتفق كل الشاشات على النسخة نفسها إذا عدّل جهازان في اللحظة نفسها.
 */
export function isNewerState(r: Ordered, mine: Ordered | null | undefined): boolean {
  if (!mine) return true;
  if (r.id !== mine.id) return (r.activeAt ?? 0) > (mine.activeAt ?? 0);
  if (r.rev !== mine.rev) return r.rev > mine.rev;
  if ((r.updatedAt ?? 0) !== (mine.updatedAt ?? 0)) return (r.updatedAt ?? 0) > (mine.updatedAt ?? 0);
  return String(r.origin ?? '') > String(mine.origin ?? '');
}

export function isLocalOrigin(): boolean {
  if (typeof location === 'undefined') return true;
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h.endsWith('.localhost');
}
