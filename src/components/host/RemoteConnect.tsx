import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useRelay } from '../../lib/relay';
import { useAudienceCount, useGame, useRemoteControllerCount } from '../../store/game';
import { Button, Modal } from '../ui';

function useQr(text: string | null): string | null {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return setSvg(null);
    let alive = true;
    void QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1736', light: '#ffffff' } }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [text]);
  return svg;
}

function CopyLine({ value }: { value: string }) {
  const toast = useGame((s) => s.toast);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-navy-950/80 px-3 py-2 text-sm text-gold-100" dir="ltr">
        {value}
      </code>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast('تم نسخ الرابط', 'success');
          } catch {
            toast('تعذر النسخ — انسخ الرابط يدويًا', 'warn');
          }
        }}
      >
        📋 نسخ
      </Button>
    </div>
  );
}

function PhoneLink({ url }: { url: string }) {
  const qr = useQr(url);
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-start">
      <div className="h-36 w-36 shrink-0 overflow-hidden rounded-xl bg-white p-1 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr ?? '' }} />
      <div className="flex w-full min-w-0 flex-col gap-2">
        <p className="text-sm text-slate-300">امسح الرمز بكاميرا الجوال (على شبكة الواي فاي نفسها) لتفتح لوحة المقدم وتتحكم من الجوال.</p>
        <CopyLine value={url} />
      </div>
    </div>
  );
}

/** شارة صغيرة لحالة خادم المزامنة */
export function RelayBadge({ onClick }: { onClick?: () => void }) {
  const status = useRelay((s) => s.status);
  const remote = useRemoteControllerCount();
  const label =
    status === 'connected' ? `📡 الخادم متصل${remote ? ` • 📱 ${remote}` : ''}` : status === 'connecting' ? '📡 جارٍ الاتصال…' : status === 'unauthorized' ? '📡 رمز الجوال خاطئ' : '📱 الجوال وOBS';
  const tone = status === 'connected' ? 'bg-sky-500/15 text-sky-200' : status === 'unauthorized' ? 'bg-red-500/15 text-red-300' : 'bg-white/5 text-slate-300';
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold hover:brightness-125 ${tone}`}>
      {label}
    </button>
  );
}

export function RemoteConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status, info, rtt, offset, url } = useRelay();
  const audience = useAudienceCount();
  const remote = useRemoteControllerCount();
  const port = info?.port ?? 8787;
  const obsUrl = `http://localhost:${port}/?obs=1#/audience`;
  const phoneUrls = (info?.lanUrls ?? []).map((u) => `${u}/?pin=${info?.pin}#/host`);

  return (
    <Modal open={open} onClose={onClose} title="📱 الجوال وOBS — خادم المزامنة" width="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div
          className={`rounded-2xl border p-3 text-sm ${
            status === 'connected' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : status === 'unauthorized' ? 'border-red-400/50 bg-red-500/10 text-red-100' : 'border-amber-400/40 bg-amber-500/10 text-amber-100'
          }`}
        >
          {status === 'connected' && (
            <>
              ✅ متصل بخادم المزامنة{rtt !== null ? ` • زمن الاستجابة ${rtt} م.ث` : ''}
              {Math.abs(offset) > 50 ? ` • تم تصحيح فرق الساعة ${(offset / 1000).toFixed(1)} ث` : ''}
              <div className="mt-1 text-xs opacity-80">
                شاشات الجمهور المتصلة: {audience} • أجهزة تحكم بعيدة: {remote}
              </div>
            </>
          )}
          {status === 'connecting' && '⏳ جارٍ الاتصال بخادم المزامنة…'}
          {status === 'unauthorized' && '⛔ رمز الجوال (PIN) غير صحيح. افتح الرابط الجديد من شاشة الكمبيوتر.'}
          {status === 'off' && (
            <>
              خادم المزامنة غير مشغّل. التزامن الآن بين نوافذ هذا المتصفح فقط.
              <div className="mt-2 text-xs opacity-90">
                لتشغيله: انقر مرتين على «تشغيل اللعبة.bat» (أو الأمر <code dir="ltr">npm start</code>) ثم افتح اللعبة من
                <code className="mx-1" dir="ltr">
                  http://localhost:8787
                </code>
                بدل العنوان الحالي.
              </div>
            </>
          )}
        </div>

        {status === 'connected' && info?.pin && (
          <>
            <section className="flex flex-col gap-2">
              <h4 className="font-display text-lg font-bold text-gold-200">📺 OBS — مصدر متصفح (Browser Source)</h4>
              <CopyLine value={obsUrl} />
              <ul className="list-disc space-y-1 ps-5 text-sm text-slate-300">
                <li>العرض 1920 والارتفاع 1080.</li>
                <li>فعّل «Control audio via OBS» لالتقاط المؤثرات الصوتية داخل OBS.</li>
                <li>
                  الرابط ينتهي بـ{' '}
                  <bdi dir="ltr" className="font-mono">
                    ?obs=1
                  </bdi>{' '}
                  : صورة نظيفة بلا أزرار أو تنبيهات.
                </li>
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="font-display text-lg font-bold text-gold-200">📱 التحكم من الجوال</h4>
              {phoneUrls.length ? phoneUrls.map((u) => <PhoneLink key={u} url={u} />) : <p className="text-sm text-slate-400">لم يُعثر على اتصال شبكة محلية في هذا الكمبيوتر.</p>}
              <p className="text-xs text-slate-400">
                رمز الجوال: <b className="text-gold-200">{info.pin}</b> — يتغير عند كل تشغيل للخادم. إذا لم يفتح الرابط، اسمح لـ Node.js عبر جدار حماية ويندوز (الشبكات الخاصة).
                الأسئلة تُختار من بنك هذا الكمبيوتر حتى عند الضغط من الجوال.
              </p>
            </section>
          </>
        )}

        {status === 'connected' && !info?.pin && url && (
          <p className="text-sm text-slate-300">
            هذا الجهاز متصل عبر <code dir="ltr">{url.replace(/\?.*$/, '')}</code>. روابط OBS والجوال تظهر في لوحة المقدم على الكمبيوتر الذي يشغّل الخادم.
          </p>
        )}
      </div>
    </Modal>
  );
}
