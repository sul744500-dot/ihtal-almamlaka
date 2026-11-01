import { describe, expect, it } from 'vitest';
import { isNewerState as clientRule } from '../src/lib/order.ts';
import { authorize, isLoopback, isNewerState, makePin } from './logic.mjs';

const S = (o) => ({ id: 'm1', rev: 5, activeAt: 100, updatedAt: 1000, origin: 'tab-a', ...o });

describe('ترتيب الحالات في الخادم', () => {
  const cases = [
    [S({ rev: 6 }), S(), true],
    [S({ rev: 4 }), S(), false],
    [S(), S(), false],
    [S({ updatedAt: 1001 }), S(), true],
    [S({ origin: 'tab-b' }), S(), true],
    [S({ origin: 'tab-0' }), S(), false],
    [S({ id: 'm2', rev: 1, activeAt: 200 }), S(), true],
    [S({ id: 'm2', rev: 99, activeAt: 50 }), S(), false],
    [S(), null, true],
  ];

  it('يطابق قاعدة المتصفح في كل الحالات', () => {
    for (const [r, mine, expected] of cases) {
      expect(isNewerState(r, mine)).toBe(expected);
      expect(clientRule(r, mine)).toBe(expected);
    }
  });

  it('نسختان متعارضتان بنفس رقم المراجعة: يتفق الطرفان على فائز واحد', () => {
    const a = S({ rev: 9, updatedAt: 5000, origin: 'tab-a' });
    const b = S({ rev: 9, updatedAt: 5000, origin: 'tab-b' });
    expect(isNewerState(a, b)).not.toBe(isNewerState(b, a));
  });
});

describe('الصلاحيات', () => {
  it('الكمبيوتر نفسه بلا رمز، والجوال يحتاج الرمز الصحيح', () => {
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('::1')).toBe(true);
    expect(isLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopback('192.168.1.20')).toBe(false);
    expect(authorize('127.0.0.1', null, '1234')).toBe(true);
    expect(authorize('192.168.1.20', null, '1234')).toBe(false);
    expect(authorize('192.168.1.20', '9999', '1234')).toBe(false);
    expect(authorize('192.168.1.20', '1234', '1234')).toBe(true);
  });

  it('الرمز من 4 أرقام', () => {
    for (let i = 0; i < 20; i++) expect(makePin()).toMatch(/^\d{4}$/);
  });
});
