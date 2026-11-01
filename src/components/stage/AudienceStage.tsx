import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { useEffect, useMemo } from 'react';
import { computeScores } from '../../lib/scoring';
import { currentStreaks } from '../../lib/stats';
import type { GameState } from '../../lib/types';
import { useGame } from '../../store/game';
import { useFx } from '../../store/fx';
import { Backdrop, Logo } from '../Brand';
import { Board } from '../Board';
import { FxDirector, TimerTicker } from '../FxDirector';
import { Banners } from './Banners';
import { StageQuestion } from './StageQuestion';
import { Ticker, TeamPanel, TopBar } from './StageParts';
import { WheelOverlay } from './Wheel';
import { StatsStage, WinnerOverlay } from './Winner';

/** النقاط المعروضة تتأخر حتى تنتهي حركة الاحتلال، لتبقى المفاجأة على الشاشة */
function useDisplayState(s: GameState): GameState {
  const pending = useFx((st) => st.pendingOwners);
  return useMemo(() => {
    const ids = Object.keys(pending);
    if (!ids.length) return s;
    return { ...s, cells: s.cells.map((c) => (c.id in pending ? { ...c, owner: pending[c.id] } : c)) };
  }, [s, pending]);
}

export function IdleStage() {
  return (
    <div className="relative h-[1080px] w-[1920px] overflow-hidden" dir="rtl">
      <Backdrop />
      <div className="relative flex h-full flex-col items-center justify-center gap-10">
        <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <Logo size="xl" />
        </motion.div>
        <p className="font-display text-[44px] font-bold text-gold-100/80" style={{ animation: 'glow 2.4s ease-in-out infinite' }}>
          بانتظار بدء المباراة…
        </p>
      </div>
    </div>
  );
}

export function AudienceStage({ sound, onCellClick }: { sound: boolean; onCellClick?: (id: number) => void }) {
  const state = useGame((st) => st.record?.state);
  return (
    <>
      <FxDirector sound={sound} visuals />
      <TimerTicker sound={sound} />
      {state ? <StageContent s={state} sound={sound} onCellClick={onCellClick} /> : <IdleStage />}
    </>
  );
}

function StageContent({ s: raw, sound, onCellClick }: { s: GameState; sound: boolean; onCellClick?: (id: number) => void }) {
  const s = useDisplayState(raw);
  const scores = useMemo(() => computeScores(s), [s]);
  const streaks = useMemo(() => currentStreaks(raw), [raw]);
  const shakeKey = useFx((st) => st.shakeKey);
  const [scope, animate] = useAnimate();
  useEffect(() => {
    if (shakeKey && scope.current) {
      void animate(scope.current, { x: [0, -16, 14, -12, 9, -5, 0], y: [0, 7, -9, 5, -4, 2, 0] }, { duration: 0.75 });
    }
  }, [shakeKey, animate, scope]);
  const activeFor = (t: 'red' | 'blue') =>
    raw.phase === 'question' ? raw.current?.answering === t : raw.phase === 'select' ? raw.activeTeam === t : false;
  const clickable = onCellClick && raw.phase === 'select' ? onCellClick : undefined;
  return (
    <div className="relative h-[1080px] w-[1920px] overflow-hidden" dir="rtl">
      <Backdrop />
      <div ref={scope} className="relative h-full w-full">
        <TopBar s={raw} />
        <div className="flex items-start justify-center gap-[30px] px-[50px]">
          <TeamPanel s={raw} team="red" score={scores.red} streak={streaks.red} active={activeFor('red')} />
          <div className="relative h-[820px] w-[1040px]">
            <Board state={s} size="stage" usePending onCellClick={clickable} highlightTargets={!!clickable} />
            <StageQuestion s={raw} />
          </div>
          <TeamPanel s={raw} team="blue" score={scores.blue} streak={streaks.blue} active={activeFor('blue')} />
        </div>
        <Ticker s={raw} />
      </div>
      <Banners s={raw} />
      <AnimatePresence>{raw.wheel && <WheelOverlay key={raw.wheel.id} s={raw} sound={sound} />}</AnimatePresence>
      <AnimatePresence>{raw.phase === 'finished' && raw.audienceView === 'board' && <WinnerOverlay key="winner" s={raw} />}</AnimatePresence>
      <AnimatePresence>{raw.audienceView === 'stats' && <StatsStage key="stats" s={raw} />}</AnimatePresence>
    </div>
  );
}
