// محرك اللعبة: دالة نقية تحوّل الحالة الحالية + الحركة إلى حالة جديدة.
// كل العشوائية تأتي من seed داخل الحركة، فيمكن اختبار كل شيء وإعادة إنتاجه.

import { buildCells } from './board';
import { ABILITY_IDS, ABILITY_INFO, ALL_CATEGORY_IDS, EVENT_IDS, EVENT_INFO, WHEEL_INFO, WHEEL_SEGMENTS } from './meta';
import { mulberry32, pickOne, shuffle, type Rng } from './rng';
import { sanitizeRules } from './rules';
import { computeScores, leaderOf } from './scoring';
import { newTimer, pauseTimerInPlace, timerRemaining } from './timer';
import {
  other,
  type AbilityId,
  type AudienceView,
  type CategoryId,
  type Cell,
  type CellKind,
  type Difficulty,
  type DifficultyMode,
  type EventId,
  type Fx,
  type GameState,
  type LogEntry,
  type Question,
  type QuestionMode,
  type Rules,
  type SoundId,
  type TeamId,
  type WheelPrize,
} from './types';

// ───────────── الحركات ─────────────

export type ActionBody =
  | { type: 'SELECT_CELL'; cellId: number | null }
  | { type: 'DRAW_QUESTION'; question: Question; difficulty: Difficulty }
  | { type: 'REPLACE_QUESTION'; question: Question; difficulty: Difficulty }
  | { type: 'CANCEL_QUESTION' }
  | { type: 'TIMER_START' }
  | { type: 'TIMER_PAUSE' }
  | { type: 'TIMER_RESET' }
  | { type: 'TIMER_ADD'; ms: number }
  | { type: 'TIMER_EXPIRE'; qid: string }
  | { type: 'PICK_OPTION'; index: number | null }
  | { type: 'JUDGE'; correct: boolean }
  | { type: 'REVEAL'; value: boolean }
  | { type: 'NEXT_TURN' }
  | { type: 'USE_ABILITY'; team: TeamId; ability: AbilityId; cellId?: number }
  | { type: 'ADJUST_BONUS'; team: TeamId; delta: number; reason?: string }
  | { type: 'SET_OWNER'; cellId: number; owner: TeamId | null }
  | { type: 'TOGGLE_SHIELD'; cellId: number }
  | { type: 'SET_CELL_KIND'; cellId: number; kind: Exclude<CellKind, 'crown'> }
  | { type: 'SET_ACTIVE_TEAM'; team: TeamId }
  | { type: 'TRIGGER_EVENT'; event: EventId }
  | { type: 'SPIN_WHEEL'; team: TeamId }
  | { type: 'WHEEL_APPLY' }
  | { type: 'WHEEL_CLOSE' }
  | { type: 'TIEBREAK_RESULT'; winner: TeamId | null }
  | { type: 'FINISH'; draw?: boolean }
  | { type: 'ANNOUNCE'; title: string; sub?: string; icon?: string; sound?: SoundId }
  | { type: 'SFX'; sound: SoundId }
  | { type: 'SET_VIEW'; view: AudienceView }
  | { type: 'UPDATE_RULES'; rules: Partial<Rules> }
  | { type: 'RENAME_TEAM'; team: TeamId; name?: string; emblem?: string };

export type Action = ActionBody & { now: number; seed: number };

// ───────────── أدوات مساعدة عامة ─────────────

export const totalTurns = (s: Pick<GameState, 'rules'>): number => s.rules.rounds * 2;
export const roundOf = (turn: number): number => Math.floor(turn / 2) + 1;
export const teamForTurn = (s: Pick<GameState, 'startingTeam'>, turn: number): TeamId =>
  turn % 2 === 0 ? s.startingTeam : other(s.startingTeam);

export function isFinalRound(s: GameState): boolean {
  return (
    s.rules.finalRoundEnabled &&
    s.phase !== 'tiebreak' &&
    s.phase !== 'finished' &&
    s.rules.rounds > 1 &&
    roundOf(s.turn) === s.rules.rounds
  );
}

export function isShielded(s: GameState, cell: Cell): boolean {
  return cell.shieldUntil !== null && s.turn <= cell.shieldUntil && !isFinalRound(s);
}

export function isImmune(s: GameState, cell: Cell): boolean {
  return s.rules.stealImmunity && cell.immuneUntil !== null && s.turn <= cell.immuneUntil && !isFinalRound(s);
}

export function isLocked(s: GameState, cell: Cell): boolean {
  return cell.kind === 'crown' && !s.crownActive;
}

export interface TargetInfo {
  ok: boolean;
  mode: 'claim' | 'attack' | null;
  reason?: string;
}

export function targetInfo(s: GameState, cellId: number, team: TeamId = s.activeTeam): TargetInfo {
  const cell = s.cells[cellId];
  if (!cell) return { ok: false, mode: null, reason: 'منطقة غير موجودة' };
  if (isLocked(s, cell)) return { ok: false, mode: null, reason: 'منطقة التاج مقفلة حتى الجولات الأخيرة' };
  if (cell.owner === team) return { ok: false, mode: null, reason: 'هذه المنطقة ملك الفريق بالفعل' };
  if (cell.owner === null) return { ok: true, mode: 'claim' };
  if (!s.rules.stealEnabled) return { ok: false, mode: 'attack', reason: 'السرقة معطلة في هذه المباراة' };
  if (isShielded(s, cell)) return { ok: false, mode: 'attack', reason: 'المنطقة محمية بدرع' };
  if (isImmune(s, cell)) return { ok: false, mode: 'attack', reason: 'سُرقت للتو، ولا تُسترجع في الدور التالي مباشرة' };
  return { ok: true, mode: 'attack' };
}

