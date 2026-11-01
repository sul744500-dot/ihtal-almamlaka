// مخزن المباراة المشترك بين كل الشاشات.
// شاشات التحكم (المقدم/اللعب/الجوال) تعدّل الحالة وتحفظها وتبثها، وشاشة الجمهور تعرضها فقط.
// عند وجود أكثر من شاشة تحكم تُنتخب «قائدة» واحدة تتولى الأمور التلقائية (انتهاء الوقت، العجلة)
// واختيار الأسئلة للأجهزة البعيدة، حتى لا تتعارض الأوامر ويبقى بنك الأسئلة وسجله في الكمبيوتر.

import { create } from 'zustand';
import { now } from '../lib/clock';
import * as DB from '../lib/db';
import { createMatch, reduce, targetInfo, type Action, type ActionBody, type NewMatchParams } from '../lib/engine';
import { adopt, commit, isUndoable, undo as undoRecord } from '../lib/history';
import { isLocalOrigin, isNewerState } from '../lib/order';
import { pickQuestion, targetDifficulty, withShuffledOptions } from '../lib/picker';
import { mulberry32, randomSeed, uid } from '../lib/rng';
import { clearSnapshot, getBus, readSnapshot, writeSnapshot, type Role, type SyncMsg } from '../lib/sync';
import { timerRemaining } from '../lib/timer';
import type { GameState, MatchRecord, Question } from '../lib/types';
import { useSettings } from './settings';

export interface Peer {
  role: Role;
  lastSeen: number;
  matchId: string | null;
  rev: number;
  /** على الكمبيوتر نفسه (وليس جوالًا على الشبكة) */
  local: boolean;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'warn' | 'error';
}

interface GameStore {
  role: Role;
  ready: boolean;
  record: MatchRecord | null;
  peers: Record<string, Peer>;
  bank: Question[];
  usage: Record<string, number>;
  toasts: Toast[];
  init: (role: Role) => Promise<void>;
  setRole: (role: Role) => void;
  dispatch: (body: ActionBody) => boolean;
  undo: () => boolean;
  newMatch: (params: Omit<NewMatchParams, 'id' | 'now' | 'seed'> & { seed?: number }) => Promise<string>;
  activate: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  drawQuestion: () => boolean;
  replaceQuestion: () => boolean;
  judgePicked: () => boolean;
  reloadBank: () => Promise<void>;
  isLeader: () => boolean;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

const isControllerRole = (r: Role) => r === 'host' || r === 'play';
const LOCAL = isLocalOrigin();

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: MatchRecord | null = null;
let started = false;
let toastSeq = 0;

function flushSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const rec = pendingSave;
  pendingSave = null;
  if (rec) void DB.saveMatch(rec.state, rec.past).catch((e) => console.error('فشل حفظ المباراة', e));
}

function persist(rec: MatchRecord) {
  writeSnapshot(rec.state);
  pendingSave = rec;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 120);
}

