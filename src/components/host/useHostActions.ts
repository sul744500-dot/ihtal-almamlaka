import { useHotkeys } from '../../lib/hooks';
import { useGame } from '../../store/game';
import { useSettings } from '../../store/settings';

/** أوامر المقدم المشتركة بين لوحة التحكم وشاشة اللعب */
export function useHostActions() {
  const s = useGame((st) => st.record?.state ?? null);
  const pastLen = useGame((st) => st.record?.past.length ?? 0);
  const dispatch = useGame((st) => st.dispatch);
  const drawQuestion = useGame((st) => st.drawQuestion);
  const replaceQuestion = useGame((st) => st.replaceQuestion);
  const judgePicked = useGame((st) => st.judgePicked);
  const undo = useGame((st) => st.undo);
  const c = s?.current ?? null;
  const running = !!c && c.timer.startedAt !== null;

  const actions = {
    s,
    c,
    running,
    canUndo: pastLen > 0,
    pastLen,
    dispatch,
    select: (id: number | null) => dispatch({ type: 'SELECT_CELL', cellId: id }),
    draw: () => drawQuestion(),
    replace: () => replaceQuestion(),
    cancel: () => dispatch({ type: 'CANCEL_QUESTION' }),
    toggleTimer: () => dispatch({ type: running ? 'TIMER_PAUSE' : 'TIMER_START' }),
    resetTimer: () => dispatch({ type: 'TIMER_RESET' }),
    addTime: (sec: number) => dispatch({ type: 'TIMER_ADD', ms: sec * 1000 }),
    judge: (correct: boolean) => dispatch({ type: 'JUDGE', correct }),
    confirmPick: () => judgePicked(),
    pick: (i: number) => dispatch({ type: 'PICK_OPTION', index: c?.picked === i ? null : i }),
    reveal: (v?: boolean) => dispatch({ type: 'REVEAL', value: v ?? !c?.revealed }),
    next: () => dispatch({ type: 'NEXT_TURN' }),
    undo,
    /** الزر الرئيسي حسب المرحلة (Enter) */
    primary: () => {
      if (!s) return;
      if (s.phase === 'select' && s.selectedCell !== null) drawQuestion();
      else if (s.phase === 'question' && c?.picked !== null && c?.q.type === 'mcq') judgePicked();
      else if (s.phase === 'result') dispatch({ type: 'NEXT_TURN' });
      else if (s.phase === 'tiebreak' && !c) drawQuestion();
    },
  };
  return actions;
}

export type HostActions = ReturnType<typeof useHostActions>;

export function useHostHotkeys(a: HostActions): void {
  const enabled = useSettings((st) => st.settings.shortcuts);
  const map: Record<string, () => void> = {
    Space: () => a.c && !a.c.result && a.toggleTimer(),
    Enter: () => a.primary(),
    NumpadEnter: () => a.primary(),
    KeyC: () => a.s?.phase === 'question' && a.judge(true),
    KeyX: () => a.s?.phase === 'question' && a.judge(false),
    KeyR: () => a.c && a.reveal(),
    KeyN: () => a.next(),
    KeyT: () => a.c && a.addTime(5),
    'Ctrl+KeyZ': () => a.undo(),
  };
  for (let i = 0; i < 6; i++) {
    map[`Digit${i + 1}`] = () => a.c && a.c.q.type === 'mcq' && i < a.c.q.options.length && a.pick(i);
    map[`Numpad${i + 1}`] = map[`Digit${i + 1}`];
  }
  useHotkeys(map, enabled);
}

export const SHORTCUTS: [string, string][] = [
  ['Enter', 'الإجراء التالي (عرض السؤال / تأكيد / الدور التالي)'],
  ['Space', 'تشغيل/إيقاف المؤقت'],
  ['1-4', 'تحديد خيار الفريق'],
  ['C', 'إجابة صحيحة'],
  ['X', 'إجابة خاطئة'],
  ['R', 'كشف/إخفاء الإجابة للجمهور'],
  ['T', '+5 ثوانٍ'],
  ['N', 'الدور التالي'],
  ['Ctrl+Z', 'تراجع عن آخر حركة'],
];
