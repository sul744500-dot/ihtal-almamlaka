import { useState } from 'react';
import { eventAvailable, isFinalRound, isShielded, targetInfo } from '../../lib/engine';
import { ABILITY_INFO, CATEGORY_MAP, EVENT_IDS, EVENT_INFO, TEAM_COLORS } from '../../lib/meta';
import { cellValue, computeScores } from '../../lib/scoring';
import { SOUNDBOARD } from '../../lib/sound';
import type { AbilityId, GameState, TeamId } from '../../lib/types';
import { Emblem } from '../Brand';
import { Board } from '../Board';
import { Button, Modal } from '../ui';
import type { HostActions } from './useHostActions';

export type PickMode = { kind: 'shield'; team: TeamId } | null;

/** اللوحة المصغرة للمقدم: اختيار منطقة، أو وضع درع، أو تعديل يدوي */
export function MiniBoard({ a, pick, setPick }: { a: HostActions; pick: PickMode; setPick: (p: PickMode) => void }) {
  const [editId, setEditId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const s = a.s!;
  const onClick = (id: number) => {
    if (pick?.kind === 'shield') {
      if (a.dispatch({ type: 'USE_ABILITY', team: pick.team, ability: 'shield', cellId: id })) setPick(null);
      return;
    }
    if (editMode) {
      setEditId(id);
      return;
    }
    if (s.phase === 'select') a.select(s.selectedCell === id ? null : id);
  };
  const clickable = !!pick || editMode || s.phase === 'select';
  const shieldTargets = pick?.kind === 'shield';
  return (
    <div className="flex flex-col gap-3">
      {pick?.kind === 'shield' && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-cyan-300/50 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-100">
          🛡️ اختر منطقة لـ{s.teams[pick.team].name} لحمايتها
          <Button size="sm" variant="dark" onClick={() => setPick(null)}>
            إلغاء
          </Button>
        </div>
      )}
      <div className={shieldTargets ? 'rounded-xl ring-2 ring-cyan-300/60' : ''}>
        <Board state={s} size="compact" onCellClick={clickable ? onClick : undefined} highlightTargets={s.phase === 'select' && !pick && !editMode} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>⭐ ذهبية = {s.rules.goldenValue} • 👑 التاج = {s.rules.crownValue} • 🛡️ درع • 🔒 حصانة</span>
        <Button size="sm" variant={editMode ? 'gold' : 'dark'} onClick={() => setEditMode((v) => !v)}>
          ✏️ {editMode ? 'إنهاء التعديل اليدوي' : 'تعديل يدوي للمناطق'}
        </Button>
      </div>
      <CellEditor s={s} a={a} id={editId} onClose={() => setEditId(null)} />
    </div>
  );
}

