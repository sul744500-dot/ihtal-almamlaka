// سجل التراجع: نحفظ لقطة من الحالة قبل كل حركة مهمة

import { freezeTimers, type ActionBody } from './engine';
import type { GameState, MatchRecord } from './types';

export const HISTORY_LIMIT = 40;

/** حركات لا تستحق نقطة تراجع خاصة بها (المؤقت والعرض والأصوات) */
const NON_UNDOABLE = new Set<ActionBody['type']>([
  'TIMER_START',
  'TIMER_PAUSE',
  'TIMER_RESET',
  'TIMER_ADD',
  'TIMER_EXPIRE',
  'PICK_OPTION',
  'REVEAL',
  'ANNOUNCE',
  'SFX',
  'SET_VIEW',
  'WHEEL_APPLY',
]);

export const isUndoable = (type: ActionBody['type']): boolean => !NON_UNDOABLE.has(type);

export function commit(rec: MatchRecord, next: GameState, undoable: boolean): MatchRecord {
  const state = { ...next, rev: rec.state.rev + 1 };
  const past = undoable ? [...rec.past, rec.state].slice(-HISTORY_LIMIT) : rec.past;
  return { id: rec.id, state, past };
}

/** يستعيد الحالة السابقة مع رقم مراجعة أعلى حتى تقبلها كل الشاشات */
export function undo(rec: MatchRecord, now: number): MatchRecord | null {
  if (!rec.past.length) return null;
  const prev = rec.past[rec.past.length - 1];
  // نجمّد المؤقت عند لحظة الحركة الملغاة حتى يعود الوقت المتبقي كما كان
  const restored = structuredClone(freezeTimers(prev, rec.state.updatedAt));
  restored.rev = rec.state.rev + 1;
  restored.seq = Math.max(rec.state.seq, restored.seq);
  restored.fx = [];
  restored.updatedAt = now;
  restored.activeAt = rec.state.activeAt;
  return { id: rec.id, state: restored, past: rec.past.slice(0, -1) };
}

/** عند استقبال حالة أحدث من شاشة تحكم أخرى، نحافظ على سجل تراجع مطابق */
export function adopt(rec: MatchRecord | null, remote: GameState, flags: { undoable?: boolean; undo?: boolean }): MatchRecord {
  if (!rec || rec.id !== remote.id) return { id: remote.id, state: remote, past: [] };
  // جهازان عدّلا في اللحظة نفسها: نأخذ النسخة الفائزة دون المساس بسجل التراجع
  if (remote.rev === rec.state.rev) return { id: rec.id, state: remote, past: rec.past };
  let past = rec.past;
  if (flags.undo) past = past.slice(0, -1);
  else if (flags.undoable) past = [...past, rec.state].slice(-HISTORY_LIMIT);
  return { id: rec.id, state: remote, past };
}
