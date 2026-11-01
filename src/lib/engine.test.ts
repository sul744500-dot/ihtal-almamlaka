import { describe, expect, it } from 'vitest';
import { CENTER_CELL } from './board';
import {
  createMatch,
  eventAvailable,
  isShielded,
  reduce,
  roundOf,
  targetInfo,
  totalTurns,
  type ActionBody,
} from './engine';
import { commit, isUndoable, undo } from './history';
import { DEFAULT_RULES } from './rules';
import { computeScores } from './scoring';
import { timerRemaining } from './timer';
import type { GameState, MatchRecord, Question, Rules, TeamId } from './types';

let clock = 1_000_000;
const tick = (ms = 1000) => (clock += ms);

const Q = (id = 'q1', correct = 0): Question => ({
  id,
  category: 'general',
  difficulty: 'easy',
  type: 'mcq',
  text: 'سؤال تجريبي',
  options: ['أ', 'ب', 'ج', 'د'],
  correct,
  answer: ['أ', 'ب', 'ج', 'د'][correct],
});

function act(s: GameState, body: ActionBody, seed = 42): GameState {
  return reduce(s, { ...body, now: tick(), seed } as never);
}

function newGame(rules: Partial<Rules> = {}, seed = 7, starting: TeamId = 'red'): GameState {
  return createMatch({
    id: 'm1',
    title: 'اختبار',
    now: tick(),
    seed,
    teams: { red: { name: 'الصقور', emblem: '🦅' }, blue: { name: 'الذئاب', emblem: '🐺' } },
    rules: { eventsCount: 0, wheelEvery: 0, ...rules },
    categories: ['general'],
    difficultyMode: 'progressive',
    startingTeam: starting,
  });
}

let qn = 0;
/** يلعب دورًا كاملًا: اختيار منطقة ← سؤال ← حكم ← الدور التالي */
function play(s: GameState, cellId: number, correct: boolean, next = true): GameState {
  s = act(s, { type: 'SELECT_CELL', cellId });
  expect(s.selectedCell).toBe(cellId);
  s = act(s, { type: 'DRAW_QUESTION', question: Q(`q${++qn}`), difficulty: 'easy' });
  expect(s.phase).toBe('question');
  s = act(s, { type: 'TIMER_START' });
  s = act(s, { type: 'JUDGE', correct });
  expect(s.phase).toBe('result');
  return next ? act(s, { type: 'NEXT_TURN' }) : s;
}

const firstNormal = (s: GameState, skip: number[] = []) =>
  s.cells.find((c) => c.kind === 'normal' && c.owner === null && !skip.includes(c.id))!.id;

describe('إنشاء المباراة', () => {
  it('ينشئ لوحة 5×5 بمنطقة تاج مقفلة ومناطق ذهبية', () => {
    const s = newGame();
    expect(s.cells).toHaveLength(25);
    expect(s.cells[CENTER_CELL].kind).toBe('crown');
    expect(s.crownActive).toBe(false);
    expect(s.cells.filter((c) => c.kind === 'golden')).toHaveLength(DEFAULT_RULES.goldenCount);
    expect(s.cells.every((c) => c.owner === null)).toBe(true);
    expect(s.cells.filter((c) => c.kind !== 'crown').every((c) => c.category === 'general')).toBe(true);
    expect(targetInfo(s, CENTER_CELL).ok).toBe(false);
  });

  it('النتيجة نفسها لنفس البذرة', () => {
    const a = newGame({}, 99);
    const b = newGame({}, 99);
    expect(a.cells.map((c) => c.kind)).toEqual(b.cells.map((c) => c.kind));
  });

  it('عدد الأدوار متساوٍ بين الفريقين', () => {
    let s = newGame({ rounds: 6 });
    const turns: Record<TeamId, number> = { red: 0, blue: 0 };
    while (s.phase !== 'finished' && s.phase !== 'tiebreak') {
      turns[s.activeTeam]++;
      s = act(s, { type: 'NEXT_TURN' });
    }
    expect(turns.red).toBe(6);
    expect(turns.blue).toBe(6);
  });
});

