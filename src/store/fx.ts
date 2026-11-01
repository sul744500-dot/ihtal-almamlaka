// حالة المؤثرات المحلية لكل شاشة (لا تُحفظ ولا تُبث): الإعلانات والرسوم المتحركة

import { create } from 'zustand';
import type { FxType, TeamId } from '../lib/types';

export interface CellAnim {
  key: string;
  type: 'capture' | 'steal' | 'shield' | 'golden';
  team: TeamId | null;
}

export type BannerKind = 'big' | 'mid' | 'lower';

export interface Banner {
  id: string;
  kind: BannerKind;
  variant: FxType;
  title: string;
  sub?: string;
  icon?: string;
  team?: TeamId | null;
  duration: number;
}

export interface ScorePop {
  id: string;
  team: TeamId;
  value: number;
}

interface FxStore {
  /** المالك الذي يُعرض مؤقتًا قبل أن تبدأ حركة الاحتلال */
  pendingOwners: Record<number, TeamId | null>;
  cellAnims: Record<number, CellAnim>;
  queue: Banner[];
  current: Banner | null;
  pops: ScorePop[];
  shakeKey: number;
  flash: { key: number; color: string } | null;
  setPending: (cellId: number, owner: TeamId | null) => void;
  clearPending: (cellId: number) => void;
  animateCell: (cellId: number, anim: CellAnim) => void;
  pushBanner: (b: Banner) => void;
  nextBanner: () => void;
  clearBanners: () => void;
  pop: (p: ScorePop) => void;
  shake: () => void;
  doFlash: (color: string) => void;
  reset: () => void;
}

let bannerTimer: ReturnType<typeof setTimeout> | null = null;

export const useFx = create<FxStore>((set, get) => ({
  pendingOwners: {},
  cellAnims: {},
  queue: [],
  current: null,
  pops: [],
  shakeKey: 0,
  flash: null,
  setPending: (cellId, owner) => set((s) => ({ pendingOwners: { ...s.pendingOwners, [cellId]: owner } })),
  clearPending: (cellId) =>
    set((s) => {
      if (!(cellId in s.pendingOwners)) return s;
      const p = { ...s.pendingOwners };
      delete p[cellId];
      return { pendingOwners: p };
    }),
  animateCell: (cellId, anim) => {
    set((s) => ({ cellAnims: { ...s.cellAnims, [cellId]: anim } }));
    setTimeout(() => {
      set((s) => {
        if (s.cellAnims[cellId]?.key !== anim.key) return s;
        const c = { ...s.cellAnims };
        delete c[cellId];
        return { cellAnims: c };
      });
    }, 1600);
  },
  pushBanner: (b) => {
    const { current, queue } = get();
    if (!current) {
      set({ current: b });
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => get().nextBanner(), b.duration);
    } else {
      // الإعلانات الصغيرة لا تتراكم: نحتفظ بآخرها فقط
      const filtered = b.kind === 'lower' ? queue.filter((q) => q.kind !== 'lower') : queue;
      set({ queue: [...filtered, b].slice(-5) });
    }
  },
  nextBanner: () => {
    const [next, ...rest] = get().queue;
    set({ current: next ?? null, queue: rest });
    if (bannerTimer) clearTimeout(bannerTimer);
    if (next) bannerTimer = setTimeout(() => get().nextBanner(), next.duration);
  },
  clearBanners: () => {
    if (bannerTimer) clearTimeout(bannerTimer);
    set({ current: null, queue: [] });
  },
  pop: (p) => {
    set((s) => ({ pops: [...s.pops, p] }));
    setTimeout(() => set((s) => ({ pops: s.pops.filter((x) => x.id !== p.id) })), 1800);
  },
  shake: () => set((s) => ({ shakeKey: s.shakeKey + 1 })),
  doFlash: (color) => set((s) => ({ flash: { key: (s.flash?.key ?? 0) + 1, color } })),
  reset: () => {
    if (bannerTimer) clearTimeout(bannerTimer);
    set({ pendingOwners: {}, cellAnims: {}, queue: [], current: null, pops: [] });
  },
}));
