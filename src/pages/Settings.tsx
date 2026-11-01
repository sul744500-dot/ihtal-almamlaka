import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RulesForm } from '../components/RulesForm';
import { Shell } from '../components/Shell';
import { Button, Card, Segmented, Toggle } from '../components/ui';
import * as DB from '../lib/db';
import { downloadJson, readFileAsText, useScreenRole } from '../lib/hooks';
import { usePwa } from '../lib/pwa';
import { saveRelayMode, useRelay, type RelayMode } from '../lib/relay';
import { DEFAULT_RULES } from '../lib/rules';
import { sfx } from '../lib/sound';
import type { ControllerSound, SoundId } from '../lib/types';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';

function RelaySettings() {
  const relay = useRelay();
  const [mode, setMode] = useState<RelayMode>(relay.mode);
  const [custom, setCustom] = useState(relay.customUrl || 'ws://localhost:8787/ws');
  const statusText = { off: 'غير متصل', connecting: 'جارٍ الاتصال…', connected: 'متصل ✅', unauthorized: 'رمز PIN غير صحيح ⛔' }[relay.status];
  return (
    <Card title="خادم المزامنة (OBS والجوال)" icon="📡" className="mt-5">
      <p className="text-sm text-slate-300">
        يربط الشاشات خارج هذا المتصفح: مصدر المتصفح في OBS، وجوال على الشبكة نفسها كلوحة تحكم. شغّله عبر «تشغيل اللعبة.bat» أو الأمر <code dir="ltr">npm start</code> ثم افتح
        <code className="mx-1" dir="ltr">
          http://localhost:8787
        </code>
        — الاتصال تلقائي.
      </p>
      <div className="mt-3 text-sm">
        الحالة: <b className="text-gold-200">{statusText}</b>
        {relay.url && (
          <code className="ms-2 text-xs text-slate-400" dir="ltr">
            {relay.url.replace(/\?.*$/, '')}
          </code>
        )}
        {relay.status === 'connected' && relay.rtt !== null && <span className="ms-2 text-xs text-slate-400">({relay.rtt} م.ث)</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Segmented<RelayMode>
          value={mode}
          onChange={setMode}
          options={[
            { id: 'auto', label: 'تلقائي' },
            { id: 'custom', label: 'عنوان مخصص' },
            { id: 'off', label: 'إيقاف' },
          ]}
        />
        {mode === 'custom' && <input className="field max-w-xs" dir="ltr" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ws://192.168.1.10:8787/ws" />}
        <Button
          size="sm"
          variant="gold"
          onClick={() => {
            saveRelayMode(mode, custom);
            location.reload();
          }}
        >
          حفظ وإعادة التحميل
        </Button>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  useScreenRole('other');
  const { settings, update, reset } = useSettings();
  const toast = useGame((s) => s.toast);
  const pwa = usePwa();
  const importRef = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const [usedCount, setUsedCount] = useState(0);

  const refreshStorage = async () => {
    try {
      const est = await navigator.storage?.estimate?.();
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      if (est) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted });
    } catch {
      /* غير مدعوم */
    }
  };

  useEffect(() => {
    void refreshStorage();
    void DB.getUsage().then((u) => setUsedCount(Object.keys(u).length));
  }, []);

  const test = (id: SoundId) => {
    void sfx.unlock().then(() => sfx.play(id));
  };

  return (
    <Shell title="⚙️ الإعدادات">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="الصوت" icon="🔊">
          <Toggle label="المؤثرات الصوتية" desc="أصوات الحماس والإجابات والاحتلال (بدون موسيقى)" checked={settings.sfx} onChange={(v) => update({ sfx: v })} />
          <div className="py-2">
            <div className="mb-1 flex justify-between font-semibold">
              <span>مستوى الصوت</span>
              <span className="tabular-nums text-gold-200">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => update({ volume: Number(e.target.value) })} className="w-full accent-[#f6c443]" />
          </div>
          <div className="flex flex-wrap gap-2 py-2">
            {(
              [
                ['correct', 'صح'],
                ['wrong', 'خطأ'],
                ['capture', 'احتلال'],
                ['steal', 'سرقة'],
                ['remontada', 'ريمونتادا'],
                ['winner', 'الفوز'],
              ] as [SoundId, string][]
            ).map(([id, label]) => (
              <Button key={id} size="sm" variant="dark" onClick={() => test(id)}>
                ▶ {label}
              </Button>
            ))}
          </div>
          <div className="py-2">
            <div className="font-semibold">أصوات شاشة المقدم/اللعب</div>
            <div className="mb-2 text-sm text-slate-400">«تلقائي»: تصدر الأصوات من شاشة الجمهور فقط إذا كانت مفتوحة، حتى لا يتكرر الصوت في التسجيل.</div>
            <Segmented<ControllerSound>
              value={settings.controllerSound}
              onChange={(v) => update({ controllerSound: v })}
              options={[
                { id: 'auto', label: 'تلقائي' },
                { id: 'always', label: 'دائمًا' },
                { id: 'never', label: 'أبدًا' },
              ]}
            />
          </div>
        </Card>

        <Card title="العرض والمؤثرات" icon="✨">
          <Segmented
            value={settings.effectsLevel}
            onChange={(v) => update({ effectsLevel: v })}
            options={[
              { id: 'full', label: 'مؤثرات كاملة' },
              { id: 'lite', label: 'مؤثرات خفيفة (أجهزة أضعف)' },
            ]}
          />
          <Toggle label="تقليل الحركة" desc="يوقف الرسوم المتحركة والقصاصات" checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
          <Toggle label="إظهار أيقونة الفئة على المناطق" checked={settings.showCellCategories} onChange={(v) => update({ showCellCategories: v })} />
          <Toggle label="تنبيه انقطاع الاتصال على شاشة الجمهور" desc="شارة صغيرة إذا أُغلقت لوحة التحكم" checked={settings.audienceStatusBadge} onChange={(v) => update({ audienceStatusBadge: v })} />
        </Card>

        <Card title="لوحة المقدم" icon="🎛️">
          <Toggle label="إخفاء الإجابة حتى الضغط المطوّل" desc="مفيد إذا كانت شاشة المقدم تظهر في التصوير" checked={settings.hideAnswerOnHost} onChange={(v) => update({ hideAnswerOnHost: v })} />
          <Toggle label="اختصارات لوحة المفاتيح" desc="Enter، Space، C، X، R، 1-4، Ctrl+Z" checked={settings.shortcuts} onChange={(v) => update({ shortcuts: v })} />
        </Card>

        <Card title="الأسئلة" icon="📝">
          <Toggle label="تجنب الأسئلة المستخدمة سابقًا" desc="يفضّل الأسئلة التي لم تظهر في مباريات سابقة (مهم لحلقات يوتيوب المتتالية)" checked={settings.avoidUsedQuestions} onChange={(v) => update({ avoidUsedQuestions: v })} />
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-slate-300">استُخدم {usedCount} سؤالًا في مباريات سابقة.</span>
            <Button
              size="sm"
              variant="dark"
              disabled={!usedCount}
              onClick={async () => {
                if (!window.confirm('مسح سجل الأسئلة المستخدمة؟')) return;
                await DB.resetUsage();
                setUsedCount(0);
                toast('تم مسح سجل الاستخدام', 'success');
              }}
            >
              🧹 مسح السجل
            </Button>
            <Link to="/editor" className="btn btn-ghost rounded-lg px-3 py-1.5 text-sm">
              📝 محرر الأسئلة
            </Link>
          </div>
        </Card>
      </div>

      <Card
        title="القواعد الافتراضية للمباريات الجديدة"
        icon="📜"
        className="mt-5"
        actions={
          <Button size="sm" variant="dark" onClick={() => update({ defaultRules: DEFAULT_RULES })}>
            ↺ القيم الأصلية
          </Button>
        }
      >
        <RulesForm rules={settings.defaultRules} onChange={(patch) => update({ defaultRules: { ...settings.defaultRules, ...patch } })} />
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="البيانات والنسخ الاحتياطي" icon="💾">
          <p className="text-sm text-slate-300">كل شيء محفوظ في هذا المتصفح فقط (IndexedDB). صدّر نسخة احتياطية لنقلها إلى جهاز آخر.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={async () => {
                const data = await DB.exportAll();
                downloadJson(`ihtal-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
              }}
            >
              📤 تصدير نسخة احتياطية
            </Button>
            <Button variant="ghost" onClick={() => importRef.current?.click()}>
              📥 استيراد نسخة
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const res = await DB.importAll(JSON.parse(await readFileAsText(f)));
                  toast(`تم الاستيراد: ${res.questions} سؤال و${res.matches} مباراة`, 'success');
                  await useSettings.getState().load();
                  await useGame.getState().reloadBank();
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'ملف غير صالح', 'error');
                }
              }}
            />
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm('حذف كل المباريات والأسئلة المضافة والإعدادات من هذا المتصفح؟')) return;
                if (!window.confirm('تأكيد أخير: لا يمكن التراجع عن هذا الحذف. متابعة؟')) return;
                await DB.clearAllData();
                localStorage.clear();
                sessionStorage.clear();
                location.reload();
              }}
            >
              🗑 حذف كل البيانات
            </Button>
          </div>
          {storage && (
            <div className="mt-4 text-sm text-slate-400">
              المساحة المستخدمة: {(storage.usage / 1024 / 1024).toFixed(1)} م.ب من {(storage.quota / 1024 / 1024 / 1024).toFixed(1)} غ.ب •{' '}
              {storage.persisted ? '✅ تخزين دائم مفعّل' : '⚠️ التخزين قد يُمسح عند امتلاء الجهاز'}
              {!storage.persisted && (
                <Button
                  size="sm"
                  variant="dark"
                  className="ms-2"
                  onClick={async () => {
                    const ok = await navigator.storage?.persist?.();
                    toast(ok ? 'تم تفعيل التخزين الدائم' : 'رفض المتصفح الطلب — ثبّت التطبيق ثم أعد المحاولة', ok ? 'success' : 'warn');
                    void refreshStorage();
                  }}
                >
                  طلب تخزين دائم
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card title="التطبيق" icon="📲">
          {pwa.installed ? (
            <p className="text-emerald-300">✅ التطبيق مثبّت على هذا الجهاز.</p>
          ) : pwa.deferred ? (
            <Button variant="gold" onClick={() => void pwa.install()}>
              📲 تثبيت «احتلّ المملكة» كتطبيق
            </Button>
          ) : (
            <p className="text-sm text-slate-300">لتثبيت التطبيق: افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» (يتطلب رابط HTTPS أو localhost).</p>
          )}
          <p className="mt-3 text-sm text-slate-400">بعد التثبيت يعمل التطبيق دون إنترنت، ويحفظ كل شيء محليًا. لا يوجد تسجيل دخول.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="dark"
              onClick={() => {
                if (window.confirm('إعادة كل الإعدادات إلى قيمها الافتراضية؟')) reset();
              }}
            >
              ↺ إعادة ضبط الإعدادات
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-500">الإصدار 1.1.0</p>
        </Card>
      </div>

      <RelaySettings />
    </Shell>
  );
}