describe('الاحتلال والنقاط', () => {
  it('الإجابة الصحيحة تحتل المنطقة وتنقل الدور', () => {
    let s = newGame();
    const id = firstNormal(s);
    s = play(s, id, true);
    expect(s.cells[id].owner).toBe('red');
    expect(computeScores(s).red.total).toBe(1);
    expect(s.activeTeam).toBe('blue');
    expect(s.turn).toBe(1);
    expect(s.log.some((l) => l.kind === 'capture' && l.team === 'red')).toBe(true);
  });

  it('الإجابة الخاطئة لا تغيّر الملكية', () => {
    let s = newGame();
    const id = firstNormal(s);
    s = play(s, id, false);
    expect(s.cells[id].owner).toBeNull();
    expect(computeScores(s).red.total).toBe(0);
  });

  it('لا يمكن اختيار منطقة يملكها الفريق نفسه', () => {
    let s = newGame();
    const id = firstNormal(s);
    s = play(s, id, true); // الأحمر
    s = act(s, { type: 'NEXT_TURN' }); // تخطي الأزرق
    expect(s.activeTeam).toBe('red');
    expect(targetInfo(s, id).ok).toBe(false);
    const same = act(s, { type: 'SELECT_CELL', cellId: id });
    expect(same).toBe(s);
  });

  it('المنطقة الذهبية بنقطتين وتمنح قدرة مرة واحدة فقط', () => {
    let s = newGame();
    const g = s.cells.find((c) => c.kind === 'golden')!.id;
    s = play(s, g, true);
    expect(computeScores(s).red.total).toBe(2);
    expect(s.teams.red.abilities).toHaveLength(1);
    expect(s.cells[g].goldenClaimed).toBe(true);
    // الأزرق يسرقها: نقطتان له ولا قدرة جديدة
    s = play(s, g, true);
    expect(s.cells[g].owner).toBe('blue');
    expect(computeScores(s).blue.total).toBe(2);
    expect(computeScores(s).red.total).toBe(0);
    expect(s.teams.blue.abilities).toHaveLength(0);
  });

  it('النقاط مشتقة دائمًا من اللوحة + المكافآت', () => {
    let s = newGame();
    s = act(s, { type: 'ADJUST_BONUS', team: 'blue', delta: 3, reason: 'اختبار' });
    s = act(s, { type: 'ADJUST_BONUS', team: 'blue', delta: -1 });
    expect(computeScores(s).blue.total).toBe(2);
    s = act(s, { type: 'SET_OWNER', cellId: 0, owner: 'blue' });
    expect(computeScores(s).blue.total).toBe(2 + (s.cells[0].kind === 'golden' ? 2 : 1));
  });
});

describe('السرقة والحماية', () => {
  it('سرقة منطقة الخصم تنقل نقطتها، ولا تُسترجع في الدور التالي مباشرة', () => {
    let s = newGame();
    const id = firstNormal(s);
    s = play(s, id, true); // الأحمر يحتل
    expect(targetInfo(s, id).mode).toBe('attack');
    s = play(s, id, true); // الأزرق يسرق
    expect(s.cells[id].owner).toBe('blue');
    expect(s.log.some((l) => l.kind === 'steal' && l.team === 'blue' && l.victim === 'red')).toBe(true);
    // دور الأحمر مباشرة: محمية بالحصانة
    expect(s.activeTeam).toBe('red');
    const info = targetInfo(s, id);
    expect(info.ok).toBe(false);
    expect(info.reason).toContain('سُرقت');
    s = act(s, { type: 'NEXT_TURN' }); // الأحمر يتخطى
    s = act(s, { type: 'NEXT_TURN' }); // الأزرق يتخطى
    expect(targetInfo(s, id).ok).toBe(true);
  });

  it('السرقة المعطلة تمنع الهجوم', () => {
    let s = newGame({ stealEnabled: false });
    const id = firstNormal(s);
    s = play(s, id, true);
    expect(targetInfo(s, id).ok).toBe(false);
  });

  it('الدرع يحمي المنطقة ثم ينتهي', () => {
    let s = newGame({ shieldTurns: 4 });
    const g = s.cells.find((c) => c.kind === 'golden')!.id;
    s = play(s, g, true);
    // نضمن وجود درع للاختبار
    s.teams.red.abilities = ['shield'];
    s = act(s, { type: 'USE_ABILITY', team: 'red', ability: 'shield', cellId: g });
    expect(s.teams.red.abilities).toHaveLength(0);
    expect(isShielded(s, s.cells[g])).toBe(true);
    expect(targetInfo(s, g).ok).toBe(false);
    expect(targetInfo(s, g).reason).toContain('درع');
    // الدرع فُعّل في الدور 1، ويبقى حتى الدور 5
    for (let i = 0; i < 4; i++) s = act(s, { type: 'NEXT_TURN' });
    expect(s.turn).toBe(5);
    expect(isShielded(s, s.cells[g])).toBe(true);
    s = act(s, { type: 'NEXT_TURN' });
    s = act(s, { type: 'NEXT_TURN' });
    expect(s.activeTeam).toBe('blue');
    expect(isShielded(s, s.cells[g])).toBe(false);
    expect(targetInfo(s, g).ok).toBe(true);
  });

  it('لا يمكن وضع درع على منطقة لا يملكها الفريق', () => {
    let s = newGame();
    s.teams.red.abilities = ['shield'];
    const after = act(s, { type: 'USE_ABILITY', team: 'red', ability: 'shield', cellId: 0 });
    expect(after).toBe(s);
  });
});

