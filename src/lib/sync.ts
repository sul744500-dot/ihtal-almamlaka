// قناة التزامن بين الشاشات:
// - BroadcastChannel بين تبويبات/نوافذ المتصفح نفسه (مع بديل localStorage)
// - WebSocket اختياري عبر خادم المزامنة المحلي (لـ OBS Browser Source والجوال)
// الرسائل تحمل معرّفًا فريدًا (mid) فتُتجاهل النسخ المكررة القادمة من القناتين.

import { estimateOffset, localNow, setOffset, type TimeSample } from './clock';
import type { GameState, Settings } from './types';
import { uid } from './rng';

export type Role = 'host' | 'play' | 'audience' | 'other';

type Base = { from: string; mid?: string };

export type SyncMsg = Base &
  (
    | { t: 'state'; state: GameState; undoable?: boolean; undo?: boolean }
    | { t: 'hello'; role: Role; local?: boolean }
    | { t: 'ping'; role: Role; matchId: string | null; rev: number; local?: boolean }
    | { t: 'bye' }
    | { t: 'settings'; settings: Settings }
    | { t: 'expired'; matchId: string; qid: string }
    | { t: 'cleared'; matchId: string }
    | { t: 'bank' }
    | { t: 'cmd'; to: string; cmd: 'draw' | 'replace' }
  );

export type RelayStatus = 'off' | 'connecting' | 'connected' | 'unauthorized';

export interface RelayStatusInfo {
  status: RelayStatus;
  rtt?: number;
  offset?: number;
}

const CHANNEL = 'ihtal-almamlaka-sync-v1';
const LS_KEY = 'ihtal:bus';

type Listener = (msg: SyncMsg) => void;

export class Bus {
  readonly id = uid('tab-');
  private bc: BroadcastChannel | null = null;
  private listeners = new Set<Listener>();
  private openListeners = new Set<() => void>();
  private seen = new Set<string>();
  private seenOrder: string[] = [];
  private ws: WebSocket | null = null;
  private wsUrl: string | null = null;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private resyncTimer: ReturnType<typeof setInterval> | null = null;
  private timeWaiters = new Map<string, (s: TimeSample | null) => void>();
  onRelayStatus: ((info: RelayStatusInfo) => void) | null = null;

  private onStorage = (e: StorageEvent) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    try {
      this.receive(JSON.parse(e.newValue) as SyncMsg);
    } catch {
      /* رسالة تالفة */
    }
  };

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(CHANNEL);
      this.bc.onmessage = (e) => this.receive(e.data as SyncMsg);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorage);
    }
  }

  private remember(mid: string) {
    this.seen.add(mid);
    this.seenOrder.push(mid);
    if (this.seenOrder.length > 1000) {
      for (const m of this.seenOrder.splice(0, 400)) this.seen.delete(m);
    }
  }

  private receive(msg: SyncMsg) {
    if (!msg || msg.from === this.id) return;
    if (msg.mid) {
      if (this.seen.has(msg.mid)) return;
      this.remember(msg.mid);
    }
    for (const l of this.listeners) l(msg);
  }

  post(msg: SyncMsg): void {
    const m = { ...msg, mid: msg.mid ?? uid('m') } as SyncMsg;
    this.remember(m.mid!);
    try {
      if (this.bc) this.bc.postMessage(m);
      else localStorage.setItem(LS_KEY, JSON.stringify({ ...m, n: Math.random() }));
    } catch (err) {
      console.warn('تعذر إرسال رسالة التزامن', err);
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(m));
      } catch (err) {
        console.warn('تعذر الإرسال إلى خادم المزامنة', err);
      }
    }
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** يُستدعى عند كل اتصال (أو إعادة اتصال) بخادم المزامنة */
  onRelayOpen(fn: () => void): () => void {
    this.openListeners.add(fn);
    return () => this.openListeners.delete(fn);
  }

  get relayConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  attachRelay(url: string): void {
    this.wsUrl = url;
    this.connect();
  }

  private status(info: RelayStatusInfo) {
    this.onRelayStatus?.(info);
  }

  private schedule(ms: number) {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), ms);
  }

  private connect() {
    if (!this.wsUrl) return;
    this.status({ status: 'connecting' });
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.wsUrl);
    } catch {
      this.schedule(3000);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.status({ status: 'connected' });
      void this.syncTime();
      if (this.resyncTimer) clearInterval(this.resyncTimer);
      this.resyncTimer = setInterval(() => void this.syncTime(), 60000);
      for (const fn of this.openListeners) fn();
    };
    ws.onmessage = (e) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      const m = msg as { t?: string; id?: string; t0?: number; server?: number };
      if (m.t === 'time') {
        const waiter = m.id ? this.timeWaiters.get(m.id) : undefined;
        if (waiter && typeof m.t0 === 'number' && typeof m.server === 'number') waiter({ t0: m.t0, t1: localNow(), server: m.server });
        return;
      }
      this.receive(msg as SyncMsg);
    };
    ws.onclose = (e) => {
      if (this.ws === ws) this.ws = null;
      if (this.resyncTimer) clearInterval(this.resyncTimer);
      if (e.code === 4001) {
        this.status({ status: 'unauthorized' });
        this.schedule(15000);
        return;
      }
      this.status({ status: 'connecting' });
      this.retry += 1;
      this.schedule(Math.min(8000, 500 * 2 ** Math.min(this.retry, 4)));
    };
  }

  /** مزامنة الساعة مع الخادم (عدة عينات، نأخذ الأدق) */
  private async syncTime(): Promise<void> {
    const samples: TimeSample[] = [];
    for (let i = 0; i < 6; i++) {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const id = uid('t');
      const sample = new Promise<TimeSample | null>((resolve) => {
        this.timeWaiters.set(id, resolve);
        setTimeout(() => resolve(null), 2000);
      });
      ws.send(JSON.stringify({ t: 'time', id, t0: localNow() }));
      const s = await sample;
      this.timeWaiters.delete(id);
      if (s) samples.push(s);
      await new Promise((r) => setTimeout(r, 100));
    }
    const est = estimateOffset(samples);
    if (est) {
      setOffset(est.offset);
      this.status({ status: 'connected', rtt: est.rtt, offset: est.offset });
    }
  }

  close(): void {
    this.bc?.close();
    this.ws?.close();
    if (typeof window !== 'undefined') window.removeEventListener('storage', this.onStorage);
  }
}

let bus: Bus | null = null;
export function getBus(): Bus {
  bus ??= new Bus();
  return bus;
}

// ───── لقطة سريعة في localStorage (تكتب فورًا، تحمي من فقد آخر حركة عند إغلاق الصفحة) ─────

const SNAP_KEY = 'ihtal:snapshot';

export function writeSnapshot(state: GameState): void {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(state));
  } catch {
    // الحجم كبير (صورة مرفوعة مثلًا) — لا بأس، IndexedDB يكفي
    try {
      localStorage.removeItem(SNAP_KEY);
    } catch {
      /* تجاهل */
    }
  }
}

export function readSnapshot(): GameState | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

export function clearSnapshot(id?: string): void {
  try {
    if (!id || readSnapshot()?.id === id) localStorage.removeItem(SNAP_KEY);
  } catch {
    /* تجاهل */
  }
}
