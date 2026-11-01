import { TEAM_COLORS } from '../lib/meta';
import type { GameState, TeamId, TimelinePoint } from '../lib/types';

/** رسم بياني بسيط لتطور النقاط عبر الأدوار */
export function ScoreChart({ s, timeline, height = 220, big = false }: { s: GameState; timeline: TimelinePoint[]; height?: number; big?: boolean }) {
  const W = 600;
  const H = height;
  const pad = big ? 46 : 32;
  const pts = timeline.length ? timeline : [{ turn: 0, red: 0, blue: 0 }];
  const maxTurn = Math.max(1, ...pts.map((p) => p.turn));
  const maxScore = Math.max(3, ...pts.map((p) => Math.max(p.red, p.blue)));
  const x = (t: number) => pad + ((W - pad * 2) * t) / maxTurn;
  const y = (v: number) => H - pad - ((H - pad * 2) * v) / maxScore;
  const path = (team: TeamId) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.turn).toFixed(1)},${y(p[team]).toFixed(1)}`).join(' ');
  const fs = big ? 22 : 13;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" style={{ direction: 'ltr' }} role="img" aria-label="تطور النتيجة">
      {Array.from({ length: 4 }).map((_, i) => {
        const v = Math.round((maxScore * (i + 1)) / 4);
        return (
          <g key={i}>
            <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.08)" />
            <text x={pad - 8} y={y(v) + fs / 3} fill="rgba(255,255,255,0.45)" fontSize={fs} textAnchor="end">
              {v}
            </text>
          </g>
        );
      })}
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="rgba(246,196,67,0.4)" />
      {(['red', 'blue'] as TeamId[]).map((t) => (
        <g key={t}>
          <path d={path(t)} fill="none" stroke={TEAM_COLORS[t].main} strokeWidth={big ? 6 : 3.5} strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${TEAM_COLORS[t].glow})` }} />
          {pts.length > 0 && <circle cx={x(pts[pts.length - 1].turn)} cy={y(pts[pts.length - 1][t])} r={big ? 9 : 5} fill={TEAM_COLORS[t].light} />}
        </g>
      ))}
      <text x={W - pad} y={H - pad + fs + 6} fill="rgba(255,255,255,0.45)" fontSize={fs} textAnchor="end">
        الدور
      </text>
      <title>{`${s.teams.red.name} ضد ${s.teams.blue.name}`}</title>
    </svg>
  );
}
