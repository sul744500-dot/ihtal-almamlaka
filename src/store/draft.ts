import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ALL_CATEGORY_IDS } from '../lib/meta';
import { DEFAULT_RULES, RULE_PRESETS, sanitizeRules } from '../lib/rules';
import type { CategoryId, DifficultyMode, Rules, TeamId } from '../lib/types';

export interface Draft {
  title: string;
  preset: string;
  startingTeam: TeamId | 'random';
  teams: Record<TeamId, { name: string; emblem: string }>;
  rules: Rules;
  categories: CategoryId[];
  difficultyMode: DifficultyMode;
  /** بذرة توزيع اللوحة (المعاينة تطابق المباراة الفعلية) */
  seed: number;
}

const freshDraft = (rules: Rules = DEFAULT_RULES): Draft => ({
  seed: Math.floor(Math.random() * 4294967296),
  title: '',
  preset: 'standard',
  startingTeam: 'random',
  teams: { red: { name: 'الصقور', emblem: '🦅' }, blue: { name: 'الذئاب', emblem: '🐺' } },
  rules: sanitizeRules(rules),
  categories: ALL_CATEGORY_IDS.slice(),
  difficultyMode: 'progressive',
});

interface DraftStore extends Draft {
  set: (patch: Partial<Draft>) => void;
  setRules: (patch: Partial<Rules>) => void;
  setTeam: (team: TeamId, patch: Partial<{ name: string; emblem: string }>) => void;
  applyPreset: (id: string, base: Rules) => void;
  reset: (base: Rules) => void;
}

export const useDraft = create<DraftStore>()(
  persist(
    (set, get) => ({
      ...freshDraft(),
      set: (patch) => set(patch),
      setRules: (patch) => set({ rules: sanitizeRules({ ...get().rules, ...patch }), preset: 'custom' }),
      setTeam: (team, patch) => set({ teams: { ...get().teams, [team]: { ...get().teams[team], ...patch } } }),
      applyPreset: (id, base) => {
        const p = RULE_PRESETS.find((x) => x.id === id);
        set({ preset: id, rules: sanitizeRules({ ...base, ...(p?.rules ?? {}) }) });
      },
      reset: (base) => set(freshDraft(base)),
    }),
    { name: 'ihtal:draft', storage: createJSONStorage(() => sessionStorage) },
  ),
);
