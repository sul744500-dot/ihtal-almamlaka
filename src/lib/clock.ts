// ساعة اللعبة المشتركة: عند الاتصال بخادم المزامنة نصحح فرق التوقيت بين الأجهزة
// (مهم للجوال: المؤقت مبني على الطوابع الزمنية، وفرق ثانيتين بين ساعتي جهازين يفسد العد)

// للاختبار فقط: ?skew=5000 يحاكي جهازًا ساعته متقدمة 5 ثوانٍ (لا يُستخدم في اللعب العادي)
const skew = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('skew')) || 0 : 0;

let offset = 0;

/** وقت هذا الجهاز (مع محاكاة الفرق في وضع التطوير) */
export const localNow = (): number => Date.now() + skew;

/** الوقت المشترك بين كل الشاشات */
export const now = (): number => localNow() + offset;

export const getOffset = (): number => offset;

export function setOffset(ms: number): void {
  offset = ms;
}

export interface TimeSample {
  /** وقت الإرسال المحلي */
  t0: number;
  /** وقت الاستلام المحلي */
  t1: number;
  /** وقت الخادم عند الرد */
  server: number;
}

/** يختار العينة ذات أقل زمن ذهاب وإياب (الأدق) ويحسب الفرق عن ساعة الخادم */
export function estimateOffset(samples: TimeSample[]): { offset: number; rtt: number } | null {
  if (!samples.length) return null;
  const best = samples.reduce((a, b) => (b.t1 - b.t0 < a.t1 - a.t0 ? b : a));
  return { offset: Math.round(best.server - (best.t0 + best.t1) / 2), rtt: best.t1 - best.t0 };
}
