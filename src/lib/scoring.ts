import type { Cell, GameState, Rules, TeamId } from './types';

export function cellValue(cell: Pick<Cell, 'kind'>, rules: Rules): number {
  if (cell.kind === 'crown') return rules.crownValue;
  if (cell.kind === 'golden') return rules.goldenValue;
  return rules.normalValue;
}

export interface TeamScore {
  total: number;
  cellPoints: number;
  bonus: number;
  cells: number;
  golden: number;
  crown: boolean;
}

/** النقاط مشتقة دائمًا من ملكية المناطق + النقاط الإضافية، فلا يمكن أن تختلف عن اللوحة */
export function computeScores(s: Pick<GameState, 'cells' | 'rules' | 'teams'>): Record<TeamId, TeamScore> {
  const base = (team: TeamId): TeamScore => ({
    total: 0,
    cellPoints: 0,
    bonus: s.teams[team].bonus,
    cells: 0,
    golden: 0,
    crown: false,
  });
  const out: Record<TeamId, TeamScore> = { red: base('red'), blue: base('blue') };
  for (const cell of s.cells) {
    if (!cell.owner) continue;
    const t = out[cell.owner];
    t.cells += 1;
    t.cellPoints += cellValue(cell, s.rules);
    if (cell.kind === 'golden') t.golden += 1;
    if (cell.kind === 'crown') t.crown = true;
  }
  for (const t of Object.values(out)) t.total = t.cellPoints + t.bonus;
  return out;
}

export function leaderOf(scores: Record<TeamId, TeamScore>): TeamId | null {
  if (scores.red.total > scores.blue.total) return 'red';
  if (scores.blue.total > scores.red.total) return 'blue';
  return null;
}
