import type { TimerState } from './types';

// المؤقت مبني على الطوابع الزمنية، فتحسبه كل شاشة محليًا دون رسائل متكررة

export function newTimer(durationMs: number, startedAt: number | null): TimerState {
  return { durationMs, startedAt, elapsedMs: 0, expired: false };
}

export const isRunning = (t: TimerState): boolean => t.startedAt !== null;

export function timerElapsed(t: TimerState, now: number): number {
  return t.elapsedMs + (t.startedAt !== null ? Math.max(0, now - t.startedAt) : 0);
}

export function timerRemaining(t: TimerState, now: number): number {
  return Math.max(0, t.durationMs - timerElapsed(t, now));
}

/** يوقف المؤقت مؤقتًا ويحفظ الوقت المنقضي (يعدّل الكائن نفسه) */
export function pauseTimerInPlace(t: TimerState, now: number): void {
  if (t.startedAt === null) return;
  t.elapsedMs = Math.min(t.durationMs, timerElapsed(t, now));
  t.startedAt = null;
}
