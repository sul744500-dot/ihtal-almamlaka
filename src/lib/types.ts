// أنواع البيانات الأساسية للعبة «احتلّ المملكة»

export type TeamId = 'red' | 'blue';
export const TEAM_IDS: TeamId[] = ['red', 'blue'];
export const other = (t: TeamId): TeamId => (t === 'red' ? 'blue' : 'red');

export type CategoryId =
  | 'football'
  | 'anime'
  | 'games'
  | 'saudi'
  | 'general'
  | 'histgeo'
  | 'puzzles'
  | 'images';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultyMode = 'progressive' | 'easy' | 'medium' | 'hard' | 'mixed';
export type QuestionType = 'mcq' | 'open';

export interface QuestionMedia {
  kind: 'emoji' | 'flag' | 'image';
  /** نص الإيموجي، أو رمز العلم، أو رابط/بيانات الصورة */
  value: string;
  /** تتضح الصورة تدريجيًا مع مرور الوقت */
  progressive?: boolean;
}

export interface Question {
  id: string;
  category: CategoryId;
  difficulty: Difficulty;
  type: QuestionType;
  text: string;
  /** خيارات سؤال الاختيار من متعدد (فارغة للأسئلة المفتوحة) */
  options: string[];
  /** رقم الخيار الصحيح، أو ‎-1 للأسئلة المفتوحة */
  correct: number;
  /** نص الإجابة الصحيحة كما يراه المقدم */
  answer: string;
  /** ملاحظة للمقدم فقط */
  note?: string;
  media?: QuestionMedia;
  /** لا تُخلط الخيارات عند العرض (مثلًا خيارات مرتبة زمنيًا) */
  keepOrder?: boolean;
  custom?: boolean;
  updatedAt?: number;
}

export type CellKind = 'normal' | 'golden' | 'crown';

export interface Cell {
  id: number;
  name: string;
  kind: CellKind;
  owner: TeamId | null;
  category: CategoryId | null;
  /** آخر دور (شامل) تبقى فيه المنطقة محمية بالدرع */
  shieldUntil: number | null;
  /** آخر دور (شامل) لا يمكن فيه استرجاع المنطقة بعد سرقتها */
  immuneUntil: number | null;
  goldenClaimed: boolean;
  captures: number;
  lastCapturedTurn: number | null;
}

export type AbilityId = 'shield' | 'time' | 'fifty' | 'second';

export interface TeamState {
  id: TeamId;
  name: string;
  /** إيموجي أو رابط بيانات صورة (data:) */
  emblem: string;
  bonus: number;
  abilities: AbilityId[];
}

export interface Rules {
  /** كل جولة = دور واحد لكل فريق */
  rounds: number;
  answerSeconds: number;
  normalValue: number;
  goldenValue: number;
  crownValue: number;
  goldenCount: number;
  crownEnabled: boolean;
  /** تظهر منطقة التاج في آخر N جولات */
  crownRounds: number;
  stealEnabled: boolean;
  /** المنطقة المسروقة لا تُسترجع في الدور التالي مباشرة */
  stealImmunity: boolean;
  abilitiesEnabled: boolean;
  maxAbilities: number;
  /** مدة الدرع بالأدوار (4 = جولتان) */
  shieldTurns: number;
  extraTimeSeconds: number;
  eventsCount: number;
  /** عجلة الحظ كل N جولات (0 = معطلة) */
  wheelEvery: number;
  reboundEnabled: boolean;
  reboundSeconds: number;
  finalRoundEnabled: boolean;
  tiebreakEnabled: boolean;
  autoReveal: boolean;
  autoStartTimer: boolean;
  /** فارق النقاط الذي يُعد تجاوزه «ريمونتادا» */
  remontadaGap: number;
}

export interface TimerState {
  durationMs: number;
  startedAt: number | null;
  elapsedMs: number;
  expired: boolean;
}

export type QuestionMode = 'claim' | 'attack' | 'tiebreak';
export type AnswerResult = 'correct' | 'wrong';

export interface CurrentQuestion {
  q: Question;
  cellId: number | null;
  /** الفريق صاحب الدور (فارغ في السؤال الفاصل) */
  team: TeamId | null;
  /** الفريق الذي يجيب الآن (يتغير في فرصة الرد) */
  answering: TeamId | null;
  mode: QuestionMode;
  difficulty: Difficulty;
  timer: TimerState;
  revealed: boolean;
  hiddenOptions: number[];
  wrongPicks: number[];
  picked: number | null;
  result: AnswerResult | null;
  resultTeam: TeamId | null;
  rebound: boolean;
  secondChance: 'none' | 'armed' | 'used';
  lightning: boolean;
  bonusOnCorrect: number;
  shownAt: number;
  judgedAt: number | null;
  replaced: number;
}

