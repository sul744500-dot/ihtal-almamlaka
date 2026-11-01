import { ALL_CATEGORY_IDS } from './meta';
import { computeScores } from './scoring';
import type { CategoryId, GameState, TeamId, TimelinePoint } from './types';

export interface TeamStats {
  answers: number;
  correct: number;
  wrong: number;
  timeouts: number;
  accuracy: number;
  avgMs: number | null;
  fastestMs: number | null;
  captures: number;
  steals: number;
  lostToSteals: number;
  attacks: number;
  golden: number;
  crown: number;
  abilitiesUsed: number;
  bonus: number;
  longestStreak: number;
  currentStreak: number;
  cells: number;
  score: number;
  byCategory: Record<CategoryId, { total: number; correct: number }>;
}

export interface MatchStats {
  teams: Record<TeamId, TeamStats>;
  questions: number;
  leadChanges: number;
  biggestLead: { team: TeamId; value: number } | null;
  fastest: { team: TeamId; ms: number } | null;
  timeline: TimelinePoint[];
  bestCategory: Record<TeamId, CategoryId | null>;
}

const emptyTeam = (): TeamStats => ({
  answers: 0,
  correct: 0,
  wrong: 0,
  timeouts: 0,
  accuracy: 0,
  avgMs: null,
  fastestMs: null,
  captures: 0,
  steals: 0,
  lostToSteals: 0,
  attacks: 0,
  golden: 0,
  crown: 0,
  abilitiesUsed: 0,
  bonus: 0,
  longestStreak: 0,
  currentStreak: 0,
  cells: 0,
  score: 0,
  byCategory: Object.fromEntries(ALL_CATEGORY_IDS.map((c) => [c, { total: 0, correct: 0 }])) as TeamStats['byCategory'],
});

export function computeStats(s: GameState): MatchStats {
  const t: Record<TeamId, TeamStats> = { red: emptyTeam(), blue: emptyTeam() };
  const times: Record<TeamId, number[]> = { red: [], blue: [] };
  let questions = 0;
  for (const e of s.log) {
    const team = e.team;
    if (e.kind === 'answer' && team) {
      const ts = t[team];
      ts.answers++;
      if (!e.rebound) questions++;
      if (e.mode === 'attack') ts.attacks++;
      if (e.category) {
        ts.byCategory[e.category].total++;
        if (e.correct) ts.byCategory[e.category].correct++;
      }
      if (e.correct) {
        ts.correct++;
        ts.currentStreak++;
        ts.longestStreak = Math.max(ts.longestStreak, ts.currentStreak);
        if (typeof e.ms === 'number') times[team].push(e.ms);
      } else {
        ts.currentStreak = 0;
        if (e.timedOut) ts.timeouts++;
        else ts.wrong++;
      }
    } else if (e.kind === 'capture' && team) {
      t[team].captures++;
      if (e.cellKind === 'golden') t[team].golden++;
      if (e.cellKind === 'crown') t[team].crown++;
    } else if (e.kind === 'steal' && team) {
      t[team].captures++;
      t[team].steals++;
      if (e.victim) t[e.victim].lostToSteals++;
      if (e.cellKind === 'golden') t[team].golden++;
      if (e.cellKind === 'crown') t[team].crown++;
    } else if (e.kind === 'ability' && team && e.text.includes('استخدم')) {
      t[team].abilitiesUsed++;
    }
  }
  const scores = computeScores(s);
  let fastest: MatchStats['fastest'] = null;
  for (const team of ['red', 'blue'] as TeamId[]) {
    const ts = t[team];
    ts.accuracy = ts.answers ? ts.correct / ts.answers : 0;
    const arr = times[team];
    ts.avgMs = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    ts.fastestMs = arr.length ? Math.min(...arr) : null;
    if (ts.fastestMs !== null && (!fastest || ts.fastestMs < fastest.ms)) fastest = { team, ms: ts.fastestMs };
    ts.bonus = s.teams[team].bonus;
    ts.cells = scores[team].cells;
    ts.score = scores[team].total;
  }
  const timeline = [...s.timeline];
  const last = timeline[timeline.length - 1];
  if (!last || last.red !== scores.red.total || last.blue !== scores.blue.total) {
    timeline.push({ turn: s.turn + (s.phase === 'finished' ? 0 : 1), red: scores.red.total, blue: scores.blue.total });
  }
  let leadChanges = 0;
  let prevLeader: TeamId | null = null;
  let biggestLead: MatchStats['biggestLead'] = null;
  for (const p of timeline) {
    const leader: TeamId | null = p.red > p.blue ? 'red' : p.blue > p.red ? 'blue' : null;
    if (leader && prevLeader && leader !== prevLeader) leadChanges++;
    if (leader) prevLeader = leader;
    const diff = Math.abs(p.red - p.blue);
    if (leader && (!biggestLead || diff > biggestLead.value)) biggestLead = { team: leader, value: diff };
  }
  const bestCategory = { red: null, blue: null } as Record<TeamId, CategoryId | null>;
  for (const team of ['red', 'blue'] as TeamId[]) {
    let best: CategoryId | null = null;
    let bestScore = -1;
    for (const c of ALL_CATEGORY_IDS) {
      const v = t[team].byCategory[c];
      if (!v.total) continue;
      const sc = v.correct * 10 + v.correct / v.total;
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    bestCategory[team] = best;
  }
  return { teams: t, questions, leadChanges, biggestLead, fastest, timeline, bestCategory };
}

/** سلسلة الإجابات الصحيحة الحالية لكل فريق (لعرض 🔥 على الشاشة) */
export function currentStreaks(s: GameState): Record<TeamId, number> {
  const out: Record<TeamId, number> = { red: 0, blue: 0 };
  const done: Record<TeamId, boolean> = { red: false, blue: false };
  for (let i = s.log.length - 1; i >= 0; i--) {
    const e = s.log[i];
    if (e.kind !== 'answer' || !e.team || done[e.team]) continue;
    if (e.correct) out[e.team]++;
    else done[e.team] = true;
    if (done.red && done.blue) break;
  }
  return out;
}

export const fmtSec = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} ث`);