describe('منطقة التاج والجولة النهائية', () => {
  it('التاج يظهر في آخر الجولات ويساوي 3 نقاط', () => {
    let s = newGame({ rounds: 4, crownRounds: 1 });
    while (roundOf(s.turn) < 4) s = act(s, { type: 'NEXT_TURN' });
    expect(s.crownActive).toBe(true);
    expect(s.fx.some((f) => f.type === 'crown-appears')).toBe(true);
    s = play(s, CENTER_CELL, true, false);
    expect(computeScores(s)[s.activeTeam].total).toBe(3);
  });

  it('الجولة النهائية تُسقط الدروع وتمنح نقطة إضافية للسرقة', () => {
    let s = newGame({ rounds: 3, crownEnabled: false, stealImmunity: false });
    const id = firstNormal(s);
    s = play(s, id, true); // الأحمر يحتل (الجولة 1)
    s.cells[id].shieldUntil = 99;
    while (roundOf(s.turn) < 3) s = act(s, { type: 'NEXT_TURN' });
    expect(s.fx.some((f) => f.type === 'final-round')).toBe(true);
    expect(s.cells[id].shieldUntil).toBeNull();
    // الأحمر يبدأ الجولة الأخيرة، نتخطاه ليهاجم الأزرق
    s = act(s, { type: 'NEXT_TURN' });
    expect(s.activeTeam).toBe('blue');
    s = play(s, id, true, false);
    expect(s.cells[id].owner).toBe('blue');
    expect(computeScores(s).blue.total).toBe(2); // منطقة + مكافأة
  });
});

describe('نهاية المباراة', () => {
  it('الفريق الأعلى نقاطًا يفوز', () => {
    let s = newGame({ rounds: 1, crownEnabled: false });
    s = play(s, firstNormal(s), true);
    s = act(s, { type: 'NEXT_TURN' });
    expect(s.phase).toBe('finished');
    expect(s.winner).toBe('red');
    expect(s.fx.some((f) => f.type === 'winner')).toBe(true);
  });

  it('التعادل يؤدي إلى جولة فاصلة تحسمها أول إجابة صحيحة', () => {
    let s = newGame({ rounds: 1, crownEnabled: false });
    s = act(s, { type: 'NEXT_TURN' });
    s = act(s, { type: 'NEXT_TURN' });
    expect(s.phase).toBe('tiebreak');
    s = act(s, { type: 'DRAW_QUESTION', question: Q('tb1'), difficulty: 'medium' });
    expect(s.current?.mode).toBe('tiebreak');
    s = act(s, { type: 'TIEBREAK_RESULT', winner: null });
    expect(s.phase).toBe('tiebreak');
    expect(s.current).toBeNull();
    s = act(s, { type: 'DRAW_QUESTION', question: Q('tb2'), difficulty: 'medium' });
    s = act(s, { type: 'TIEBREAK_RESULT', winner: 'blue' });
    expect(s.phase).toBe('finished');
    expect(s.winner).toBe('blue');
    expect(computeScores(s).blue.total).toBe(1);
  });

  it('بدون جولة فاصلة تنتهي بالتعادل', () => {
    let s = newGame({ rounds: 1, crownEnabled: false, tiebreakEnabled: false });
    s = act(s, { type: 'NEXT_TURN' });
    s = act(s, { type: 'NEXT_TURN' });
    expect(s.winner).toBe('draw');
  });

  it('عدد الأدوار الكلي = الجولات × 2', () => {
    const s = newGame({ rounds: 20 });
    expect(totalTurns(s)).toBe(40);
  });
});

