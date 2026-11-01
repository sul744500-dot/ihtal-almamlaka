import type { Rules } from './types';

export const DEFAULT_RULES: Rules = {
  rounds: 20,
  answerSeconds: 15,
  normalValue: 1,
  goldenValue: 2,
  crownValue: 3,
  goldenCount: 4,
  crownEnabled: true,
  crownRounds: 3,
  stealEnabled: true,
  stealImmunity: true,
  abilitiesEnabled: true,
  maxAbilities: 2,
  shieldTurns: 4,
  extraTimeSeconds: 10,
  eventsCount: 2,
  wheelEvery: 5,
  reboundEnabled: false,
  reboundSeconds: 8,
  finalRoundEnabled: true,
  tiebreakEnabled: true,
  autoReveal: true,
  autoStartTimer: false,
  remontadaGap: 3,
};

export interface RulesPreset {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rules: Partial<Rules>;
}

export const RULE_PRESETS: RulesPreset[] = [
  {
    id: 'quick',
    name: 'سريعة',
    icon: '⚡',
    desc: '10 جولات (20 سؤالًا) — مناسبة لحلقة قصيرة',
    rules: { rounds: 10, answerSeconds: 15, goldenCount: 3, crownRounds: 2, eventsCount: 1, wheelEvery: 4 },
  },
  {
    id: 'standard',
    name: 'قياسية',
    icon: '👑',
    desc: '20 جولة (40 سؤالًا) — الإعداد الافتراضي المتوازن',
    rules: {},
  },
  {
    id: 'epic',
    name: 'ملحمية',
    icon: '🔥',
    desc: '30 جولة (60 سؤالًا) — حلقة طويلة مليئة بالسرقات',
    rules: { rounds: 30, goldenCount: 5, crownRounds: 4, eventsCount: 3, wheelEvery: 6 },
  },
];

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** يضمن أن كل القواعد ضمن حدود منطقية حتى لو جاءت من ملف مستورد */
export function sanitizeRules(input: Partial<Rules> | undefined | null): Rules {
  const r = input ?? {};
  const d = DEFAULT_RULES;
  const rounds = clamp(r.rounds, 1, 60, d.rounds);
  return {
    rounds,
    answerSeconds: clamp(r.answerSeconds, 5, 120, d.answerSeconds),
    normalValue: clamp(r.normalValue, 1, 5, d.normalValue),
    goldenValue: clamp(r.goldenValue, 1, 10, d.goldenValue),
    crownValue: clamp(r.crownValue, 1, 10, d.crownValue),
    goldenCount: clamp(r.goldenCount, 0, 8, d.goldenCount),
    crownEnabled: bool(r.crownEnabled, d.crownEnabled),
    crownRounds: clamp(r.crownRounds, 1, rounds, Math.min(d.crownRounds, rounds)),
    stealEnabled: bool(r.stealEnabled, d.stealEnabled),
    stealImmunity: bool(r.stealImmunity, d.stealImmunity),
    abilitiesEnabled: bool(r.abilitiesEnabled, d.abilitiesEnabled),
    maxAbilities: clamp(r.maxAbilities, 1, 4, d.maxAbilities),
    shieldTurns: clamp(r.shieldTurns, 2, 12, d.shieldTurns),
    extraTimeSeconds: clamp(r.extraTimeSeconds, 3, 30, d.extraTimeSeconds),
    eventsCount: clamp(r.eventsCount, 0, 5, d.eventsCount),
    wheelEvery: clamp(r.wheelEvery, 0, 20, d.wheelEvery),
    reboundEnabled: bool(r.reboundEnabled, d.reboundEnabled),
    reboundSeconds: clamp(r.reboundSeconds, 3, 60, d.reboundSeconds),
    finalRoundEnabled: bool(r.finalRoundEnabled, d.finalRoundEnabled),
    tiebreakEnabled: bool(r.tiebreakEnabled, d.tiebreakEnabled),
    autoReveal: bool(r.autoReveal, d.autoReveal),
    autoStartTimer: bool(r.autoStartTimer, d.autoStartTimer),
    remontadaGap: clamp(r.remontadaGap, 2, 20, d.remontadaGap),
  };
}
