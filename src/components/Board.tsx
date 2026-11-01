import { AnimatePresence, motion } from 'motion/react';
import { memo, useMemo } from 'react';
import { isImmune, isLocked, isShielded, targetInfo } from '../lib/engine';
import { CATEGORY_MAP, TEAM_COLORS } from '../lib/meta';
import { cellValue } from '../lib/scoring';
import type { Cell, GameState, TeamId } from '../lib/types';
import { useFx, type CellAnim } from '../store/fx';
import { useSettings } from '../store/settings';
import { Crown, Emblem } from './Brand';

interface CellView {
  cell: Cell;
  owner: TeamId | null;
  shielded: boolean;
  shieldRounds: number;
  immune: boolean;
  locked: boolean;
  selected: boolean;
  attack: boolean;
  targetable: boolean;
  value: number;
  emblem: string | null;
  unlockRound: number;
}

const OWNER_BG: Record<'none' | TeamId, string> = {
  none: 'linear-gradient(160deg, #1a2f68 0%, #0e1c45 55%, #0a1433 100%)',
  red: 'linear-gradient(160deg, #ff7186 0%, #e1263f 48%, #8e1028 100%)',
  blue: 'linear-gradient(160deg, #6fabff 0%, #2366f0 48%, #0f2f8a 100%)',
};

const PARTICLE_ANGLES = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);

function Burst({ anim }: { anim: CellAnim }) {
  const color = anim.team ? TEAM_COLORS[anim.team].light : '#ffd86b';
  const delay = anim.type === 'steal' ? 0.4 : 0.25;
  return (
    <div key={anim.key} className="pointer-events-none absolute inset-0 z-30">
      <motion.div
        className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-3xl"
        style={{ border: `6px solid ${color}`, boxShadow: `0 0 40px ${color}` }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.9], opacity: [1, 0] }}
        transition={{ duration: 0.9, delay, ease: 'easeOut' }}
      />
      {anim.type !== 'shield' &&
        PARTICLE_ANGLES.map((a, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-sm"
            style={{ background: i % 2 ? color : '#ffd86b', boxShadow: `0 0 10px ${color}` }}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
            animate={{ x: Math.cos(a) * 170, y: Math.sin(a) * 130, opacity: [0, 1, 0], rotate: 220 }}
            transition={{ duration: 0.9, delay: delay + 0.05, ease: 'easeOut' }}
          />
        ))}
      {anim.type === 'steal' && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-7xl"
          initial={{ scale: 0, rotate: -40, opacity: 0 }}
          animate={{ scale: [0, 1.5, 1], rotate: 0, opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, times: [0, 0.4, 1] }}
        >
          ⚔️
        </motion.div>
      )}
    </div>
  );
}

