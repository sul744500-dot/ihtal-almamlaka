import { useEffect, useMemo, useRef, useState } from 'react';
import { useSoundOn } from '../components/FxDirector';
import { Stage } from '../components/Stage';
import { AudienceStage } from '../components/stage/AudienceStage';
import { useFullscreen, useScreenRole, useWakeLock } from '../lib/hooks';
import { sfx } from '../lib/sound';
import { useControllerOnline, useGame } from '../store/game';
import { useSettings } from '../store/settings';

/** شاشة الجمهور: عرض فقط، بدون أي إجابات قبل أن يسمح المقدم */
export function Audience() {
  useScreenRole('audience');
  useWakeLock();
  const sound = useSoundOn();
  const ready = useGame((s) => s.ready);
  const hasMatch = useGame((s) => !!s.record);
  const controllerOnline = useControllerOnline();
  const badge = useSettings((s) => s.settings.audienceStatusBadge);
  const sfxEnabled = useSettings((s) => s.settings.sfx);
  const [fs, toggleFs] = useFullscreen();
  const [unlocked, setUnlocked] = useState(sfx.unlocked);
  const [chrome, setChrome] = useState(true);
  const [offlineLong, setOfflineLong] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ?obs=1 لمصدر المتصفح في OBS: صورة نظيفة تمامًا بلا أزرار أو تنبيهات
  const obs = useMemo(() => new URLSearchParams(location.search).has('obs'), []);

  // بعض البيئات (مثل OBS) تسمح بالصوت دون نقرة: نجرب التفعيل تلقائيًا
  useEffect(() => {
    void sfx.unlock().then((ok) => ok && setUnlocked(true));
  }, []);

  useEffect(() => {
    document.title = 'شاشة الجمهور — احتلّ المملكة';
    const poke = () => {
      setChrome(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setChrome(false), 2500);
    };
    poke();
    window.addEventListener('mousemove', poke);
    return () => window.removeEventListener('mousemove', poke);
  }, []);

  // نُظهر تنبيه انقطاع الاتصال فقط إذا استمر أكثر من 5 ثوانٍ
  useEffect(() => {
    if (controllerOnline) {
      setOfflineLong(false);
      return;
    }
    const t = setTimeout(() => setOfflineLong(true), 5000);
    return () => clearTimeout(t);
  }, [controllerOnline]);

  const unlock = async () => setUnlocked(await sfx.unlock());

  return (
    <div className="relative h-full w-full bg-black" style={{ cursor: chrome && !obs ? 'default' : 'none' }} onDoubleClick={toggleFs} onClick={() => !unlocked && void unlock()}>
      <Stage>
        <AudienceStage sound={sound} />
      </Stage>

      {!unlocked && sfxEnabled && !obs && (
        <div className="absolute inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm">
          <button type="button" onClick={() => void unlock()} className="btn btn-gold px-10 py-5 text-2xl">
            🔊 اضغط لتفعيل الصوت
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void unlock();
              toggleFs();
            }}
            className="btn btn-ghost"
          >
            ⛶ تفعيل الصوت + ملء الشاشة
          </button>
          <p className="max-w-md text-center text-sm text-slate-300">المتصفحات تمنع تشغيل الصوت قبل أول نقرة. انقر مرتين في أي وقت للتبديل إلى ملء الشاشة.</p>
        </div>
      )}

      {chrome && unlocked && !obs && (
        <div className="absolute start-3 top-3 z-[250] flex gap-2">
          <button type="button" onClick={toggleFs} className="btn btn-dark rounded-lg px-3 py-1.5 text-sm">
            {fs ? '🗗 الخروج من ملء الشاشة' : '⛶ ملء الشاشة'}
          </button>
        </div>
      )}

      {badge && ready && hasMatch && offlineLong && !obs && (
        <div className="absolute bottom-3 start-3 z-[250] rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-amber-300">⚠️ لوحة التحكم غير متصلة — تُعرض آخر حالة محفوظة</div>
      )}
    </div>
  );
}