describe('المؤقت', () => {
  it('تشغيل وإيقاف وانتهاء الوقت', () => {
    let s = newGame({ answerSeconds: 15 });
    s = act(s, { type: 'SELECT_CELL', cellId: firstNormal(s) });
    s = act(s, { type: 'DRAW_QUESTION', question: Q(), difficulty: 'easy' });
    expect(s.current!.timer.startedAt).toBeNull();
    s = act(s, { type: 'TIMER_START' });
    const started = s.current!.timer.startedAt!;
    expect(timerRemaining(s.current!.timer, started + 5000)).toBe(10000);
    s = reduce(s, { type: 'TIMER_PAUSE', now: started + 5000, seed: 1 });
    expect(timerRemaining(s.current!.timer, started + 60000)).toBe(10000);
    s = reduce(s, { type: 'TIMER_START', now: started + 6000, seed: 1 });
    // انتهاء مبكر مرفوض
    const early = reduce(s, { type: 'TIMER_EXPIRE', qid: 'q1', now: started + 7000, seed: 1 });
    expect(early).toBe(s);
    s = reduce(s, { type: 'TIMER_EXPIRE', qid: 'q1', now: started + 16000, seed: 1 });
    expect(s.current!.timer.expired).toBe(true);
    expect(s.fx.some((f) => f.type === 'timeout')).toBe(true);
    s = reduce(s, { type: 'TIMER_ADD', ms: 5000, now: started + 17000, seed: 1 });
    expect(s.current!.timer.expired).toBe(false);
    expect(timerRemaining(s.current!.timer, started + 17000)).toBe(5000);
  });

  it('سؤال البرق بنصف الوقت ومكافأة نقطة', () => {
    let s = newGame({ answerSeconds: 15 });
    expect(eventAvailable(s, 'lightning')).toBe(true);
    s = act(s, { type: 'TRIGGER_EVENT', event: 'lightning' });
    expect(s.eventsUsed).toBe(1);
    const id = firstNormal(s);
    s = act(s, { type: 'SELECT_CELL', cellId: id });
    s = act(s, { type: 'DRAW_QUESTION', question: Q(), difficulty: 'easy' });
    expect(s.current!.timer.durationMs).toBe(8000);
    expect(s.current!.lightning).toBe(true);
    s = act(s, { type: 'JUDGE', correct: true });
    expect(computeScores(s).red.total).toBe(1 + 1);
  });
});