export function hasTargets(s: GameState, team: TeamId = s.activeTeam): boolean {
  return s.cells.some((c) => targetInfo(s, c.id, team).ok);
}

export function trailingTeam(s: GameState, minGap = 1): TeamId | null {
  const sc = computeScores(s);
  if (sc.red.total + minGap <= sc.blue.total) return 'red';
  if (sc.blue.total + minGap <= sc.red.total) return 'blue';
  return null;
}

const teamName = (s: GameState, t: TeamId | null | undefined): string => (t ? s.teams[t].name : '');

function nextId(s: GameState): string {
  s.seq += 1;
  return `${s.id}:${s.seq}`;
}

function pushFx(s: GameState, fx: Omit<Fx, 'id' | 'at'>, now: number): void {
  s.fx.push({ id: nextId(s), at: now, ...fx });
}

function pushLog(s: GameState, e: Omit<LogEntry, 'id' | 'at' | 'turn' | 'round'>, now: number): void {
  s.log.push({ id: nextId(s), at: now, turn: s.turn, round: roundOf(s.turn), ...e });
}

// ───────────── إنشاء مباراة ─────────────

export interface NewMatchParams {
  id: string;
  title: string;
  now: number;
  seed: number;
  teams: Record<TeamId, { name: string; emblem: string }>;
  rules: Partial<Rules>;
  categories: CategoryId[];
  difficultyMode: DifficultyMode;
  startingTeam: TeamId | 'random';
}

function scheduleEvents(rules: Rules, rng: Rng): number[] {
  if (rules.eventsCount <= 0) return [];
  const total = rules.rounds * 2;
  const from = Math.max(2, Math.floor(total * 0.25));
  const to = Math.floor(total * 0.8);
  const candidates: number[] = [];
  for (let t = from; t < to; t++) candidates.push(t);
  const chosen: number[] = [];
  for (const t of shuffle(candidates, rng)) {
    if (chosen.length >= rules.eventsCount) break;
    if (chosen.some((c) => Math.abs(c - t) < 3)) continue;
    chosen.push(t);
  }
  return chosen.sort((a, b) => a - b);
}

export function createMatch(p: NewMatchParams): GameState {
  const rng = mulberry32(p.seed);
  const rules = sanitizeRules(p.rules);
  const categories = p.categories.length ? p.categories : ALL_CATEGORY_IDS;
  const startingTeam: TeamId = p.startingTeam === 'random' ? (rng() < 0.5 ? 'red' : 'blue') : p.startingTeam;
  const s: GameState = {
    v: 1,
    id: p.id,
    title: p.title.trim() || 'احتلّ المملكة',
    createdAt: p.now,
    updatedAt: p.now,
    rev: 1,
    activeAt: p.now,
    seq: 0,
    phase: 'select',
    turn: 0,
    activeTeam: startingTeam,
    startingTeam,
    teams: {
      red: { id: 'red', name: p.teams.red.name.trim() || 'الفريق الأحمر', emblem: p.teams.red.emblem || '🦅', bonus: 0, abilities: [] },
      blue: { id: 'blue', name: p.teams.blue.name.trim() || 'الفريق الأزرق', emblem: p.teams.blue.emblem || '🐺', bonus: 0, abilities: [] },
    },
    cells: buildCells(rules, categories, rng),
    rules,
    categories,
    difficultyMode: p.difficultyMode,
    selectedCell: null,
    current: null,
    usedQuestionIds: [],
    log: [],
    timeline: [{ turn: 0, red: 0, blue: 0 }],
    fx: [],
    wheel: null,
    wheelPending: null,
    eventTurns: scheduleEvents(rules, rng),
    eventsUsed: 0,
    pendingEvent: null,
    comeback: { red: 0, blue: 0 },
    leader: null,
    crownActive: rules.crownEnabled && 1 > rules.rounds - rules.crownRounds,
    tiebreakCount: 0,
    winner: null,
    finishedAt: null,
    audienceView: 'board',
  };
  pushFx(s, { type: 'start', title: s.title, sub: `يبدأ ${s.teams[startingTeam].name}`, team: startingTeam, sound: 'gong' }, p.now);
  pushLog(s, { kind: 'info', team: startingTeam, text: `بدأت المباراة — يبدأ ${s.teams[startingTeam].name}` }, p.now);
  return s;
}

// ───────────── منطق التقدم والنقاط ─────────────

