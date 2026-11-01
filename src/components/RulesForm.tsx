import type { Rules } from '../lib/types';
import { Stepper, Toggle } from './ui';

/** نموذج تعديل القواعد (يُستخدم عند إنشاء المباراة وفي الإعدادات الافتراضية وأثناء المباراة) */
export function RulesForm({ rules, onChange, live = false }: { rules: Rules; onChange: (patch: Partial<Rules>) => void; live?: boolean }) {
  return (
    <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
      <div>
        <h3 className="mb-1 mt-2 font-display text-base font-bold text-gold-300">⏱️ الإيقاع</h3>
        <Stepper label="عدد الجولات" desc={`كل جولة = دور لكل فريق (${rules.rounds * 2} سؤالًا)`} value={rules.rounds} min={1} max={60} onChange={(v) => onChange({ rounds: v })} />
        <Stepper label="مدة الإجابة" value={rules.answerSeconds} min={5} max={120} step={1} suffix="ث" onChange={(v) => onChange({ answerSeconds: v })} />
        <Toggle label="تشغيل المؤقت تلقائيًا" desc="يبدأ العد فور ظهور السؤال" checked={rules.autoStartTimer} onChange={(v) => onChange({ autoStartTimer: v })} />
        <Toggle label="كشف الإجابة تلقائيًا بعد الحكم" checked={rules.autoReveal} onChange={(v) => onChange({ autoReveal: v })} />

        <h3 className="mb-1 mt-4 font-display text-base font-bold text-gold-300">🏴 النقاط والمناطق</h3>
        <Stepper label="قيمة المنطقة العادية" value={rules.normalValue} min={1} max={5} onChange={(v) => onChange({ normalValue: v })} />
        <Stepper label="قيمة المنطقة الذهبية" value={rules.goldenValue} min={1} max={10} onChange={(v) => onChange({ goldenValue: v })} />
        {!live && <Stepper label="عدد المناطق الذهبية" value={rules.goldenCount} min={0} max={8} onChange={(v) => onChange({ goldenCount: v })} />}
        {!live && <Toggle label="منطقة التاج 👑" desc="في منتصف اللوحة، مقفلة حتى الجولات الأخيرة" checked={rules.crownEnabled} onChange={(v) => onChange({ crownEnabled: v })} />}
        <Stepper label="قيمة منطقة التاج" value={rules.crownValue} min={1} max={10} disabled={!rules.crownEnabled} onChange={(v) => onChange({ crownValue: v })} />
        <Stepper label="يظهر التاج في آخر" value={rules.crownRounds} min={1} max={rules.rounds} suffix="جولات" disabled={!rules.crownEnabled} onChange={(v) => onChange({ crownRounds: v })} />
      </div>
      <div>
        <h3 className="mb-1 mt-2 font-display text-base font-bold text-gold-300">⚔️ الهجوم والحماية</h3>
        <Toggle label="سرقة مناطق الخصم" desc="الهجوم بسؤال أصعب لنقل منطقة الخصم" checked={rules.stealEnabled} onChange={(v) => onChange({ stealEnabled: v })} />
        <Toggle label="حصانة بعد السرقة" desc="لا يمكن استرجاع المنطقة المسروقة في الدور التالي مباشرة" checked={rules.stealImmunity} onChange={(v) => onChange({ stealImmunity: v })} disabled={!rules.stealEnabled} />
        <Toggle label="فرصة الرد للخصم" desc="عند الخطأ في منطقة محايدة يجيب الخصم ليأخذها" checked={rules.reboundEnabled} onChange={(v) => onChange({ reboundEnabled: v })} />
        <Stepper label="مدة فرصة الرد" value={rules.reboundSeconds} min={3} max={60} suffix="ث" disabled={!rules.reboundEnabled} onChange={(v) => onChange({ reboundSeconds: v })} />

        <h3 className="mb-1 mt-4 font-display text-base font-bold text-gold-300">✨ القدرات والمفاجآت</h3>
        <Toggle label="القدرات الخاصة" desc="تُكسب من المناطق الذهبية وعجلة الحظ" checked={rules.abilitiesEnabled} onChange={(v) => onChange({ abilitiesEnabled: v })} />
        <Stepper label="أقصى عدد قدرات لكل فريق" value={rules.maxAbilities} min={1} max={4} disabled={!rules.abilitiesEnabled} onChange={(v) => onChange({ maxAbilities: v })} />
        <Stepper label="مدة الدرع" value={rules.shieldTurns / 2} min={1} max={6} suffix="جولات" onChange={(v) => onChange({ shieldTurns: v * 2 })} />
        <Stepper label="الوقت الإضافي" value={rules.extraTimeSeconds} min={3} max={30} suffix="ث" onChange={(v) => onChange({ extraTimeSeconds: v })} />
        <Stepper label="أحداث مفاجئة في المباراة" desc="حد أقصى حتى لا تصبح النتيجة عشوائية" value={rules.eventsCount} min={0} max={5} onChange={(v) => onChange({ eventsCount: v })} />
        <Stepper label="عجلة الحظ كل" desc="0 = معطلة. تدور للفريق المتأخر" value={rules.wheelEvery} min={0} max={20} suffix="جولات" onChange={(v) => onChange({ wheelEvery: v })} />
        <Toggle label="الجولة النهائية الحاسمة" desc="تسقط الدروع، وكل سرقة ناجحة تمنح نقطة إضافية" checked={rules.finalRoundEnabled} onChange={(v) => onChange({ finalRoundEnabled: v })} />
        <Toggle label="جولة فاصلة عند التعادل" checked={rules.tiebreakEnabled} onChange={(v) => onChange({ tiebreakEnabled: v })} />
        <Stepper label="فارق «الريمونتادا»" desc="قلب تأخر بهذا الفارق يطلق احتفال الريمونتادا" value={rules.remontadaGap} min={2} max={20} onChange={(v) => onChange({ remontadaGap: v })} />
      </div>
    </div>
  );
}
