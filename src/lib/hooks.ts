import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/game';
import { now as clockNow } from './clock';
import type { Role } from './sync';

/** وقت حالي يتحدث كل فترة (للمؤقتات والعدادات) */
export function useNow(intervalMs = 100, active = true): number {
  const [now, setNow] = useState(() => clockNow());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(clockNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}

/** يضبط دور الشاشة الحالية (مقدم/لعب/جمهور) ويبدأ التزامن */
export function useScreenRole(role: Role): void {
  const init = useGame((s) => s.init);
  useEffect(() => {
    void init(role);
  }, [init, role]);
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  const [prev, setPrev] = useState<T | undefined>(undefined);
  useEffect(() => {
    setPrev(ref.current);
    ref.current = value;
  }, [value]);
  return prev;
}

/** اختصارات لوحة المفاتيح باستخدام e.code حتى تعمل مع لوحة المفاتيح العربية */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const key = `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.code}`;
      const fn = ref.current[key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function useFullscreen(): [boolean, () => void] {
  const [fs, setFs] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return [fs, toggle];
}

/** يمنع إطفاء الشاشة أثناء التصوير الطويل (إن كان المتصفح يدعم ذلك) */
export function useWakeLock(): void {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const request = async () => {
      try {
        if (nav.wakeLock && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen');
      } catch {
        /* غير مدعوم أو مرفوض */
      }
    };
    void request();
    const onVis = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/** يصغّر الصورة المرفوعة (أقصى بُعد 1280) ويحوّلها إلى data URL خفيف */
export function compressImage(file: File, maxSide = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const isPng = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp';
      resolve(canvas.toDataURL(isPng ? 'image/webp' : 'image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذر قراءة الصورة'));
    };
    img.src = url;
  });
}

export function openAudienceWindow(): Window | null {
  const url = `${location.origin}${location.pathname}#/audience`;
  return window.open(url, 'ihtal-audience', 'popup,width=1280,height=720');
}

export const formatDate = (t: number) =>
  new Date(t).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', calendar: 'gregory' });
