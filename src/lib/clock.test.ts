import { describe, expect, it } from 'vitest';
import { estimateOffset } from './clock';

describe('مزامنة الساعة', () => {
  it('تأخذ العينة الأسرع وتحسب فرق الساعة', () => {
    // ساعة الجوال متأخرة 3 ثوانٍ عن الخادم
    const r = estimateOffset([
      { t0: 1000, t1: 1400, server: 4300 },
      { t0: 2000, t1: 2040, server: 5020 },
      { t0: 3000, t1: 3200, server: 6050 },
    ]);
    expect(r?.rtt).toBe(40);
    expect(r?.offset).toBe(3000);
  });

  it('بدون عينات لا يوجد تصحيح', () => {
    expect(estimateOffset([])).toBeNull();
  });
});
