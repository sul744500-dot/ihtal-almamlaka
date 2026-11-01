import type { AbilityId, CategoryId, Difficulty, DifficultyMode, EventId, TeamId, WheelPrize } from './types';

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  short: string;
  icon: string;
  color: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'football', name: 'كرة القدم', short: 'كرة', icon: '⚽', color: '#22c55e' },
  { id: 'anime', name: 'الأنمي', short: 'أنمي', icon: '🍥', color: '#f472b6' },
  { id: 'games', name: 'ألعاب الفيديو', short: 'ألعاب', icon: '🎮', color: '#a78bfa' },
  { id: 'saudi', name: 'الثقافة السعودية', short: 'سعودي', icon: '🐪', color: '#34d399' },
  { id: 'general', name: 'المعلومات العامة', short: 'عامة', icon: '💡', color: '#fbbf24' },
  { id: 'histgeo', name: 'التاريخ والجغرافيا', short: 'تاريخ', icon: '🌍', color: '#38bdf8' },
  { id: 'puzzles', name: 'الذكاء والألغاز', short: 'ألغاز', icon: '🧩', color: '#fb923c' },
  { id: 'images', name: 'تخمين الصور', short: 'صور', icon: '🖼️', color: '#e879f9' },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryInfo>;

export const ALL_CATEGORY_IDS: CategoryId[] = CATEGORIES.map((c) => c.id);

export const DIFFICULTY_INFO: Record<Difficulty, { name: string; color: string; stars: number }> = {
  easy: { name: 'سهل', color: '#4ade80', stars: 1 },
  medium: { name: 'متوسط', color: '#fbbf24', stars: 2 },
  hard: { name: 'صعب', color: '#f87171', stars: 3 },
};

export const DIFFICULTY_MODES: { id: DifficultyMode; name: string; desc: string }[] = [
  { id: 'progressive', name: 'تصاعدي', desc: 'يبدأ سهلًا ويصعب مع تقدم الجولات، والمناطق الذهبية والهجوم أصعب' },
  { id: 'mixed', name: 'مختلط', desc: 'مستويات عشوائية مع صعوبة أعلى للهجوم والذهبي' },
  { id: 'easy', name: 'سهل دائمًا', desc: 'كل الأسئلة سهلة' },
  { id: 'medium', name: 'متوسط دائمًا', desc: 'كل الأسئلة متوسطة' },
  { id: 'hard', name: 'صعب دائمًا', desc: 'كل الأسئلة صعبة' },
];

export const ABILITY_INFO: Record<AbilityId, { name: string; icon: string; desc: string }> = {
  shield: { name: 'درع', icon: '🛡️', desc: 'يحمي منطقة من مناطقك من الهجوم لجولتين' },
  time: { name: 'وقت إضافي', icon: '⏱️', desc: 'يضيف ثوانيَ إضافية على السؤال الحالي' },
  fifty: { name: 'حذف إجابتين', icon: '✂️', desc: 'يحذف خيارين خاطئين في سؤال الاختيارات' },
  second: { name: 'فرصة ثانية', icon: '🔁', desc: 'محاولة إضافية إذا كانت الإجابة الأولى خاطئة' },
};

export const ABILITY_IDS: AbilityId[] = ['shield', 'time', 'fifty', 'second'];

export const EVENT_INFO: Record<EventId, { name: string; icon: string; desc: string }> = {
  lightning: { name: 'سؤال البرق', icon: '⚡', desc: 'السؤال القادم بنصف الوقت، والإجابة الصحيحة تمنح نقطة إضافية' },
  'golden-rush': { name: 'كنز ذهبي', icon: '🌟', desc: 'منطقة محايدة تتحول إلى منطقة ذهبية' },
  'shields-down': { name: 'سقوط الدروع', icon: '💥', desc: 'تسقط جميع الدروع فورًا' },
  underdog: { name: 'دعم المتأخر', icon: '🎁', desc: 'الفريق المتأخر بنقطتين أو أكثر يحصل على درع' },
};

export const EVENT_IDS: EventId[] = ['lightning', 'golden-rush', 'shields-down', 'underdog'];

export const WHEEL_INFO: Record<WheelPrize, { name: string; icon: string; color: string }> = {
  shield: { name: 'درع', icon: '🛡️', color: '#0ea5e9' },
  time: { name: '+ وقت', icon: '⏱️', color: '#8b5cf6' },
  point: { name: 'نقطة', icon: '⭐', color: '#eab308' },
  fifty: { name: 'حذف اثنين', icon: '✂️', color: '#ec4899' },
  second: { name: 'فرصة ثانية', icon: '🔁', color: '#10b981' },
  none: { name: 'حظ أوفر', icon: '😅', color: '#64748b' },
};

export const WHEEL_SEGMENTS: WheelPrize[] = ['shield', 'time', 'point', 'fifty', 'second', 'none'];

export const TEAM_COLORS: Record<TeamId, { name: string; main: string; light: string; dark: string; glow: string }> = {
  red: { name: 'الفريق الأحمر', main: '#ef3b55', light: '#ff7a8e', dark: '#8e1028', glow: 'rgba(255, 59, 85, 0.65)' },
  blue: { name: 'الفريق الأزرق', main: '#2f7bff', light: '#7ab0ff', dark: '#0f2f8a', glow: 'rgba(47, 123, 255, 0.65)' },
};

export const EMBLEMS = [
  '🦅', '🐺', '🦁', '🐆', '🐎', '🐪', '🦂', '🐉', '🦈', '🐍',
  '⚔️', '🛡️', '🔥', '⚡', '👑', '🏰', '🌴', '🌙', '⭐', '💎',
  '🚀', '🎯', '🏹', '🗡️', '🌪️', '❄️', '🦬', '🐲', '🦊', '🐯',
];

export const TEAM_NAME_IDEAS = [
  'الصقور', 'الذئاب', 'الأسود', 'الفرسان', 'النشامى', 'العقبان',
  'الشواهين', 'النمور', 'الهجّانة', 'الصناديد', 'العاصفة', 'البراكين',
];