const CellTile = memo(function CellTile({
  v,
  size,
  showCategory,
  anim,
  onClick,
  interactive,
}: {
  v: CellView;
  size: 'stage' | 'compact';
  showCategory: boolean;
  anim: CellAnim | undefined;
  onClick?: (id: number) => void;
  interactive: boolean;
}) {
  const { cell, owner } = v;
  const stage = size === 'stage';
  const golden = cell.kind === 'golden';
  const crown = cell.kind === 'crown';
  const cat = cell.category ? CATEGORY_MAP[cell.category] : null;
  const ownerKey = owner ?? 'none';
  const borderColor = v.selected ? '#ffe7a3' : golden || crown ? '#ffd86b' : owner ? TEAM_COLORS[owner].light : 'rgba(246,196,67,0.32)';
  const glow = owner ? TEAM_COLORS[owner].glow : golden ? 'rgba(246,196,67,0.45)' : 'transparent';

  const flip =
    anim && (anim.type === 'capture' || anim.type === 'steal')
      ? anim.type === 'steal'
        ? { x: [0, -10, 10, -8, 8, 0, 0, 0], rotateY: [0, 0, 0, 0, 0, 0, 90, 0], scale: [1, 1, 1, 1, 1, 1.08, 1.14, 1] }
        : { rotateY: [0, 90, 0], scale: [1, 1.14, 1] }
      : anim && anim.type !== 'golden'
        ? { scale: [1, 1.08, 1] }
        : anim
          ? { scale: [1, 1.12, 1], rotate: [0, -3, 3, 0] }
          : { scale: 1 };

  return (
    <motion.button
      type="button"
      disabled={!interactive}
      onClick={() => onClick?.(cell.id)}
      key={anim?.key ?? 'idle'}
      animate={flip}
      transition={{ duration: anim?.type === 'steal' ? 0.9 : 0.7, ease: 'easeInOut' }}
      whileHover={interactive && v.targetable ? { scale: 1.04, y: -3 } : undefined}
      className={`group relative isolate overflow-hidden text-white outline-none ${stage ? 'rounded-[26px]' : 'rounded-xl'} ${interactive ? (v.targetable ? 'cursor-pointer' : 'cursor-not-allowed') : 'cursor-default'}`}
      style={{
        background: crown && !owner ? 'linear-gradient(160deg, #3b2a0a 0%, #1f1650 55%, #0d1033 100%)' : OWNER_BG[ownerKey],
        border: `${stage ? (golden || crown || v.selected ? 4 : 2) : golden || crown || v.selected ? 3 : 1.5}px solid ${borderColor}`,
        boxShadow: `${owner || golden ? `0 0 ${stage ? 34 : 14}px -4px ${glow},` : ''} inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -18px 30px rgba(0,0,0,0.25)`,
        transformPerspective: 900,
        opacity: v.locked ? 0.75 : interactive && !v.targetable && !v.selected ? 0.55 : 1,
      }}
      aria-label={cell.name}
    >
      {/* لمعان ذهبي للمناطق الذهبية */}
      {(golden || crown) && (
        <span
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background: 'linear-gradient(115deg, transparent 30%, rgba(255,240,190,0.45) 45%, transparent 60%)',
            backgroundSize: '250% 100%',
            animation: 'shimmer 3.6s linear infinite',
          }}
        />
      )}
      {/* شعار المالك كعلامة مائية */}
      {owner && v.emblem && (
        <span className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-20">
          <Emblem value={v.emblem} size={stage ? 120 : 44} />
        </span>
      )}

      <div className={`flex h-full w-full flex-col items-center justify-center ${stage ? 'gap-1 px-3' : 'gap-0 px-1'}`}>
        {stage && crown ? (
          <Crown size={v.locked ? 58 : 74} glow={!v.locked} className={v.locked ? '-mt-5' : ''} />
        ) : stage && golden ? (
          <span className="text-4xl" style={{ filter: 'drop-shadow(0 0 8px rgba(246,196,67,0.9))' }}>
            ⭐
          </span>
        ) : null}
        <span
          className={`text-center font-extrabold leading-tight ${stage ? (cell.name.length > 10 ? 'text-[25px]' : 'text-[30px]') : 'text-[11px] sm:text-xs'}`}
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
        >
          {cell.name}
        </span>
      </div>

      {/* أيقونة الفئة */}
      {showCategory && cat && (
        <span className={`absolute ${stage ? 'start-2.5 top-2 text-[26px]' : 'start-0.5 top-0 text-[10px]'} opacity-90`} title={cat.name}>
          {cat.icon}
        </span>
      )}
      {/* قيمة المنطقة */}
      {(golden || crown) &&
        (stage ? (
          <span className="absolute bottom-2 end-2.5 rounded-full bg-gold-400 px-2.5 py-0.5 text-[22px] font-black text-navy-950 shadow">{v.value}</span>
        ) : (
          <span className="absolute bottom-0 end-0.5 text-[10px] leading-none">{crown ? '👑' : '⭐'}</span>
        ))}
      {/* الدرع */}
      {v.shielded && (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `inset 0 0 ${stage ? 40 : 14}px rgba(103,232,249,0.85)`, border: `${stage ? 3 : 1.5}px solid rgba(165,243,252,0.9)` }} />
          <span className={`absolute ${stage ? 'end-2 top-2 text-[30px]' : 'end-0 top-0 text-[11px]'}`}>
            🛡️{stage && <sub className="text-sm font-black text-cyan-200">{v.shieldRounds}</sub>}
          </span>
        </>
      )}
      {v.immune && !v.shielded && <span className={`absolute ${stage ? 'end-2.5 top-2 text-[24px]' : 'end-0 top-0 text-[10px]'}`}>🔒</span>}
      {/* منطقة التاج المقفلة */}
      {v.locked && (
        <span className={`absolute inset-0 flex flex-col items-center justify-end bg-black/35 ${stage ? 'pb-1.5' : 'pb-0'}`}>
          {stage ? (
            <span className="rounded-full bg-black/70 px-3 py-0.5 text-[17px] font-bold text-gold-200">🔒 تُفتح في الجولة {v.unlockRound}</span>
          ) : (
            <span className="text-[10px]">🔒</span>
          )}
        </span>
      )}
      {/* التحديد */}
      {v.selected && (
        <>
          <span className={`pointer-events-none absolute inset-0 rounded-[inherit] pulse-ring`} />
          <span className={`absolute ${stage ? 'bottom-2 start-2.5 text-[28px]' : 'bottom-0 start-0.5 text-[11px]'}`}>{v.attack ? '⚔️' : '🎯'}</span>
        </>
      )}
      <AnimatePresence>{anim && <Burst anim={anim} />}</AnimatePresence>
    </motion.button>
  );
});