export const useGame = create<GameStore>((set, get) => {
  const bus = getBus();

  const broadcast = (state: GameState, flags: { undoable?: boolean; undo?: boolean } = {}) =>
    bus.post({ t: 'state', from: bus.id, state, ...flags });

  const isController = () => isControllerRole(get().role);

  const announce = () => {
    const st = get();
    bus.post({ t: 'ping', from: bus.id, role: st.role, matchId: st.record?.id ?? null, rev: st.record?.state.rev ?? 0, local: LOCAL });
  };

  /** القائدة: شاشة تحكم على الكمبيوتر إن وُجدت، ثم الأصغر معرّفًا */
  const leaderId = (): string | null => {
    const cands: { id: string; local: boolean }[] = [];
    if (isController()) cands.push({ id: bus.id, local: LOCAL });
    for (const [id, p] of Object.entries(get().peers)) if (isControllerRole(p.role)) cands.push({ id, local: p.local });
    cands.sort((a, b) => Number(b.local) - Number(a.local) || (a.id < b.id ? -1 : 1));
    return cands[0]?.id ?? null;
  };
  const amLeader = () => isController() && leaderId() === bus.id;

  /** الجوال يطلب من القائدة اختيار السؤال (لتُستخدم أسئلة الكمبيوتر وسجل استخدامها) */
  const delegate = (cmd: 'draw' | 'replace', fallback: () => boolean): boolean => {
    const leader = leaderId();
    if (LOCAL || !leader || leader === bus.id) return fallback();
    const rev = get().record?.state.rev ?? 0;
    bus.post({ t: 'cmd', from: bus.id, to: leader, cmd });
    setTimeout(() => {
      // لم يصل رد خلال ثانيتين ونصف: نختار من أسئلة هذا الجهاز
      if ((get().record?.state.rev ?? 0) === rev) fallback();
    }, 2500);
    return true;
  };

  const handle = (msg: SyncMsg) => {
    const t = Date.now();
    switch (msg.t) {
      case 'hello': {
        const rec = get().record;
        if (rec) broadcast(rec.state);
        set((st) => ({ peers: { ...st.peers, [msg.from]: { role: msg.role, lastSeen: t, matchId: null, rev: 0, local: msg.local ?? true } } }));
        return;
      }
      case 'ping': {
        set((st) => ({ peers: { ...st.peers, [msg.from]: { role: msg.role, lastSeen: t, matchId: msg.matchId, rev: msg.rev, local: msg.local ?? true } } }));
        const mine = get().record?.state;
        // الطرف الآخر لديه نسخة أحدث (فاتتنا رسالة): نطلبها
        if (msg.matchId && (!mine || (msg.matchId === mine.id && msg.rev > mine.rev))) {
          bus.post({ t: 'hello', from: bus.id, role: get().role, local: LOCAL });
        }
        return;
      }
      case 'bye':
        set((st) => {
          const peers = { ...st.peers };
          delete peers[msg.from];
          return { peers };
        });
        return;
      case 'state': {
        const cur = get().record;
        const mine = cur?.state;
        const r = msg.state;
        if (!isNewerState(r, mine)) return;
        const rec = adopt(cur, r, { undoable: msg.undoable, undo: msg.undo });
        set({ record: rec });
        if (isController()) {
          if (!mine || mine.id !== r.id) {
            void DB.loadMatch(r.id).then((m) => {
              const now2 = get().record;
              if (m && now2 && now2.id === r.id && now2.past.length === 0) set({ record: { ...now2, past: m.past } });
            });
          }
          persist(rec);
        }
        return;
      }
      case 'expired': {
        const s = get().record?.state;
        if (amLeader() && s && s.id === msg.matchId && s.current?.q.id === msg.qid) {
          get().dispatch({ type: 'TIMER_EXPIRE', qid: msg.qid });
        }
        return;
      }
      case 'cmd':
        if (msg.to !== bus.id || !isController()) return;
        if (msg.cmd === 'draw') drawLocal();
        else replaceLocal();
        return;
      case 'cleared':
        if (get().record?.id === msg.matchId) set({ record: null });
        return;
      case 'bank':
        if (isController()) void get().reloadBank();
        return;
      default:
        return;
    }
  };

  // الأمور التلقائية تتولاها القائدة فقط
  const tickLoop = () => {
    const t = now();
    const s = get().record?.state;
    if (!s) return;
    const c = s.current;
    if (c && !c.result && c.timer.startedAt !== null && timerRemaining(c.timer, t) <= 0) {
      if (amLeader()) get().dispatch({ type: 'TIMER_EXPIRE', qid: c.q.id });
      else if (!isController()) bus.post({ t: 'expired', from: bus.id, matchId: s.id, qid: c.q.id });
    }
    if (!amLeader() || !s.wheel) return;
    if (!s.wheel.applied && t >= s.wheel.startedAt + s.wheel.durationMs + 700) get().dispatch({ type: 'WHEEL_APPLY' });
    else if (s.wheel.applied && t >= s.wheel.startedAt + s.wheel.durationMs + 5200) get().dispatch({ type: 'WHEEL_CLOSE' });
  };

  const drawLocal = (): boolean => {
    const s = get().record?.state;
    if (!s) return false;
    const tiebreak = s.phase === 'tiebreak';
    if (!tiebreak && (s.phase !== 'select' || s.selectedCell === null)) return false;
    if (tiebreak && s.current) return false;
    const cell = tiebreak ? null : s.cells[s.selectedCell!];
    const mode = tiebreak ? 'tiebreak' : targetInfo(s, cell!.id).mode;
    if (!mode) return false;
    const rng = mulberry32(randomSeed());
    const difficulty = targetDifficulty(s, cell, mode, rng);
    const res = pickQuestion(get().bank, {
      category: cell?.category ?? null,
      categories: s.categories,
      difficulty,
      exclude: new Set(s.usedQuestionIds),
      usage: get().usage,
      avoidUsed: useSettings.getState().settings.avoidUsedQuestions,
      rng,
    });
    if (!res) {
      get().toast('لا توجد أسئلة في البنك! أضف أسئلة من محرر الأسئلة', 'error');
      return false;
    }
    const ok = get().dispatch({ type: 'DRAW_QUESTION', question: withShuffledOptions(res.question, rng), difficulty: res.difficulty });
    if (ok) {
      void DB.bumpUsage(res.question.id).then((usage) => set({ usage }));
      if (res.repeated) get().toast('نفدت الأسئلة الجديدة — أُعيد سؤال سابق', 'warn');
      else if (res.fallback) get().toast('نفدت أسئلة هذا المستوى/الفئة، فاختير أقرب بديل', 'info');
    }
    return ok;
  };

  const replaceLocal = (): boolean => {
    const s = get().record?.state;
    const c = s?.current;
    if (!s || !c || c.result) return false;
    const rng = mulberry32(randomSeed());
    const cell = c.cellId !== null ? s.cells[c.cellId] : null;
    const res = pickQuestion(get().bank, {
      category: cell?.category ?? c.q.category,
      categories: s.categories,
      difficulty: c.difficulty,
      exclude: new Set([...s.usedQuestionIds, c.q.id]),
      usage: get().usage,
      avoidUsed: useSettings.getState().settings.avoidUsedQuestions,
      rng,
    });
    if (!res || res.question.id === c.q.id) {
      get().toast('لا يوجد سؤال بديل متاح', 'warn');
      return false;
    }
    const ok = get().dispatch({ type: 'REPLACE_QUESTION', question: withShuffledOptions(res.question, rng), difficulty: res.difficulty });
    if (ok) void DB.bumpUsage(res.question.id).then((usage) => set({ usage }));
    return ok;
  };

  return {
    role: 'other',
    ready: false,
    record: null,
    peers: {},
    bank: [],
    usage: {},
    toasts: [],

    setRole: (role) => {
      set({ role });
      announce();
    },

    init: async (role) => {
      set({ role });
      if (started) {
        bus.post({ t: 'hello', from: bus.id, role, local: LOCAL });
        if (isControllerRole(role) && !get().bank.length) await get().reloadBank();
        return;
      }
      started = true;
      bus.on(handle);
      // بعد كل اتصال بخادم المزامنة نعرّف بأنفسنا ونطلب أحدث حالة
      bus.onRelayOpen(() => {
        bus.post({ t: 'hello', from: bus.id, role: get().role, local: LOCAL });
        announce();
        const rec = get().record;
        if (rec && isController()) broadcast(rec.state);
      });
      void useSettings.getState().load();
      try {
        const activeId = await DB.getActiveMatchId();
        let rec: MatchRecord | null = null;
        if (activeId) {
          const m = await DB.loadMatch(activeId);
          if (m) rec = { id: activeId, state: m.state, past: m.past };
          const snap = readSnapshot();
          if (snap && snap.id === activeId && (!rec || snap.rev > rec.state.rev)) {
            rec = { id: activeId, state: snap, past: rec?.past ?? [] };
          }
        }
        // ربما وصلت حالة أحدث من شاشة أخرى أثناء التحميل
        const already = get().record;
        if (rec && (!already || (already.id === rec.id && already.state.rev < rec.state.rev))) set({ record: rec });
      } catch (err) {
        console.error('تعذر تحميل المباراة', err);
      }
      if (isControllerRole(role)) await get().reloadBank();
      set({ ready: true });
      bus.post({ t: 'hello', from: bus.id, role, local: LOCAL });

      setInterval(() => {
        announce();
        const st = get();
        const t = Date.now();
        const stale = Object.entries(st.peers).filter(([, p]) => t - p.lastSeen > 6000);
        if (stale.length) {
          const peers = { ...st.peers };
          for (const [id] of stale) delete peers[id];
          set({ peers });
        }
      }, 1500);
      setInterval(tickLoop, 200);
      window.addEventListener('pagehide', () => {
        flushSave();
        bus.post({ t: 'bye', from: bus.id });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushSave();
      });
    },

    dispatch: (body) => {
      const rec = get().record;
      if (!rec || !isController()) return false;
      const action = { ...body, now: now(), seed: randomSeed() } as Action;
      const next = reduce(rec.state, action);
      if (next === rec.state) return false;
      const undoable = isUndoable(body.type);
      const nr = commit(rec, { ...next, origin: bus.id }, undoable);
      set({ record: nr });
      broadcast(nr.state, { undoable });
      persist(nr);
      return true;
    },

    undo: () => {
      const rec = get().record;
      if (!rec || !isController()) return false;
      const nr = undoRecord(rec, now());
      if (!nr) {
        get().toast('لا توجد حركة للتراجع عنها', 'warn');
        return false;
      }
      nr.state.origin = bus.id;
      set({ record: nr });
      broadcast(nr.state, { undo: true });
      persist(nr);
      get().toast('تم التراجع عن آخر حركة', 'info');
      return true;
    },

    newMatch: async (params) => {
      const id = uid('m-');
      const state = { ...createMatch({ ...params, id, now: now(), seed: params.seed ?? randomSeed() }), origin: bus.id };
      const rec: MatchRecord = { id, state, past: [] };
      await DB.saveMatch(state, []);
      await DB.setActiveMatchId(id);
      set({ record: rec });
      writeSnapshot(state);
      broadcast(state);
      return id;
    },

    activate: async (id) => {
      const m = await DB.loadMatch(id);
      if (!m) return false;
      const state: GameState = { ...m.state, activeAt: now(), rev: m.state.rev + 1, fx: [], origin: bus.id };
      const rec: MatchRecord = { id, state, past: m.past };
      await DB.saveMatch(state, m.past);
      await DB.setActiveMatchId(id);
      set({ record: rec });
      writeSnapshot(state);
      broadcast(state);
      return true;
    },

    remove: async (id) => {
      await DB.deleteMatch(id);
      if ((await DB.getActiveMatchId()) === id) await DB.setActiveMatchId(null);
      clearSnapshot(id);
      if (get().record?.id === id) set({ record: null });
      bus.post({ t: 'cleared', from: bus.id, matchId: id });
    },

    drawQuestion: () => {
      const s = get().record?.state;
      if (!s) return false;
      const tiebreak = s.phase === 'tiebreak';
      if (!tiebreak && (s.phase !== 'select' || s.selectedCell === null)) {
        get().toast('اختر منطقة أولًا', 'warn');
        return false;
      }
      return delegate('draw', drawLocal);
    },

    replaceQuestion: () => {
      const c = get().record?.state.current;
      if (!c || c.result) return false;
      return delegate('replace', replaceLocal);
    },

    judgePicked: () => {
      const c = get().record?.state.current;
      if (!c || c.picked === null || c.q.type !== 'mcq') return false;
      return get().dispatch({ type: 'JUDGE', correct: c.picked === c.q.correct });
    },

    reloadBank: async () => {
      try {
        const [bank, usage] = await Promise.all([DB.ensureBank(), DB.getUsage()]);
        set({ bank, usage });
      } catch (err) {
        console.error('تعذر تحميل بنك الأسئلة', err);
      }
    },

    isLeader: amLeader,

    toast: (text, tone = 'info') => {
      const id = ++toastSeq;
      set((st) => ({ toasts: [...st.toasts.slice(-3), { id, text, tone }] }));
      setTimeout(() => get().dismissToast(id), 3800);
    },

    dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  };
});

/** عدد شاشات الجمهور المتصلة حاليًا (نوافذ المتصفح وOBS) */
export const useAudienceCount = () =>
  useGame((s) => Object.values(s.peers).filter((p) => p.role === 'audience').length);

export const useControllerOnline = () =>
  useGame((s) => Object.values(s.peers).some((p) => p.role === 'host' || p.role === 'play'));

/** أجهزة تحكم بعيدة (جوال على الشبكة) */
export const useRemoteControllerCount = () =>
  useGame((s) => Object.values(s.peers).filter((p) => (p.role === 'host' || p.role === 'play') && !p.local).length);
