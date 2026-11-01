import { create } from 'zustand';
import { loadSettings, saveSettings } from '../lib/db';
import { DEFAULT_RULES, sanitizeRules } from '../lib/rules';
import { sfx } from '../lib/sound';
import { getBus } from '../lib/sync';
import type { Settings } from '../lib/types';

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  volume: 0.8,
  controllerSound: 'auto',
  reduceMotion: false,
  effectsLevel: 'full',
  hideAnswerOnHost: false,
  shortcuts: true,
  avoidUsedQuestions: true,
  showCellCategories: true,
  audienceStatusBadge: true,
  defaultRules: DEFAULT_RULES,
};

const CACHE_KEY = 'ihtal:settings';

function normalize(s: Partial<Settings> | undefined | null): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  merged.defaultRules = sanitizeRules(merged.defaultRules);
  merged.volume = Math.max(0, Math.min(1, Number(merged.volume) || 0));
  return merged;
}

function readCache(): Settings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function apply(s: Settings) {
  sfx.configure({ enabled: s.sfx, volume: s.volume });
  document.documentElement.dataset.motion = s.reduceMotion ? 'reduced' : 'full';
  document.documentElement.dataset.effects = s.effectsLevel;
}

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: readCache(),
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const stored = await loadSettings();
      if (stored) {
        const s = normalize(stored);
        set({ settings: s });
        localStorage.setItem(CACHE_KEY, JSON.stringify(s));
      }
    } catch (err) {
      console.warn('تعذر تحميل الإعدادات', err);
    }
    set({ loaded: true });
    apply(get().settings);
  },
  update: (patch) => {
    const s = normalize({ ...get().settings, ...patch });
    set({ settings: s });
    apply(s);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(s));
    } catch {
      /* تجاهل */
    }
    void saveSettings(s);
    getBus().post({ t: 'settings', from: getBus().id, settings: s });
  },
  reset: () => get().update(DEFAULT_SETTINGS),
}));

// تحديث الإعدادات القادمة من تبويب آخر (مثلًا تغيير مستوى الصوت من لوحة المقدم)
getBus().on((msg) => {
  if (msg.t !== 'settings') return;
  const s = normalize(msg.settings);
  useSettings.setState({ settings: s });
  apply(s);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* تجاهل */
  }
});

apply(useSettings.getState().settings);
