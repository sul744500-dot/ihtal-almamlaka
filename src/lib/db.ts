// التخزين المحلي عبر IndexedDB: المباريات وسجل التراجع والأسئلة والإعدادات

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { BANK_VERSION, DEFAULT_QUESTIONS } from './questions/bank';
import { computeScores } from './scoring';
import { roundOf, totalTurns } from './engine';
import type { GameState, MatchSummary, Question, Settings } from './types';

interface Schema extends DBSchema {
  matches: { key: string; value: { id: string; state: GameState; savedAt: number } };
  history: { key: string; value: { id: string; past: GameState[] } };
  questions: { key: string; value: Question };
  kv: { key: string; value: unknown };
}

const DB_NAME = 'ihtal-almamlaka';
let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  dbp ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('matches', { keyPath: 'id' });
      d.createObjectStore('history', { keyPath: 'id' });
      d.createObjectStore('questions', { keyPath: 'id' });
      d.createObjectStore('kv');
    },
  });
  return dbp;
}

// ───── مفاتيح عامة ─────

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('kv', key)) as T | undefined;
}

export async function setKV(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key);
}

export const getActiveMatchId = () => getKV<string | null>('activeMatchId');
export const setActiveMatchId = (id: string | null) => setKV('activeMatchId', id);

export const loadSettings = () => getKV<Settings>('settings');
export const saveSettings = (s: Settings) => setKV('settings', s);

// ───── المباريات ─────

export async function saveMatch(state: GameState, past?: GameState[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(['matches', 'history'], 'readwrite');
  const existing = await tx.objectStore('matches').get(state.id);
  // لا نكتب فوق نسخة أحدث (قد تكتبها شاشة تحكم أخرى)
  if (!existing || existing.state.rev <= state.rev) {
    await tx.objectStore('matches').put({ id: state.id, state, savedAt: Date.now() });
    if (past) await tx.objectStore('history').put({ id: state.id, past });
  }
  await tx.done;
}

export async function loadMatch(id: string): Promise<{ state: GameState; past: GameState[] } | null> {
  const d = await db();
  const m = await d.get('matches', id);
  if (!m) return null;
  const h = await d.get('history', id);
  return { state: m.state, past: h?.past ?? [] };
}

export async function deleteMatch(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['matches', 'history'], 'readwrite');
  await tx.objectStore('matches').delete(id);
  await tx.objectStore('history').delete(id);
  await tx.done;
}

export function summarize(s: GameState): MatchSummary {
  const sc = computeScores(s);
  return {
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    phase: s.phase,
    round: Math.min(s.rules.rounds, roundOf(Math.min(s.turn, totalTurns(s) - 1))),
    rounds: s.rules.rounds,
    teams: {
      red: { name: s.teams.red.name, emblem: s.teams.red.emblem, score: sc.red.total },
      blue: { name: s.teams.blue.name, emblem: s.teams.blue.emblem, score: sc.blue.total },
    },
    winner: s.winner,
  };
}

export async function listMatches(): Promise<MatchSummary[]> {
  const all = await (await db()).getAll('matches');
  return all.map((m) => summarize(m.state)).sort((a, b) => b.updatedAt - a.updatedAt);
}

// ───── الأسئلة ─────

/** يزرع البنك الافتراضي أول مرة، ويضيف الأسئلة الجديدة عند تحديث التطبيق دون المساس بتعديلات المستخدم */
export async function ensureBank(): Promise<Question[]> {
  const d = await db();
  const version = (await getKV<number>('bankVersion')) ?? 0;
  if (version < BANK_VERSION) {
    const deleted = new Set((await getKV<string[]>('deletedBuiltins')) ?? []);
    const tx = d.transaction('questions', 'readwrite');
    // نحذف أسئلة الإصدار السابق الأصلية التي لم يعدّلها المستخدم (المضافة والمعدّلة تبقى)
    const current = new Set(DEFAULT_QUESTIONS.map((q) => q.id));
    for (const q of await tx.store.getAll()) {
      if (!q.custom && !q.updatedAt && !current.has(q.id)) await tx.store.delete(q.id);
    }
    const existing = new Set(await tx.store.getAllKeys());
    for (const q of DEFAULT_QUESTIONS) {
      if (!existing.has(q.id) && !deleted.has(q.id)) await tx.store.put(q);
    }
    await tx.done;
    await setKV('bankVersion', BANK_VERSION);
  }
  return d.getAll('questions');
}

