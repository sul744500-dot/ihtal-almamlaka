// الاتصال بخادم المزامنة المحلي (relay/server.mjs)
// تلقائي: إذا كانت اللعبة مفتوحة من الخادم نفسه نتصل به مباشرة.
// يمكن أيضًا تحديد عنوان مخصص من الإعدادات أو عبر ?relay=ws://…/ws

import { create } from 'zustand';
import { isLocalOrigin } from './order';
import { getBus, type RelayStatus } from './sync';

export type RelayMode = 'auto' | 'off' | 'custom';

export interface RelayInfo {
  port?: number;
  /** يظهر فقط للأجهزة المتصلة من الكمبيوتر نفسه */
  pin?: string;
  lanUrls?: string[];
}

interface RelayStore {
  mode: RelayMode;
  customUrl: string;
  status: RelayStatus;
  url: string | null;
  info: RelayInfo | null;
  rtt: number | null;
  offset: number;
}

const MODE_KEY = 'ihtal:relay';
const PIN_KEY = 'ihtal:pin';

function readMode(): { mode: RelayMode; customUrl: string } {
  try {
    const v = localStorage.getItem(MODE_KEY) ?? 'auto';
    if (v === 'auto' || v === 'off') return { mode: v, customUrl: '' };
    return { mode: 'custom', customUrl: v };
  } catch {
    return { mode: 'auto', customUrl: '' };
  }
}

export const useRelay = create<RelayStore>(() => ({
  ...readMode(),
  status: 'off',
  url: null,
  info: null,
  rtt: null,
  offset: 0,
}));

/** يحفظ وضع الاتصال (يُطبق بعد إعادة تحميل الصفحة) */
export function saveRelayMode(mode: RelayMode, customUrl = ''): void {
  try {
    localStorage.setItem(MODE_KEY, mode === 'custom' ? customUrl.trim() : mode);
  } catch {
    /* تجاهل */
  }
  useRelay.setState({ mode, customUrl });
}

function storedPin(): string | null {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}

function withPin(url: string, pin: string | null): string {
  if (!pin) return url;
  const u = new URL(url);
  u.searchParams.set('pin', pin);
  return u.toString();
}

let started = false;

export async function initRelay(): Promise<void> {
  if (started || typeof window === 'undefined') return;
  started = true;
  const params = new URLSearchParams(location.search);
  const qPin = params.get('pin');
  if (qPin) {
    try {
      localStorage.setItem(PIN_KEY, qPin);
    } catch {
      /* تجاهل */
    }
  }
  const qRelay = params.get('relay');
  let { mode, customUrl } = readMode();
  if (qRelay) {
    mode = qRelay === 'off' ? 'off' : 'custom';
    customUrl = qRelay;
  }
  if (mode === 'off') return;

  const bus = getBus();
  bus.onRelayStatus = (s) => useRelay.setState({ status: s.status, ...(s.rtt !== undefined ? { rtt: s.rtt } : {}), ...(s.offset !== undefined ? { offset: s.offset } : {}) });

  let url: string;
  if (mode === 'custom') {
    url = customUrl;
  } else {
    // تلقائي: هل اللعبة مفتوحة من خادم المزامنة؟
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch('./ihtal-relay.json', { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return;
      const info = (await res.json()) as RelayInfo & { ws?: boolean };
      if (!info.ws) return;
      useRelay.setState({ info });
    } catch {
      return;
    }
    url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }
  try {
    url = withPin(url, isLocalOrigin() ? null : storedPin());
  } catch {
    return;
  }
  useRelay.setState({ url, status: 'connecting' });
  bus.attachRelay(url);
}
