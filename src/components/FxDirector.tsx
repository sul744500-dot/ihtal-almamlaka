// يقرأ المؤثرات القادمة من حالة المباراة ويشغّل الأصوات والإعلانات والرسوم في الوقت المناسب

import { useEffect, useRef } from 'react';
import { celebrate, goldBurst, stopCelebration, teamBurst } from '../lib/confetti';
import { TEAM_COLORS } from '../lib/meta';
import { cellValue } from '../lib/scoring';
import { now as clockNow } from '../lib/clock';
import { sfx } from '../lib/sound';
import { timerRemaining } from '../lib/timer';
import { other, type Fx, type GameState } from '../lib/types';
import { useAudienceCount, useGame } from '../store/game';
import { useFx, type Banner } from '../store/fx';
import { useSettings } from '../store/settings';

/** هل يجب أن تُصدر هذه الشاشة أصواتًا؟ (حتى لا تتكرر الأصوات من شاشتين) */
export function useSoundOn(): boolean {
  const role = useGame((s) => s.role);
  const audience = useAudienceCount();
  const enabled = useSettings((s) => s.settings.sfx);
  const mode = useSettings((s) => s.settings.controllerSound);
  if (!enabled) return false;
  if (role === 'audience') return true;
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return audience === 0;
}

const seen = new Set<string>();
let seenMatch: string | null = null;
let firstLoad = true;

function bannerFor(fx: Fx, s: GameState): Banner | null {
  const base = { id: fx.id, variant: fx.type, title: fx.title ?? '', sub: fx.sub, icon: fx.icon, team: fx.team ?? null };
  switch (fx.type) {
    case 'remontada':
      return { ...base, kind: 'big', icon: '🔥', duration: 4200 };
    case 'event':
      return { ...base, kind: 'big', duration: 4000 };
    case 'crown-appears':
      return { ...base, kind: 'big', icon: '👑', duration: 3800 };
    case 'final-round':
      return { ...base, kind: 'big', icon: '⚔️', duration: 3800 };
    case 'tiebreak':
      return { ...base, kind: 'big', icon: '⚖️', duration: 3800 };
    case 'start':
      return { ...base, kind: 'big', icon: '👑', title: fx.title ?? s.title, duration: 4200 };
    case 'crown-capture':
      return { ...base, kind: 'big', icon: '👑', duration: 3400 };
    case 'steal':
      return { ...base, kind: 'mid', icon: '⚔️', duration: 2300 };
    case 'golden':
      return { ...base, kind: 'mid', icon: fx.icon ?? '⭐', duration: 2800 };
    case 'ability':
      return { ...base, kind: 'mid', duration: 2600 };
    case 'rebound':
      return { ...base, kind: 'mid', icon: '↩️', duration: 2400 };
    case 'second-chance':
      return { ...base, kind: 'mid', duration: 2200 };
    case 'wheel-result':
      return { ...base, kind: 'mid', duration: 3000 };
    case 'announce':
      return { ...base, kind: 'big', icon: fx.icon ?? '📢', duration: 4500 };
    case 'turn':
      return { ...base, kind: 'lower', duration: 1900 };
    default:
      return null;
  }
}