describe('القدرات والقواعد الإضافية', () => {
  it('الفرصة الثانية تمنح محاولة إضافية', () => {
    let s = newGame();
    s.teams.red.abilities = ['second'];
    s = act(s, { type: 'SELECT_CELL', cellId: firstNormal(s) });
    s = act(s, { type: 'DRAW_QUESTION', question: Q(), difficulty: 'easy' });
    s = act(s, { type: 'USE_ABILITY', team: 'red', ability: 'second' });
    s = act(s, { type: 'PICK_OPTION', index: 1 });
    s = act(s, { type: 'JUDGE', correct: false });
    expect(s.phase).toBe('question');
    expect(s.current!.secondChance).toBe('used');
    expect(s.current!.wrongPicks).toContain(1);
    s = act(s, { type: 'JUDGE', correct: true });
    expect(s.phase).toBe('result');
  });

  it('حذف إجابتين يخفي خيارين خاطئين فقط', () => {
    let s = newGame();
    s.teams.red.abilities = ['fifty'];
    s = act(s, { type: 'SELECT_CELL', cellId: firstNormal(s) });
    s = act(s, { type: 'DRAW_QUESTION', question: Q('q', 2), difficulty: 'easy' });
    s = act(s, { type: 'USE_ABILITY', team: 'red', ability: 'fifty' });
    expect(s.current!.hiddenOptions).toHaveLength(2);
    expect(s.current!.hiddenOptions).not.toContain(2);
  });

  it('الوقت الإضافي يزيد المؤقت للفريق صاحب الدور فقط', () => {
    let s = newGame({ extraTimeSeconds: 10 });
    s.teams.blue.abilities = ['time'];
    s = act(s, { type: 'SELECT_CELL', cellId: firstNormal(s) });
    s = act(s, { type: 'DRAW_QUESTION', question: Q(), difficulty: 'easy' });
    const blocked = act(s, { type: 'USE_ABILITY', team: 'blue', ability: 'time' });
    expect(blocked).toBe(s);
  });

  it('فرصة الرد تنقل السؤال للخصم عند الخطأ', () => {
    let s = newGame({ reboundEnabled: true, reboundSeconds: 8 });
    const id = firstNormal(s);
    s = act(s, { type: 'SELECT_CELL', cellId: id });
    s = act(s, { type: 'DRAW_QUESTION', question: Q(), difficulty: 'easy' });
    s = act(s, { type: 'JUDGE', correct: false });
    expect(s.current!.rebound).toBe(true);
    expect(s.current!.answering).toBe('blue');
    expect(s.current!.timer.durationMs).toBe(8000);
    s = act(s, { type: 'JUDGE', correct: true });
    expect(s.cells[id].owner).toBe('blue');
  });

  it('عجلة الحظ تمنح الجائزة بعد التطبيق فقط', () => {
    let s = newGame();
    s = act(s, { type: 'SPIN_WHEEL', team: 'red' }, 123);
    expect(s.wheel).not.toBeNull();
    const prize = s.wheel!.segments[s.wheel!.result];
    const before = computeScores(s).red.total;
    expect(act(s, { type: 'NEXT_TURN' })).toBe(s); // لا ينتقل الدور أثناء الدوران
    s = act(s, { type: 'WHEEL_APPLY' });
    expect(s.wheel!.applied).toBe(true);
    if (prize === 'point') expect(computeScores(s).red.total).toBe(before + 1);
    else if (prize !== 'none') expect(s.teams.red.abilities).toContain(prize);
  });

  it('العجلة لا تمنح قدرات إذا كانت الحقيبة ممتلئة', () => {
    for (let seed = 1; seed < 40; seed++) {
      let s = newGame({ maxAbilities: 2 });
      s.teams.red.abilities = ['time', 'time'];
      s = act(s, { type: 'SPIN_WHEEL', team: 'red' }, seed);
      expect(['point', 'none']).toContain(s.wheel!.segments[s.wheel!.result]);
    }
  });

  it('حدث الكنز الذهبي يحوّل منطقة محايدة إلى ذهبية', () => {
    let s = newGame();
    const before = s.cells.filter((c) => c.kind === 'golden').length;
    s = act(s, { type: 'TRIGGER_EVENT', event: 'golden-rush' });
    expect(s.cells.filter((c) => c.kind === 'golden').length).toBe(before + 1);
  });

  it('الأحداث المجدولة لا تتجاوز العدد المسموح', () => {
    let s = newGame({ eventsCount: 2, rounds: 10 });
    expect(s.eventTurns.length).toBeLessThanOrEqual(2);
    while (s.phase !== 'finished' && s.phase !== 'tiebreak') s = act(s, { type: 'NEXT_TURN' }, (clock * 7) >>> 0);
    expect(s.eventsUsed).toBeLessThanOrEqual(2);
  });

  it('الريمونتادا عند قلب تأخر 3 نقاط', () => {
    let s = newGame({ remontadaGap: 3 });
    s = act(s, { type: 'ADJUST_BONUS', team: 'red', delta: 3 });
    expect(s.comeback.blue).toBe(3);
    s = act(s, { type: 'ADJUST_BONUS', team: 'blue', delta: 4 });
    expect(s.fx.some((f) => f.type === 'remontada' && f.team === 'blue')).toBe(true);
  });
});

describe('التراجع', () => {
  it('يتراجع عن الاحتلال ويستعيد الحالة برقم مراجعة أعلى', () => {
    let rec: MatchRecord = { id: 'm1', state: newGame(), past: [] };
    const run = (body: ActionBody) => {
      const next = reduce(rec.state, { ...body, now: tick(), seed: 5 } as never);
      if (next !== rec.state) rec = commit(rec, next, isUndoable(body.type));
    };
    const id = firstNormal(rec.state);
    run({ type: 'SELECT_CELL', cellId: id });
    run({ type: 'DRAW_QUESTION', question: Q(), difficulty: 'easy' });
    run({ type: 'TIMER_START' });
    tick(4000);
    run({ type: 'JUDGE', correct: true });
    expect(rec.state.cells[id].owner).toBe('red');
    const revBefore = rec.state.rev;
    const undone = undo(rec, tick())!;
    expect(undone.state.cells[id].owner).toBeNull();
    expect(undone.state.phase).toBe('question');
    expect(undone.state.rev).toBeGreaterThan(revBefore);
    // المؤقت مجمّد بالوقت المتبقي لحظة الحكم
    const t = undone.state.current!.timer;
    expect(t.startedAt).toBeNull();
    expect(timerRemaining(t, clock + 99999)).toBeGreaterThan(0);
    expect(undone.past.length).toBe(rec.past.length - 1);
  });
});