export interface BoardProps {
  state: GameState;
  size?: 'stage' | 'compact';
  /** عند التمرير: يمكن النقر على المناطق */
  onCellClick?: (id: number) => void;
  /** إبراز المناطق المتاحة للفريق صاحب الدور */
  highlightTargets?: boolean;
  /** يطبّق المالك المؤقت حتى تبدأ حركة الاحتلال (لشاشة الجمهور) */
  usePending?: boolean;
  className?: string;
}

export function Board({ state, size = 'stage', onCellClick, highlightTargets = false, usePending = false, className = '' }: BoardProps) {
  const pending = useFx((s) => s.pendingOwners);
  const anims = useFx((s) => s.cellAnims);
  const showCategory = useSettings((s) => s.settings.showCellCategories);
  const views = useMemo<CellView[]>(() => {
    const unlockRound = state.rules.rounds - state.rules.crownRounds + 1;
    return state.cells.map((cell) => {
      const owner = usePending && cell.id in pending ? pending[cell.id] : cell.owner;
      const shielded = isShielded(state, cell);
      const info = state.phase === 'select' ? targetInfo(state, cell.id) : null;
      return {
        cell,
        owner,
        shielded,
        shieldRounds: shielded && cell.shieldUntil !== null ? Math.max(1, Math.ceil((cell.shieldUntil - state.turn + 1) / 2)) : 0,
        immune: isImmune(state, cell) && !!owner,
        locked: isLocked(state, cell),
        selected: state.selectedCell === cell.id || state.current?.cellId === cell.id,
        attack: !!owner && owner !== (state.current?.team ?? state.activeTeam),
        targetable: highlightTargets ? !!info?.ok : true,
        value: cellValue(cell, state.rules),
        emblem: owner ? state.teams[owner].emblem : null,
        unlockRound: Math.max(1, Math.min(state.rules.rounds, unlockRound)),
      };
    });
  }, [state, pending, usePending, highlightTargets]);

  const stage = size === 'stage';
  const interactive = !!onCellClick;
  return (
    <div
      className={`grid grid-cols-5 ${stage ? 'gap-4' : 'gap-1.5'} ${className}`}
      style={stage ? { width: 1040, height: 820, gridTemplateRows: 'repeat(5, 1fr)' } : { gridTemplateRows: 'repeat(5, 1fr)', aspectRatio: '1.27' }}
    >
      {views.map((v) => (
        <CellTile
          key={v.cell.id}
          v={v}
          size={size}
          showCategory={showCategory}
          anim={anims[v.cell.id]}
          onClick={onCellClick}
          interactive={interactive && (v.targetable || v.selected)}
        />
      ))}
    </div>
  );
}
