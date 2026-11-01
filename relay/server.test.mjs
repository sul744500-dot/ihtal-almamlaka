// اختبار تكامل: نشغّل خادم المزامنة الحقيقي ونتصل به كعدة شاشات
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const SERVER = fileURLToPath(new URL('./server.mjs', import.meta.url));
let proc;

function open(path = '/ws') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}${path}`);
    const inbox = [];
    ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
    ws.once('open', () => resolve({ ws, inbox }));
    ws.once('error', reject);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(20);
  }
  return fn();
}

beforeAll(async () => {
  proc = spawn(process.execPath, [SERVER], { env: { ...process.env, IHTAL_PORT: String(PORT), IHTAL_HOST: '127.0.0.1', IHTAL_PIN: '4321' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('الخادم لم يبدأ')), 8000);
    proc.stdout.on('data', (d) => {
      if (d.toString().includes(`localhost:${PORT}`)) {
        clearTimeout(t);
        resolve();
      }
    });
    proc.on('exit', (code) => reject(new Error(`خرج الخادم ${code}`)));
  });
});

afterAll(() => {
  proc?.kill();
});

describe('خادم المزامنة', () => {
  it('يمرر الرسائل إلى الشاشات الأخرى فقط', async () => {
    const a = await open();
    const b = await open();
    a.ws.send(JSON.stringify({ t: 'ping', from: 'A', mid: 'x1', role: 'host', matchId: null, rev: 0 }));
    const got = await until(() => b.inbox.find((m) => m.mid === 'x1'));
    expect(got?.from).toBe('A');
    await wait(100);
    expect(a.inbox.find((m) => m.mid === 'x1')).toBeUndefined();
    a.ws.close();
    b.ws.close();
  });

  it('يحتفظ بأحدث حالة ويرسلها لأي شاشة تتصل لاحقًا (مثل OBS)', async () => {
    const host = await open();
    const st = (rev, extra = {}) => ({ id: 'match-1', rev, activeAt: 10, updatedAt: rev * 10, origin: 'h', ...extra });
    host.ws.send(JSON.stringify({ t: 'state', from: 'H', mid: 's5', state: st(5) }));
    host.ws.send(JSON.stringify({ t: 'state', from: 'H', mid: 's3', state: st(3) }));
    await wait(150);
    const obs = await open();
    const first = await until(() => obs.inbox.find((m) => m.t === 'state'));
    expect(first?.state.rev).toBe(5);
    host.ws.close();
    obs.ws.close();
  });

  it('يرد على مزامنة الساعة', async () => {
    const c = await open();
    const t0 = Date.now();
    c.ws.send(JSON.stringify({ t: 'time', id: 'k1', t0 }));
    const r = await until(() => c.inbox.find((m) => m.t === 'time'));
    expect(r?.id).toBe('k1');
    expect(r?.t0).toBe(t0);
    expect(Math.abs(r.server - Date.now())).toBeLessThan(2000);
    c.ws.close();
  });

  it('يعطي الكمبيوتر نفسه رمز الجوال وروابط الشبكة', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/ihtal-relay.json`);
    const j = await res.json();
    expect(j.ws).toBe(true);
    expect(j.pin).toBe('4321');
    expect(Array.isArray(j.lanUrls)).toBe(true);
  });

  it('يمنع الخروج من مجلد اللعبة', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/..%2F..%2Fpackage.json`);
    expect([403, 404]).toContain(res.status);
  });
});