export async function getAllQuestions(): Promise<Question[]> {
  return (await db()).getAll('questions');
}

export async function putQuestions(qs: Question[]): Promise<void> {
  const tx = (await db()).transaction('questions', 'readwrite');
  for (const q of qs) await tx.store.put(q);
  await tx.done;
}

export async function deleteQuestions(ids: string[]): Promise<void> {
  const tx = (await db()).transaction('questions', 'readwrite');
  for (const id of ids) await tx.store.delete(id);
  await tx.done;
  const builtin = new Set(DEFAULT_QUESTIONS.map((q) => q.id));
  const deleted = new Set((await getKV<string[]>('deletedBuiltins')) ?? []);
  for (const id of ids) if (builtin.has(id)) deleted.add(id);
  await setKV('deletedBuiltins', [...deleted]);
}

export async function replaceAllQuestions(qs: Question[]): Promise<void> {
  const tx = (await db()).transaction('questions', 'readwrite');
  await tx.store.clear();
  for (const q of qs) await tx.store.put(q);
  await tx.done;
  const keep = new Set(qs.map((q) => q.id));
  await setKV(
    'deletedBuiltins',
    DEFAULT_QUESTIONS.filter((q) => !keep.has(q.id)).map((q) => q.id),
  );
}

export async function restoreDefaultQuestions(): Promise<void> {
  await putQuestions(DEFAULT_QUESTIONS);
  await setKV('deletedBuiltins', []);
}

// ───── سجل استخدام الأسئلة عبر المباريات ─────

export const getUsage = async () => (await getKV<Record<string, number>>('usage')) ?? {};

export async function bumpUsage(id: string): Promise<Record<string, number>> {
  const usage = await getUsage();
  usage[id] = (usage[id] ?? 0) + 1;
  await setKV('usage', usage);
  return usage;
}

export const resetUsage = () => setKV('usage', {});

// ───── النسخ الاحتياطي ─────

export interface Backup {
  app: 'ihtal-almamlaka';
  version: 1;
  exportedAt: number;
  settings?: Settings;
  questions: Question[];
  matches: { state: GameState }[];
  usage: Record<string, number>;
}

export async function exportAll(): Promise<Backup> {
  const d = await db();
  return {
    app: 'ihtal-almamlaka',
    version: 1,
    exportedAt: Date.now(),
    settings: await loadSettings(),
    questions: await d.getAll('questions'),
    matches: (await d.getAll('matches')).map((m) => ({ state: m.state })),
    usage: await getUsage(),
  };
}

export async function importAll(b: Backup): Promise<{ questions: number; matches: number }> {
  if (!b || b.app !== 'ihtal-almamlaka') throw new Error('الملف ليس نسخة احتياطية من «احتلّ المملكة»');
  if (b.questions?.length) await putQuestions(b.questions);
  let matches = 0;
  for (const m of b.matches ?? []) {
    if (m?.state?.id && m.state.cells?.length === 25) {
      await saveMatch(m.state, []);
      matches++;
    }
  }
  if (b.settings) await saveSettings(b.settings);
  if (b.usage) await setKV('usage', b.usage);
  return { questions: b.questions?.length ?? 0, matches };
}

export async function clearAllData(): Promise<void> {
  const d = await db();
  for (const store of ['matches', 'history', 'questions', 'kv'] as const) await d.clear(store);
}