export type SoundId =
  | 'select'
  | 'question'
  | 'reveal'
  | 'tick'
  | 'tickUrgent'
  | 'timeout'
  | 'correct'
  | 'wrong'
  | 'capture'
  | 'steal'
  | 'golden'
  | 'crown'
  | 'remontada'
  | 'event'
  | 'wheelTick'
  | 'wheelStop'
  | 'drumroll'
  | 'applause'
  | 'suspense'
  | 'shield'
  | 'ability'
  | 'gong'
  | 'winner'
  | 'whoosh'
  | 'crash'
  | 'bonus'
  | 'penalty'
  | 'lockin';

export type FxType =
  | 'capture'
  | 'steal'
  | 'golden'
  | 'crown-capture'
  | 'correct'
  | 'wrong'
  | 'timeout'
  | 'question'
  | 'reveal'
  | 'lockin'
  | 'remontada'
  | 'ability'
  | 'event'
  | 'crown-appears'
  | 'final-round'
  | 'rebound'
  | 'second-chance'
  | 'tiebreak'
  | 'winner'
  | 'draw'
  | 'wheel'
  | 'wheel-result'
  | 'sfx'
  | 'announce'
  | 'bonus'
  | 'penalty'
  | 'turn'
  | 'start';

export interface Fx {
  id: string;
  type: FxType;
  at: number;
  /** تأخير العرض بالمللي ثانية */
  delay?: number;
  team?: TeamId | null;
  cellId?: number | null;
  title?: string;
  sub?: string;
  icon?: string;
  sound?: SoundId;
  value?: number;
}

export type WheelPrize = 'shield' | 'time' | 'fifty' | 'second' | 'point' | 'none';

export interface WheelState {
  id: string;
  team: TeamId;
  segments: WheelPrize[];
  result: number;
  startedAt: number;
  durationMs: number;
  applied: boolean;
}

export type EventId = 'lightning' | 'golden-rush' | 'shields-down' | 'underdog';

export type LogKind =
  | 'answer'
  | 'capture'
  | 'steal'
  | 'ability'
  | 'event'
  | 'wheel'
  | 'adjust'
  | 'manual'
  | 'info'
  | 'tiebreak'
  | 'finish';

export interface LogEntry {
  id: string;
  at: number;
  turn: number;
  round: number;
  kind: LogKind;
  team?: TeamId | null;
  text: string;
  correct?: boolean;
  mode?: QuestionMode;
  category?: CategoryId;
  difficulty?: Difficulty;
  ms?: number;
  cellId?: number | null;
  rebound?: boolean;
  ability?: AbilityId;
  delta?: number;
  timedOut?: boolean;
  victim?: TeamId | null;
  cellKind?: CellKind;
}

export type Phase = 'select' | 'question' | 'result' | 'tiebreak' | 'finished';

export interface TimelinePoint {
  turn: number;
  red: number;
  blue: number;
}

export interface GameState {
  v: 1;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** رقم المراجعة: يزيد مع كل تغيير، ويُستخدم للتزامن */
  rev: number;
  /** معرّف الشاشة التي أجرت آخر تعديل (لحسم التعارض بين جهازين) */
  origin?: string;
  /** وقت تفعيل هذه المباراة كمباراة حالية */
  activeAt: number;
  seq: number;
  phase: Phase;
  turn: number;
  activeTeam: TeamId;
  startingTeam: TeamId;
  teams: Record<TeamId, TeamState>;
  cells: Cell[];
  rules: Rules;
  categories: CategoryId[];
  difficultyMode: DifficultyMode;
  selectedCell: number | null;
  current: CurrentQuestion | null;
  usedQuestionIds: string[];
  log: LogEntry[];
  timeline: TimelinePoint[];
  fx: Fx[];
  wheel: WheelState | null;
  wheelPending: TeamId | null;
  eventTurns: number[];
  eventsUsed: number;
  pendingEvent: EventId | null;
  comeback: Record<TeamId, number>;
  leader: TeamId | null;
  crownActive: boolean;
  tiebreakCount: number;
  winner: TeamId | 'draw' | null;
  finishedAt: number | null;
  /** board = اللوحة (مع احتفال الفائز عند النهاية)، final = اللوحة النهائية بدون احتفال، stats = الإحصائيات */
  audienceView: AudienceView;
}

export type AudienceView = 'board' | 'final' | 'stats';

export interface MatchRecord {
  id: string;
  state: GameState;
  past: GameState[];
}

export interface MatchSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  phase: Phase;
  round: number;
  rounds: number;
  teams: Record<TeamId, { name: string; emblem: string; score: number }>;
  winner: TeamId | 'draw' | null;
}

export type ControllerSound = 'auto' | 'always' | 'never';

export interface Settings {
  sfx: boolean;
  volume: number;
  controllerSound: ControllerSound;
  reduceMotion: boolean;
  effectsLevel: 'full' | 'lite';
  hideAnswerOnHost: boolean;
  shortcuts: boolean;
  avoidUsedQuestions: boolean;
  showCellCategories: boolean;
  audienceStatusBadge: boolean;
  defaultRules: Rules;
}
