import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Backdrop, Crown } from './Brand';

const NAV = [
  { to: '/', label: 'الرئيسية', icon: '🏠' },
  { to: '/new', label: 'مباراة جديدة', icon: '➕' },
  { to: '/editor', label: 'محرر الأسئلة', icon: '📝' },
  { to: '/settings', label: 'الإعدادات', icon: '⚙️' },
];

export function Shell({ children, title, wide = false, actions }: { children: ReactNode; title?: ReactNode; wide?: boolean; actions?: ReactNode }) {
  useEffect(() => {
    document.title = typeof title === 'string' ? `${title.replace(/^\P{L}+/u, '')} — احتلّ المملكة` : 'احتلّ المملكة 👑';
  }, [title]);
  return (
    <div className="relative min-h-full">
      <div className="fixed inset-0 -z-10">
        <Backdrop beams={false} intensity={0.8} />
      </div>
      <header className="sticky top-0 z-40 border-b border-gold-400/15 bg-navy-950/75 backdrop-blur-md">
        <div className={`mx-auto flex items-center gap-3 px-4 py-2.5 ${wide ? 'max-w-[1800px]' : 'max-w-6xl'}`}>
          <Link to="/" className="flex items-center gap-2">
            <Crown size={34} />
            <span className="whitespace-nowrap font-display text-xl font-bold gold-text">احتلّ المملكة</span>
          </Link>
          <nav className="ms-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold transition ${isActive ? 'bg-gold-400/15 text-gold-200' : 'text-slate-300 hover:bg-white/5'}`}
              >
                <span className="me-1">{n.icon}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className={`mx-auto px-4 pb-16 pt-6 ${wide ? 'max-w-[1800px]' : 'max-w-6xl'}`}>
        {(title || actions) && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            {title && <h1 className="font-display text-2xl font-bold text-gold-100 sm:text-3xl">{title}</h1>}
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

const STEPS = [
  { to: '/new', label: 'إنشاء المباراة' },
  { to: '/new/teams', label: 'الفرق والقواعد' },
  { to: '/new/categories', label: 'فئات الأسئلة' },
];

export function WizardSteps({ current }: { current: number }) {
  const navigate = useNavigate();
  return (
    <ol className="mb-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
      {STEPS.map((st, i) => (
        <li key={st.to} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(st.to)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition ${
              i === current ? 'border-gold-300 bg-gold-400 text-navy-950' : i < current ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/15 text-slate-400'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/20">{i < current ? '✓' : i + 1}</span>
            {st.label}
          </button>
          {i < STEPS.length - 1 && <span className="h-px w-6 bg-gold-400/30" />}
        </li>
      ))}
    </ol>
  );
}