/** يتتبع أكبر عجز لكل فريق ويطلق «ريمونتادا» عند قلب النتيجة */
function checkLead(s: GameState, now: number, delay = 0): void {
  const sc = computeScores(s);
  for (const t of ['red', 'blue'] as TeamId[]) {
    const deficit = sc[other(t)].total - sc[t].total;
    if (deficit > s.comeback[t]) s.comeback[t] = deficit;
  }
  const leader = leaderOf(sc);
  if (leader && leader !== s.leader && s.comeback[leader] >= s.rules.remontadaGap) {
    pushFx(
      s,
      {
        type: 'remontada',
        team: leader,
        title: 'ريمونتادا!',
        sub: `${s.teams[leader].name} يقلب النتيجة بعد تأخر ${s.comeback[leader]} نقاط`,
        sound: 'remontada',
        delay: delay + 1400,
        value: s.comeback[leader],
      },
      now,
    );
    pushLog(s, { kind: 'info', team: leader, text: `ريمونتادا! ${s.teams[leader].name} يقلب النتيجة` }, now);
  }
  if (leader) {
    s.comeback[leader] = 0;
    s.leader = leader;
  }
}

function grantAbility(s: GameState, team: TeamId, ability: AbilityId): boolean {
  if (!s.rules.abilitiesEnabled) return false;
  const t = s.teams[team];
  if (t.abilities.length >= s.rules.maxAbilities) return false;
  t.abilities.push(ability);
  return true;
}

const CAPTURE_DELAY = 2300;

function capture(s: GameState, cellId: number, team: TeamId, now: number, rng: Rng): void {
  const cell = s.cells[cellId];
  const prev = cell.owner;
  cell.owner = team;
  cell.captures += 1;
  cell.lastCapturedTurn = s.turn;
  cell.shieldUntil = null;
  cell.immuneUntil = null;
  if (prev && prev !== team) {
    if (s.rules.stealImmunity) cell.immuneUntil = s.turn + 1;
    pushFx(s, { type: 'steal', team, cellId, title: 'سرقة!', sub: `${s.teams[team].name} يسرق «${cell.name}»`, sound: 'steal', delay: CAPTURE_DELAY }, now);
    pushLog(s, { kind: 'steal', team, victim: prev, cellId, cellKind: cell.kind, text: `${s.teams[team].name} سرق «${cell.name}» من ${s.teams[prev].name}` }, now);
  } else {
    pushFx(s, { type: 'capture', team, cellId, sound: 'capture', delay: CAPTURE_DELAY }, now);
    pushLog(s, { kind: 'capture', team, cellId, cellKind: cell.kind, text: `${s.teams[team].name} احتل «${cell.name}»` }, now);
  }
  if (cell.kind === 'golden' && !cell.goldenClaimed) {
    cell.goldenClaimed = true;
    const ability = pickOne(ABILITY_IDS, rng)!;
    const granted = grantAbility(s, team, ability);
    pushFx(
      s,
      {
        type: 'golden',
        team,
        cellId,
        icon: granted ? ABILITY_INFO[ability].icon : '⭐',
        title: 'منطقة ذهبية!',
        sub: granted
          ? `${s.teams[team].name} يحصل على قدرة «${ABILITY_INFO[ability].name}»`
          : `+${s.rules.goldenValue} نقاط لـ${s.teams[team].name}`,
        sound: 'golden',
        delay: CAPTURE_DELAY + 900,
      },
      now,
    );
    if (granted) pushLog(s, { kind: 'ability', team, ability, text: `${s.teams[team].name} حصل على قدرة «${ABILITY_INFO[ability].name}» من منطقة ذهبية` }, now);
  }
  if (cell.kind === 'crown') {
    pushFx(s, { type: 'crown-capture', team, cellId, title: 'التاج!', sub: `${s.teams[team].name} يعتلي عرش المملكة`, sound: 'crown', delay: CAPTURE_DELAY + 600 }, now);
  }
}

function finish(s: GameState, winner: TeamId | 'draw', now: number): void {
  s.phase = 'finished';
  s.winner = winner;
  s.finishedAt = now;
  s.current = null;
  s.selectedCell = null;
  s.wheel = null;
  s.wheelPending = null;
  const sc = computeScores(s);
  if (winner === 'draw') {
    pushFx(s, { type: 'draw', title: 'تعادل!', sub: `${sc.red.total} - ${sc.blue.total}`, sound: 'gong' }, now);
    pushLog(s, { kind: 'finish', text: `انتهت المباراة بالتعادل ${sc.red.total} - ${sc.blue.total}` }, now);
  } else {
    pushFx(s, { type: 'winner', team: winner, title: s.teams[winner].name, sub: 'يحتلّ المملكة!', sound: 'winner', delay: 400 }, now);
    pushLog(s, { kind: 'finish', team: winner, text: `فاز ${s.teams[winner].name} ${sc[winner].total} - ${sc[other(winner)].total}` }, now);
  }
}

function endRegulation(s: GameState, now: number): void {
  const sc = computeScores(s);
  const leader = leaderOf(sc);
  s.current = null;
  s.selectedCell = null;
  if (leader) return finish(s, leader, now);
  if (s.rules.tiebreakEnabled) {
    s.phase = 'tiebreak';
    s.turn = totalTurns(s);
    pushFx(s, { type: 'tiebreak', title: 'جولة فاصلة!', sub: 'أول فريق يجيب إجابة صحيحة يفوز بالمملكة', sound: 'gong' }, now);
    pushLog(s, { kind: 'tiebreak', text: `تعادل ${sc.red.total} - ${sc.blue.total} — جولة فاصلة` }, now);
    return;
  }
  finish(s, 'draw', now);
}