function CellEditor({ s, a, id, onClose }: { s: GameState; a: HostActions; id: number | null; onClose: () => void }) {
  const cell = id !== null ? s.cells[id] : null;
  return (
    <Modal open={!!cell} onClose={onClose} title={cell ? `تعديل «${cell.name}»` : ''} width="max-w-md">
      {cell && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-400">التعديل اليدوي لتصحيح الأخطاء فقط، ويمكن التراجع عنه.</p>
          <div>
            <div className="mb-2 font-bold">المالك</div>
            <div className="grid grid-cols-3 gap-2">
              {(['red', 'blue', null] as (TeamId | null)[]).map((o) => (
                <Button key={String(o)} variant={cell.owner === o ? 'gold' : o ?? 'dark'} onClick={() => a.dispatch({ type: 'SET_OWNER', cellId: cell.id, owner: o })}>
                  {o ? s.teams[o].name : 'محايدة'}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="dark" disabled={!cell.owner} onClick={() => a.dispatch({ type: 'TOGGLE_SHIELD', cellId: cell.id })}>
              🛡️ {isShielded(s, cell) ? 'إزالة الدرع' : 'إضافة درع'}
            </Button>
            {cell.kind !== 'crown' && (
              <Button variant="dark" onClick={() => a.dispatch({ type: 'SET_CELL_KIND', cellId: cell.id, kind: cell.kind === 'golden' ? 'normal' : 'golden' })}>
                ⭐ {cell.kind === 'golden' ? 'جعلها عادية' : 'جعلها ذهبية'}
              </Button>
            )}
          </div>
          <div className="text-sm text-slate-400">
            الفئة: {cell.category ? CATEGORY_MAP[cell.category].name : 'مختلطة'} • القيمة: {cellValue(cell, s.rules)} • عدد مرات الاحتلال: {cell.captures}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function TeamsControl({ a, setPick }: { a: HostActions; setPick: (p: PickMode) => void }) {
  const s = a.s!;
  const sc = computeScores(s);
  const c = s.current;
  const canUse = (team: TeamId, ab: AbilityId): string | null => {
    if (s.phase === 'finished') return 'انتهت المباراة';
    if (ab === 'shield') {
      if (isFinalRound(s)) return 'الدروع معطلة في الجولة النهائية';
      return s.cells.some((x) => x.owner === team && !isShielded(s, x)) ? null : 'لا توجد منطقة لحمايتها';
    }
    if (!c || c.result) return 'يُستخدم أثناء السؤال';
    if (c.answering !== team) return 'ليس دور هذا الفريق';
    if (ab === 'fifty' && (c.q.type !== 'mcq' || c.hiddenOptions.length > 0)) return 'لأسئلة الاختيارات فقط';
    if (ab === 'second' && (c.rebound || c.secondChance !== 'none')) return 'غير متاح الآن';
    return null;
  };
  return (
    <div className="grid grid-cols-1 gap-3">
      {(['red', 'blue'] as TeamId[]).map((team) => {
        const t = s.teams[team];
        const col = TEAM_COLORS[team];
        const active = s.phase === 'question' ? c?.answering === team : s.activeTeam === team && s.phase === 'select';
        return (
          <div key={team} className="rounded-2xl border-2 p-3" style={{ borderColor: active ? '#ffe7a3' : `${col.main}66`, background: `linear-gradient(135deg, ${col.dark}aa, rgba(8,17,41,0.9))` }}>
            <div className="flex items-center gap-3">
              <Emblem value={t.emblem} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-bold">{t.name}</div>
                <div className="text-xs text-slate-300">
                  {sc[team].cells} مناطق • {sc[team].cellPoints} نقاط مناطق • مكافآت {sc[team].bonus >= 0 ? '+' : ''}
                  {sc[team].bonus}
                </div>
              </div>
              <div className="font-impact text-5xl leading-none" style={{ color: col.light }}>
                {sc[team].total}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="dark" onClick={() => a.dispatch({ type: 'ADJUST_BONUS', team, delta: 1, reason: 'قرار المقدم' })}>
                +1
              </Button>
              <Button size="sm" variant="dark" onClick={() => a.dispatch({ type: 'ADJUST_BONUS', team, delta: -1, reason: 'قرار المقدم' })}>
                −1
              </Button>
              <span className="mx-1 h-5 w-px bg-white/15" />
              {s.rules.abilitiesEnabled && t.abilities.length === 0 && <span className="text-xs text-slate-400">لا قدرات</span>}
              {t.abilities.map((ab, i) => {
                const reason = canUse(team, ab);
                return (
                  <Button
                    key={`${ab}${i}`}
                    size="sm"
                    variant="ghost"
                    disabled={!!reason}
                    title={reason ?? ABILITY_INFO[ab].desc}
                    onClick={() => (ab === 'shield' ? setPick({ kind: 'shield', team }) : a.dispatch({ type: 'USE_ABILITY', team, ability: ab }))}
                  >
                    {ABILITY_INFO[ab].icon} {ABILITY_INFO[ab].name}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ToolsControl({ a }: { a: HostActions }) {
  const s = a.s!;
  const [title, setTitle] = useState('');
  const [sub, setSub] = useState('');
  const finished = s.phase === 'finished';
  const eventsLeft = Math.max(0, s.rules.eventsCount - s.eventsUsed);
  const spinning = !!s.wheel && !s.wheel.applied;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold">🎡 عجلة الحظ</span>
          {s.wheelPending && <span className="text-xs font-bold text-fuchsia-300">موعدها الآن: {s.teams[s.wheelPending].name}</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['red', 'blue'] as TeamId[]).map((t) => (
            <Button key={t} size="sm" variant={s.wheelPending === t ? 'gold' : 'dark'} disabled={finished || spinning} onClick={() => a.dispatch({ type: 'SPIN_WHEEL', team: t })}>
              تدوير لـ{s.teams[t].name}
            </Button>
          ))}
        </div>
        {s.wheel && (
          <Button size="sm" variant="dark" className="mt-2 w-full" onClick={() => a.dispatch({ type: 'WHEEL_CLOSE' })}>
            إغلاق العجلة
          </Button>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold">⚡ أحداث مفاجئة</span>
          <span className={`text-xs font-bold ${eventsLeft ? 'text-slate-300' : 'text-amber-300'}`}>
            المتبقي {eventsLeft} من {s.rules.eventsCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_IDS.map((ev) => {
            const ok = eventAvailable(s, ev);
            return (
              <Button
                key={ev}
                size="sm"
                variant="dark"
                disabled={!ok}
                title={EVENT_INFO[ev].desc}
                onClick={() => {
                  if (eventsLeft <= 0 && !window.confirm('تجاوزت عدد الأحداث المحدد للمباراة. تشغيل الحدث على أي حال؟')) return;
                  a.dispatch({ type: 'TRIGGER_EVENT', event: ev });
                }}
              >
                {EVENT_INFO[ev].icon} {EVENT_INFO[ev].name}
              </Button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 font-bold">🔊 لوحة المؤثرات</div>
        <div className="grid grid-cols-5 gap-1.5">
          {SOUNDBOARD.map((x) => (
            <button key={x.id} type="button" title={x.name} onClick={() => a.dispatch({ type: 'SFX', sound: x.id })} className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 py-1.5 text-xs hover:bg-white/10">
              <span className="text-xl">{x.icon}</span>
              {x.name}
            </button>
          ))}
        </div>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (a.dispatch({ type: 'ANNOUNCE', title, sub })) {
            setTitle('');
            setSub('');
          }
        }}
      >
        <div className="font-bold">📢 إعلان على شاشة الجمهور</div>
        <input className="field" placeholder="العنوان (مثال: استراحة قصيرة!)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} />
        <input className="field" placeholder="نص إضافي (اختياري)" value={sub} onChange={(e) => setSub(e.target.value)} maxLength={90} />
        <Button variant="ghost" size="sm" disabled={!title.trim()} onClick={() => a.dispatch({ type: 'ANNOUNCE', title, sub }) && (setTitle(''), setSub(''))}>
          عرض الإعلان
        </Button>
      </form>

      {!finished && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (window.confirm('إنهاء المباراة الآن وإعلان النتيجة؟')) a.dispatch({ type: 'FINISH' });
          }}
        >
          🏁 إنهاء المباراة الآن
        </Button>
      )}
    </div>
  );
}

export function LogPanel({ s, limit = 40 }: { s: GameState; limit?: number }) {
  const items = s.log.slice(-limit).reverse();
  return (
    <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto pe-1 text-sm">
      {items.map((e) => (
        <li key={e.id} className="flex items-start gap-2 rounded-lg px-2 py-1 hover:bg-white/5">
          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.team ? TEAM_COLORS[e.team].main : '#f6c443' }} />
          <span className="flex-1 text-slate-200">{e.text}</span>
          <span className="shrink-0 text-xs text-slate-500">ج{e.round}</span>
        </li>
      ))}
      {!items.length && <li className="text-slate-500">لا توجد أحداث بعد</li>}
    </ol>
  );
}

export function CellHint({ s, id }: { s: GameState; id: number }) {
  const info = targetInfo(s, id);
  return <span className="text-xs text-slate-400">{info.ok ? (info.mode === 'attack' ? 'هجوم' : 'احتلال') : info.reason}</span>;
}