export function FxDirector({ sound, visuals }: { sound: boolean; visuals: boolean }) {
  const record = useGame((s) => s.record);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const visualsRef = useRef(visuals);
  visualsRef.current = visuals;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // عند مغادرة الصفحة: نوقف كل المؤثرات المجدولة والقصاصات
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      stopCelebration();
      useFx.getState().reset();
      seenMatch = null;
      firstLoad = true;
      seen.clear();
    },
    [],
  );

  useEffect(() => {
    const s = record?.state;
    if (!s) {
      if (seenMatch !== null) {
        seenMatch = null;
        useFx.getState().reset();
        stopCelebration();
      }
      return;
    }
    const now = clockNow();
    const fresh: Fx[] = [];
    if (s.id !== seenMatch) {
      const switching = seenMatch !== null || !firstLoad;
      seenMatch = s.id;
      useFx.getState().reset();
      stopCelebration();
      for (const fx of s.fx) {
        // عند فتح الصفحة لا نعيد تشغيل مؤثرات قديمة؛ وعند بدء مباراة جديدة نعرض المقدمة
        if (!seen.has(fx.id) && (switching ? now - fx.at < 8000 : now - fx.at < 1500)) fresh.push(fx);
        seen.add(fx.id);
      }
    } else {
      for (const fx of s.fx) {
        if (seen.has(fx.id)) continue;
        seen.add(fx.id);
        fresh.push(fx);
      }
    }
    firstLoad = false;

    for (const fx of fresh) {
      const fxs = useFx.getState();
      if ((fx.type === 'capture' || fx.type === 'steal') && fx.cellId != null && fx.team) {
        fxs.setPending(fx.cellId, fx.type === 'steal' ? other(fx.team) : null);
      }
      const wait = Math.max(0, fx.at + (fx.delay ?? 0) - clockNow());
      const t = setTimeout(() => run(fx, s), wait);
      timers.current.push(t);
    }
    if (timers.current.length > 200) timers.current = timers.current.slice(-100);
  }, [record]);

  return null;

  function run(fx: Fx, s: GameState) {
    if (soundRef.current && fx.sound) sfx.play(fx.sound);
    const fxs = useFx.getState();
    if (!visualsRef.current) {
      if (fx.cellId != null) fxs.clearPending(fx.cellId);
      return;
    }
    const team = fx.team ?? null;
    const colors = team ? TEAM_COLORS[team] : null;
    switch (fx.type) {
      case 'capture':
      case 'steal':
        if (fx.cellId != null && team) {
          fxs.animateCell(fx.cellId, { key: fx.id, type: fx.type, team });
          setTimeout(() => fxs.clearPending(fx.cellId!), 380);
          const cell = s.cells[fx.cellId];
          fxs.pop({ id: fx.id, team, value: cell ? cellValue(cell, s.rules) : 1 });
          if (fx.type === 'steal') fxs.doFlash(colors!.main);
        }
        break;
      case 'golden':
        goldBurst(0.5, 0.5);
        break;
      case 'crown-capture':
        goldBurst(0.5, 0.4, colors ? [colors.main] : []);
        break;
      case 'remontada':
        fxs.shake();
        if (colors) teamBurst(colors.main, colors.light);
        break;
      case 'ability':
        if (fx.cellId != null) fxs.animateCell(fx.cellId, { key: fx.id, type: 'shield', team });
        break;
      case 'event':
        if (fx.cellId != null) fxs.animateCell(fx.cellId, { key: fx.id, type: 'golden', team: null });
        fxs.doFlash('#f6c443');
        break;
      case 'bonus':
      case 'penalty':
        if (team && fx.value) fxs.pop({ id: fx.id, team, value: fx.value });
        break;
      case 'winner':
        if (colors) celebrate([colors.main, colors.light]);
        break;
      default:
        break;
    }
    const b = bannerFor(fx, s);
    if (b) fxs.pushBanner(b);
  }
}

/** صوت دقات المؤقت في آخر 5 ثوانٍ */
export function TimerTicker({ sound }: { sound: boolean }) {
  const last = useRef<string>('');
  useEffect(() => {
    if (!sound) return;
    const id = setInterval(() => {
      const c = useGame.getState().record?.state.current;
      if (!c || c.result || c.timer.startedAt === null) return;
      const sec = Math.ceil(timerRemaining(c.timer, clockNow()) / 1000);
      const key = `${c.q.id}:${c.timer.durationMs}:${sec}`;
      if (sec > 0 && sec <= 5 && key !== last.current) {
        last.current = key;
        sfx.play(sec <= 3 ? 'tickUrgent' : 'tick');
      }
    }, 80);
    return () => clearInterval(id);
  }, [sound]);
  return null;
}