// ───────────── الأحداث المفاجئة ─────────────

function neutralNormalCells(s: GameState): Cell[] {
  return s.cells.filter((c) => c.kind === 'normal' && c.owner === null);
}

export function eventAvailable(s: GameState, ev: EventId): boolean {
  if (s.phase === 'finished' || s.phase === 'tiebreak') return false;
  switch (ev) {
    case 'lightning':
      return s.pendingEvent !== 'lightning';
    case 'golden-rush':
      return neutralNormalCells(s).length > 0;
    case 'shields-down':
      return s.cells.some((c) => isShielded(s, c));
    case 'underdog': {
      const t = trailingTeam(s, 2);
      return !!t && s.rules.abilitiesEnabled && s.teams[t].abilities.length < s.rules.maxAbilities;
    }
  }
}

function applyEvent(s: GameState, ev: EventId, now: number, rng: Rng, delay = 0): boolean {
  if (!eventAvailable(s, ev)) return false;
  const info = EVENT_INFO[ev];
  let sub = info.desc;
  let cellId: number | null = null;
  let team: TeamId | null = null;
  switch (ev) {
    case 'lightning':
      s.pendingEvent = 'lightning';
      break;
    case 'golden-rush': {
      const cell = pickOne(neutralNormalCells(s), rng)!;
      cell.kind = 'golden';
      cell.goldenClaimed = false;
      cellId = cell.id;
      sub = `«${cell.name}» أصبحت منطقة ذهبية بقيمة ${s.rules.goldenValue} نقاط`;
      break;
    }
    case 'shields-down':
      for (const c of s.cells) c.shieldUntil = null;
      break;
    case 'underdog': {
      team = trailingTeam(s, 2)!;
      grantAbility(s, team, 'shield');
      sub = `${s.teams[team].name} يحصل على درع لحماية إحدى مناطقه`;
      break;
    }
  }
  s.eventsUsed += 1;
  pushFx(s, { type: 'event', title: info.name, sub, icon: info.icon, cellId, team, sound: 'event', delay: delay || undefined }, now);
  pushLog(s, { kind: 'event', team, text: `حدث مفاجئ: ${info.name} — ${sub}` }, now);
  return true;
}

// ───────────── عجلة الحظ ─────────────

export function wheelAllowed(s: GameState, team: TeamId): WheelPrize[] {
  const canAbility = s.rules.abilitiesEnabled && s.teams[team].abilities.length < s.rules.maxAbilities;
  return WHEEL_SEGMENTS.filter((p) => canAbility || p === 'point' || p === 'none');
}

function applyWheel(s: GameState, now: number): void {
  const w = s.wheel;
  if (!w || w.applied) return;
  w.applied = true;
  const prize = w.segments[w.result];
  const info = WHEEL_INFO[prize];
  let sub = '';
  if (prize === 'point') {
    s.teams[w.team].bonus += 1;
    sub = `+1 نقطة لـ${s.teams[w.team].name}`;
    checkLead(s, now);
  } else if (prize === 'none') {
    sub = 'حظ أوفر المرة القادمة!';
  } else {
    const ok = grantAbility(s, w.team, prize);
    sub = ok ? `${s.teams[w.team].name} يحصل على «${ABILITY_INFO[prize].name}»` : 'الحقيبة ممتلئة';
  }
  pushFx(s, { type: 'wheel-result', team: w.team, title: info.name, icon: info.icon, sub, sound: prize === 'none' ? 'penalty' : 'bonus' }, now);
  pushLog(s, { kind: 'wheel', team: w.team, text: `عجلة الحظ: ${info.name} — ${sub}` }, now);
}

// ───────────── المخفّض الرئيسي ─────────────

export function reduce(state: GameState, action: Action): GameState {
  const s = structuredClone(state);
  s.fx = [];
  const changed = apply(s, action, mulberry32(action.seed));
  if (!changed) return state;
  s.updatedAt = action.now;
  return s;
}

