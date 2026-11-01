// منطق خادم المزامنة القابل للاختبار (بدون شبكة)
import { randomInt } from 'node:crypto';

/**
 * هل الحالة r أحدث من mine؟ نفس قاعدة المتصفح:
 * مباراة مختلفة ← الأحدث تفعيلًا، نفس المباراة ← رقم المراجعة ثم وقت التحديث ثم مصدر التعديل.
 * @param {{id:string, rev:number, activeAt?:number, updatedAt?:number, origin?:string}} r
 * @param {{id:string, rev:number, activeAt?:number, updatedAt?:number, origin?:string} | null | undefined} mine
 */
export function isNewerState(r, mine) {
  if (!mine) return true;
  if (r.id !== mine.id) return (r.activeAt ?? 0) > (mine.activeAt ?? 0);
  if (r.rev !== mine.rev) return r.rev > mine.rev;
  if ((r.updatedAt ?? 0) !== (mine.updatedAt ?? 0)) return (r.updatedAt ?? 0) > (mine.updatedAt ?? 0);
  return String(r.origin ?? '') > String(mine.origin ?? '');
}

/** اتصال من الجهاز نفسه (المتصفح أو OBS) لا يحتاج رمزًا */
export function isLoopback(addr) {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/, '');
  return a === '::1' || a === 'localhost' || a.startsWith('127.');
}

export function makePin() {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

/** يقرر هل يُسمح بالاتصال: الأجهزة الأخرى تحتاج الرمز الصحيح */
export function authorize(remoteAddress, providedPin, pin) {
  return isLoopback(remoteAddress) || (!!pin && providedPin === pin);
}