function apply(s: GameState, a: Action, rng: Rng): boolean {
  const now = a.now;
  const c = s.current;
  switch (a.type) {
    case 'SELECT_CELL': {
      if (s.phase !== 'select') return false;
      if (a.cellId === null) {
        if (s.selectedCell === null) return false;
        s.selectedCell = null;
        return true;
      }
      if (s.selectedCell === a.cellId || !targetInfo(s, a.cellId).ok) return false;
      s.selectedCell = a.cellId;
      pushFx(s, { type: 'sfx', sound: 'select', cellId: a.cellId, team: s.activeTeam }, now);
      return true;
    }

    case 'DRAW_QUESTION': {
      const tiebreak = s.phase === 'tiebreak';
      let mode: QuestionMode = 'tiebreak';
      if (tiebreak) {
        if (c) return false;
      } else {
        if (s.phase !== 'select' || s.selectedCell === null) return false;
        const info = targetInfo(s, s.selectedCell);
        if (!info.ok || !info.mode) return false;
        mode = info.mode;
      }
      let duration = s.rules.answerSeconds * 1000;
      let bonus = 0;
      let lightning = false;
      if (!tiebreak && s.pendingEvent === 'lightning') {
        lightning = true;
        duration = Math.max(5000, Math.round(duration / 2000) * 1000);
        bonus += 1;
        s.pendingEvent = null;
      }
      if (mode === 'attack' && isFinalRound(s)) bonus += 1;
      s.current = {
        q: a.question,
        cellId: tiebreak ? null : s.selectedCell,
        team: tiebreak ? null : s.activeTeam,
        answering: tiebreak ? null : s.activeTeam,
        mode,
        difficulty: a.difficulty,
        timer: newTimer(duration, s.rules.autoStartTimer ? now : null),
        revealed: false,
        hiddenOptions: [],
        wrongPicks: [],
        picked: null,
        result: null,
        resultTeam: null,
        rebound: false,
        secondChance: 'none',
        lightning,
        bonusOnCorrect: bonus,
        shownAt: now,
        judgedAt: null,
        replaced: 0,
      };
      if (!s.usedQuestionIds.includes(a.question.id)) s.usedQuestionIds.push(a.question.id);
      if (!tiebreak) s.phase = 'question';
      pushFx(s, { type: 'question', sound: 'question', cellId: s.current.cellId, team: s.current.team }, now);
      return true;
    }

    case 'REPLACE_QUESTION': {
      if (!c || c.result) return false;
      c.q = a.question;
      c.difficulty = a.difficulty;
      c.timer = newTimer(c.timer.durationMs, s.rules.autoStartTimer ? now : null);
      c.hiddenOptions = [];
      c.wrongPicks = [];
      c.picked = null;
      c.revealed = false;
      c.replaced += 1;
      c.shownAt = now;
      if (!s.usedQuestionIds.includes(a.question.id)) s.usedQuestionIds.push(a.question.id);
      pushFx(s, { type: 'question', sound: 'whoosh', cellId: c.cellId, team: c.team }, now);
      return true;
    }

    case 'CANCEL_QUESTION': {
      if (!c || c.result) return false;
      s.current = null;
      if (s.phase === 'question') s.phase = 'select';
      pushLog(s, { kind: 'info', text: 'أُلغي السؤال الحالي' }, now);
      return true;
    }

    case 'TIMER_START': {
      if (!c || c.result || c.timer.startedAt !== null) return false;
      if (timerRemaining(c.timer, now) <= 0) return false;
      c.timer.startedAt = now;
      c.timer.expired = false;
      return true;
    }

    case 'TIMER_PAUSE': {
      if (!c || c.timer.startedAt === null) return false;
      pauseTimerInPlace(c.timer, now);
      return true;
    }

    case 'TIMER_RESET': {
      if (!c || c.result) return false;
      c.timer = newTimer(c.timer.durationMs, null);
      return true;
    }

    case 'TIMER_ADD': {
      if (!c || c.result || a.ms === 0) return false;
      c.timer.durationMs = Math.max(1000, c.timer.durationMs + a.ms);
      if (c.timer.expired && timerRemaining(c.timer, now) > 0) c.timer.expired = false;
      return true;
    }

    case 'TIMER_EXPIRE': {
      if (!c || c.result || c.q.id !== a.qid || c.timer.expired) return false;
      if (timerRemaining(c.timer, now) > 300) return false;
      c.timer.elapsedMs = c.timer.durationMs;
      c.timer.startedAt = null;
      c.timer.expired = true;
      pushFx(s, { type: 'timeout', sound: 'timeout', team: c.answering, title: 'انتهى الوقت!' }, now);
      return true;
    }

    case 'PICK_OPTION': {
      if (!c || c.result || c.q.type !== 'mcq') return false;
      if (a.index !== null) {
        if (a.index < 0 || a.index >= c.q.options.length) return false;
        if (c.hiddenOptions.includes(a.index) || c.wrongPicks.includes(a.index)) return false;
      }
      if (c.picked === a.index) return false;
      c.picked = a.index;
      if (a.index !== null) pushFx(s, { type: 'lockin', sound: 'lockin', team: c.answering }, now);
      return true;
    }

    case 'JUDGE': {
      if (!c || c.result || c.mode === 'tiebreak' || s.phase !== 'question') return false;
      const team = c.answering!;
      const elapsed = c.timer.expired ? c.timer.durationMs : c.timer.durationMs - timerRemaining(c.timer, now);
      const timedOut = c.timer.expired;
      pauseTimerInPlace(c.timer, now);
      pushLog(
        s,
        {
          kind: 'answer',
          team,
          correct: a.correct,
          mode: c.mode,
          category: c.q.category,
          difficulty: c.difficulty,
          ms: Math.round(elapsed),
          cellId: c.cellId,
          rebound: c.rebound,
          timedOut,
          text: a.correct
            ? `${teamName(s, team)} أجاب إجابة صحيحة`
            : timedOut
              ? `انتهى وقت ${teamName(s, team)}`
              : `${teamName(s, team)} أخطأ في الإجابة`,
        },
        now,
      );
      if (a.correct) {
        c.result = 'correct';
        c.resultTeam = team;
        c.judgedAt = now;
        if (c.q.type === 'mcq' && c.picked === null) c.picked = c.q.correct;
        if (s.rules.autoReveal) c.revealed = true;
        s.phase = 'result';
        pushFx(s, { type: 'correct', sound: 'correct', team, cellId: c.cellId, title: 'إجابة صحيحة!' }, now);
        if (c.cellId !== null) capture(s, c.cellId, team, now, rng);
        if (c.bonusOnCorrect > 0) {
          s.teams[team].bonus += c.bonusOnCorrect;
          pushFx(s, { type: 'bonus', team, value: c.bonusOnCorrect, title: `+${c.bonusOnCorrect}`, sub: c.lightning ? 'مكافأة سؤال البرق' : 'مكافأة السرقة في الجولة النهائية', sound: 'bonus', delay: CAPTURE_DELAY + 500 }, now);
          pushLog(s, { kind: 'adjust', team, delta: c.bonusOnCorrect, text: `+${c.bonusOnCorrect} نقطة مكافأة لـ${teamName(s, team)}` }, now);
        }
        checkLead(s, now, CAPTURE_DELAY);
        return true;
      }
      // إجابة خاطئة
      if (c.picked !== null && c.picked !== c.q.correct && !c.wrongPicks.includes(c.picked)) c.wrongPicks.push(c.picked);
      if (c.secondChance === 'armed' && !c.rebound) {
        c.secondChance = 'used';
        const remaining = timerRemaining(c.timer, now);
        c.timer = newTimer(Math.max(remaining, Math.round(c.timer.durationMs / 2)), s.rules.autoStartTimer ? now : null);
        c.picked = null;
        pushFx(s, { type: 'second-chance', team, title: 'فرصة ثانية!', sub: `${teamName(s, team)} يحاول مرة أخرى`, icon: ABILITY_INFO.second.icon, sound: 'ability' }, now);
        return true;
      }
      if (s.rules.reboundEnabled && c.mode === 'claim' && !c.rebound && c.team) {
        c.rebound = true;
        c.answering = other(c.team);
        c.timer = newTimer(s.rules.reboundSeconds * 1000, s.rules.autoStartTimer ? now : null);
        c.picked = null;
        pushFx(s, { type: 'rebound', team: c.answering, title: 'فرصة الرد!', sub: `${teamName(s, c.answering)} يستطيع الإجابة والاستيلاء على المنطقة`, sound: 'wrong' }, now);
        return true;
      }
      c.result = 'wrong';
      c.resultTeam = null;
      c.judgedAt = now;
      if (s.rules.autoReveal) c.revealed = true;
      s.phase = 'result';
      pushFx(s, { type: 'wrong', sound: 'wrong', team, cellId: c.cellId, title: timedOut ? 'انتهى الوقت' : 'إجابة خاطئة' }, now);
      return true;
    }

    case 'REVEAL': {
      if (!c || c.revealed === a.value) return false;
      c.revealed = a.value;
      if (a.value) pushFx(s, { type: 'reveal', sound: 'reveal' }, now);
      return true;
    }

    case 'NEXT_TURN': {
      if (s.phase !== 'result' && s.phase !== 'select') return false;
      if (s.wheel && !s.wheel.applied) return false;
      const skipped = s.phase === 'select';
      const sc = computeScores(s);
      if (skipped) pushLog(s, { kind: 'info', team: s.activeTeam, text: `تخطّى ${teamName(s, s.activeTeam)} دوره` }, now);
      s.turn += 1;
      s.timeline.push({ turn: s.turn, red: sc.red.total, blue: sc.blue.total });
      s.current = null;
      s.selectedCell = null;
      s.wheel = null;
      if (s.turn >= totalTurns(s)) {
        endRegulation(s, now);
        return true;
      }
      s.phase = 'select';
      s.activeTeam = teamForTurn(s, s.turn);
      const round = roundOf(s.turn);
      const roundStart = s.turn % 2 === 0;
      // كل إعلان كبير يُعرض بعد السابق حتى لا تتداخل الإعلانات على شاشة الجمهور
      let delay = 300;
      let announced = false;
      if (roundStart) {
        if (s.rules.crownEnabled && !s.crownActive && round > s.rules.rounds - s.rules.crownRounds) {
          s.crownActive = true;
          announced = true;
          pushFx(s, { type: 'crown-appears', title: 'منطقة التاج ظهرت!', sub: `«${s.cells.find((x) => x.kind === 'crown')?.name ?? 'التاج'}» تساوي ${s.rules.crownValue} نقاط`, sound: 'crown', delay }, now);
          pushLog(s, { kind: 'info', text: 'ظهرت منطقة التاج' }, now);
          delay += 3800;
        }
        if (s.rules.finalRoundEnabled && s.rules.rounds > 1 && round === s.rules.rounds) {
          let broke = 0;
          for (const cell of s.cells) {
            if (cell.shieldUntil !== null) broke++;
            cell.shieldUntil = null;
            cell.immuneUntil = null;
          }
          announced = true;
          pushFx(s, { type: 'final-round', title: 'الجولة النهائية الحاسمة', sub: `تسقط كل الدروع${broke ? ` (${broke})` : ''}، وكل سرقة ناجحة تمنح نقطة إضافية`, sound: 'gong', delay }, now);
          pushLog(s, { kind: 'info', text: 'بدأت الجولة النهائية الحاسمة' }, now);
          delay += 3800;
        }
        if (s.rules.wheelEvery > 0 && round > 1 && (round - 1) % s.rules.wheelEvery === 0 && round < s.rules.rounds) {
          s.wheelPending = trailingTeam(s) ?? s.activeTeam;
        }
      }
      if (s.eventTurns.includes(s.turn) && s.eventsUsed < s.rules.eventsCount) {
        const available = EVENT_IDS.filter((e) => eventAvailable(s, e));
        const ev = pickOne(available, rng);
        if (ev) {
          applyEvent(s, ev, now, rng, announced ? delay : 0);
          announced = true;
        }
      }
      if (!announced) {
        pushFx(s, { type: 'turn', team: s.activeTeam, title: `دور ${teamName(s, s.activeTeam)}`, sub: `الجولة ${round} من ${s.rules.rounds}` }, now);
      }
      if (!hasTargets(s)) {
        pushLog(s, { kind: 'info', team: s.activeTeam, text: `لا توجد مناطق متاحة لـ${teamName(s, s.activeTeam)}` }, now);
      }
      return true;
    }

    case 'USE_ABILITY': {
      if (s.phase === 'finished') return false;
      const t = s.teams[a.team];
      const idx = t.abilities.indexOf(a.ability);
      if (idx < 0) return false;
      const info = ABILITY_INFO[a.ability];
      let sub = '';
      let cellId: number | null = null;
      switch (a.ability) {
        case 'shield': {
          if (a.cellId === undefined || isFinalRound(s)) return false;
          const cell = s.cells[a.cellId];
          if (!cell || cell.owner !== a.team || isShielded(s, cell)) return false;
          cell.shieldUntil = s.turn + s.rules.shieldTurns;
          cellId = cell.id;
          sub = `«${cell.name}» محمية لـ${Math.ceil(s.rules.shieldTurns / 2)} جولات`;
          break;
        }
        case 'time': {
          if (!c || c.result || c.answering !== a.team) return false;
          c.timer.durationMs += s.rules.extraTimeSeconds * 1000;
          if (c.timer.expired) c.timer.expired = false;
          sub = `+${s.rules.extraTimeSeconds} ثوانٍ`;
          break;
        }
        case 'fifty': {
          if (!c || c.result || c.answering !== a.team || c.q.type !== 'mcq' || c.hiddenOptions.length > 0) return false;
          const wrong = c.q.options.map((_, i) => i).filter((i) => i !== c.q.correct && !c.wrongPicks.includes(i));
          if (wrong.length < 1) return false;
          c.hiddenOptions = shuffle(wrong, rng).slice(0, Math.min(2, wrong.length));
          if (c.picked !== null && c.hiddenOptions.includes(c.picked)) c.picked = null;
          sub = 'حُذف خياران خاطئان';
          break;
        }
        case 'second': {
          if (!c || c.result || c.answering !== a.team || c.rebound || c.secondChance !== 'none') return false;
          c.secondChance = 'armed';
          sub = 'محاولة إضافية عند الخطأ';
          break;
        }
      }
      t.abilities.splice(idx, 1);
      pushFx(s, { type: 'ability', team: a.team, cellId, icon: info.icon, title: info.name, sub: `${t.name}: ${sub}`, sound: a.ability === 'shield' ? 'shield' : 'ability' }, now);
      pushLog(s, { kind: 'ability', team: a.team, ability: a.ability, cellId, text: `${t.name} استخدم «${info.name}» — ${sub}` }, now);
      return true;
    }

    case 'ADJUST_BONUS': {
      if (!a.delta) return false;
      s.teams[a.team].bonus += a.delta;
      pushFx(s, { type: a.delta > 0 ? 'bonus' : 'penalty', team: a.team, value: a.delta, title: a.delta > 0 ? `+${a.delta}` : `${a.delta}`, sub: a.reason, sound: a.delta > 0 ? 'bonus' : 'penalty' }, now);
      pushLog(s, { kind: 'adjust', team: a.team, delta: a.delta, text: `${a.delta > 0 ? 'منح' : 'خصم'} ${Math.abs(a.delta)} نقطة ${a.delta > 0 ? 'لـ' : 'من '}${s.teams[a.team].name}${a.reason ? ` (${a.reason})` : ''}` }, now);
      checkLead(s, now);
      return true;
    }

    case 'SET_OWNER': {
      const cell = s.cells[a.cellId];
      if (!cell || cell.owner === a.owner) return false;
      cell.owner = a.owner;
      cell.shieldUntil = null;
      cell.immuneUntil = null;
      if (a.owner) {
        cell.captures += 1;
        cell.lastCapturedTurn = s.turn;
      }
      pushLog(s, { kind: 'manual', team: a.owner, cellId: cell.id, text: `تعديل يدوي: «${cell.name}» ← ${a.owner ? s.teams[a.owner].name : 'محايدة'}` }, now);
      checkLead(s, now);
      return true;
    }

    case 'TOGGLE_SHIELD': {
      const cell = s.cells[a.cellId];
      if (!cell || !cell.owner) return false;
      if (isShielded(s, cell)) cell.shieldUntil = null;
      else cell.shieldUntil = s.turn + s.rules.shieldTurns;
      pushFx(s, { type: 'sfx', sound: 'shield', cellId: cell.id }, now);
      pushLog(s, { kind: 'manual', cellId: cell.id, text: `تعديل يدوي: ${cell.shieldUntil !== null ? 'إضافة' : 'إزالة'} درع «${cell.name}»` }, now);
      return true;
    }

    case 'SET_CELL_KIND': {
      const cell = s.cells[a.cellId];
      if (!cell || cell.kind === 'crown' || cell.kind === a.kind) return false;
      cell.kind = a.kind;
      if (a.kind === 'golden') cell.goldenClaimed = cell.owner !== null;
      pushLog(s, { kind: 'manual', cellId: cell.id, text: `تعديل يدوي: «${cell.name}» أصبحت ${a.kind === 'golden' ? 'ذهبية' : 'عادية'}` }, now);
      checkLead(s, now);
      return true;
    }

    case 'SET_ACTIVE_TEAM': {
      if (s.phase !== 'select' || s.activeTeam === a.team) return false;
      s.activeTeam = a.team;
      s.selectedCell = null;
      pushLog(s, { kind: 'manual', team: a.team, text: `تعديل يدوي: الدور الآن لـ${s.teams[a.team].name}` }, now);
      pushFx(s, { type: 'turn', team: a.team, title: `دور ${s.teams[a.team].name}` }, now);
      return true;
    }

    case 'TRIGGER_EVENT':
      return applyEvent(s, a.event, now, rng);

    case 'SPIN_WHEEL': {
      if (s.phase === 'finished' || (s.wheel && !s.wheel.applied)) return false;
      const allowed = wheelAllowed(s, a.team);
      const prize = pickOne(allowed, rng)!;
      s.wheel = {
        id: nextId(s),
        team: a.team,
        segments: WHEEL_SEGMENTS.slice(),
        result: WHEEL_SEGMENTS.indexOf(prize),
        startedAt: now,
        durationMs: 6500,
        applied: false,
      };
      s.wheelPending = null;
      pushFx(s, { type: 'wheel', team: a.team, title: 'عجلة الحظ', sub: `${s.teams[a.team].name} يدير العجلة` }, now);
      return true;
    }

    case 'WHEEL_APPLY': {
      if (!s.wheel || s.wheel.applied) return false;
      applyWheel(s, now);
      return true;
    }

    case 'WHEEL_CLOSE': {
      if (!s.wheel) return false;
      applyWheel(s, now);
      s.wheel = null;
      return true;
    }

    case 'TIEBREAK_RESULT': {
      if (s.phase !== 'tiebreak') return false;
      if (c && c.timer.startedAt !== null) pauseTimerInPlace(c.timer, now);
      if (a.winner) {
        s.teams[a.winner].bonus += 1;
        pushLog(s, { kind: 'tiebreak', team: a.winner, correct: true, category: c?.q.category, difficulty: c?.difficulty, text: `${s.teams[a.winner].name} حسم الجولة الفاصلة (+1)` }, now);
        finish(s, a.winner, now);
        return true;
      }
      s.tiebreakCount += 1;
      s.current = null;
      pushFx(s, { type: 'announce', title: 'لا أحد!', sub: 'سؤال فاصل جديد', sound: 'wrong' }, now);
      pushLog(s, { kind: 'tiebreak', text: 'لم يُحسم السؤال الفاصل' }, now);
      return true;
    }

    case 'FINISH': {
      if (s.phase === 'finished') return false;
      if (a.draw) {
        finish(s, 'draw', now);
        return true;
      }
      const leader = leaderOf(computeScores(s));
      if (leader) finish(s, leader, now);
      else if (s.rules.tiebreakEnabled && s.phase !== 'tiebreak') endRegulation(s, now);
      else finish(s, 'draw', now);
      return true;
    }

    case 'ANNOUNCE': {
      if (!a.title.trim()) return false;
      pushFx(s, { type: 'announce', title: a.title.trim(), sub: a.sub?.trim() || undefined, icon: a.icon, sound: a.sound ?? 'whoosh' }, now);
      return true;
    }

    case 'SFX':
      pushFx(s, { type: 'sfx', sound: a.sound }, now);
      return true;

    case 'SET_VIEW':
      if (s.audienceView === a.view) return false;
      s.audienceView = a.view;
      return true;

    case 'UPDATE_RULES': {
      const next = sanitizeRules({ ...s.rules, ...a.rules });
      next.rounds = Math.max(next.rounds, roundOf(Math.min(s.turn, totalTurns(s) - 1)));
      next.crownEnabled = s.rules.crownEnabled;
      s.rules = next;
      if (s.rules.crownEnabled && !s.crownActive && roundOf(s.turn) > s.rules.rounds - s.rules.crownRounds) {
        s.crownActive = true;
        pushFx(s, { type: 'crown-appears', title: 'منطقة التاج ظهرت!', sub: `تساوي ${s.rules.crownValue} نقاط`, sound: 'crown' }, now);
      }
      return true;
    }

    case 'RENAME_TEAM': {
      const t = s.teams[a.team];
      if (a.name !== undefined && a.name.trim()) t.name = a.name.trim();
      if (a.emblem !== undefined && a.emblem) t.emblem = a.emblem;
      return true;
    }
  }
}

/** يُستدعى عند التراجع: يوقف أي مؤقت كان يعمل حتى لا يُستعاد سؤال بوقت منتهٍ */
export function freezeTimers(s: GameState, now: number): GameState {
  if (s.current && s.current.timer.startedAt !== null) {
    const copy = structuredClone(s);
    pauseTimerInPlace(copy.current!.timer, now);
    return copy;
  }
  return s;
}
