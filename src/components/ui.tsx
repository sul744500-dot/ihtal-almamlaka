import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useGame } from '../store/game';

type Variant = 'gold' | 'ghost' | 'dark' | 'green' | 'danger' | 'red' | 'blue';

export function Button({
  variant = 'dark',
  className = '',
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: 'text-sm px-3 py-1.5 rounded-lg',
    md: '',
    lg: 'text-lg px-6 py-3',
    xl: 'text-2xl px-8 py-4 rounded-2xl',
  };
  return <button type="button" className={`btn btn-${variant} ${sizes[size]} ${className}`} {...rest} />;
}

export function Card({ title, icon, children, className = '', actions }: { title?: ReactNode; icon?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`panel p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gold-200">
              {icon && <span className="text-xl">{icon}</span>}
              {title}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label, desc, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; desc?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start justify-between gap-4 rounded-xl px-1 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <span className="min-w-0">
        <span className="block font-semibold text-white">{label}</span>
        {desc && <span className="mt-0.5 block text-sm text-slate-400">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-gold-400' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full shadow-md transition-all ${checked ? 'start-6 bg-white ring-2 ring-gold-600/40' : 'start-1 bg-slate-300'}`}
        />
      </button>
    </label>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  desc,
  suffix,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: ReactNode;
  desc?: ReactNode;
  suffix?: string;
  disabled?: boolean;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <div className="font-semibold text-white">{label}</div>
        {desc && <div className="mt-0.5 text-sm text-slate-400">{desc}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-gold-400/25 bg-navy-950/60 p-1">
        <button type="button" disabled={disabled || value <= min} onClick={() => set(value - step)} className="h-8 w-8 rounded-lg text-xl text-gold-200 hover:bg-white/10 disabled:opacity-30">
          −
        </button>
        <span className="min-w-[3.5rem] text-center font-bold tabular-nums text-white">
          {value}
          {suffix && <span className="ms-1 text-xs font-normal text-slate-400">{suffix}</span>}
        </span>
        <button type="button" disabled={disabled || value >= max} onClick={() => set(value + step)} className="h-8 w-8 rounded-lg text-xl text-gold-200 hover:bg-white/10 disabled:opacity-30">
          +
        </button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className = '' }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`inline-flex flex-wrap gap-1 rounded-xl border border-gold-400/20 bg-navy-950/60 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${value === o.id ? 'bg-gold-400 text-navy-950' : 'text-slate-300 hover:bg-white/10'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-2xl', footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`panel-solid relative flex max-h-[92vh] w-full ${width} flex-col overflow-hidden shadow-2xl`}
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
          >
            <header className="flex items-center justify-between gap-3 border-b border-gold-400/15 px-5 py-4">
              <h3 className="font-display text-xl font-bold text-gold-200">{title}</h3>
              <button type="button" onClick={onClose} className="rounded-lg px-2 text-2xl text-slate-400 hover:bg-white/10 hover:text-white" aria-label="إغلاق">
                ×
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-gold-400/15 px-5 py-3">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Badge({ children, color = '#f6c443', className = '' }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`} style={{ color, background: `${color}22`, border: `1px solid ${color}55` }}>
      {children}
    </span>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  const tone = { info: 'border-sky-400/50', success: 'border-emerald-400/60', warn: 'border-amber-400/60', error: 'border-red-400/70' };
  const icon = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '⛔' };
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[200] flex w-[min(92vw,460px)] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => dismiss(t.id)}
            className={`panel-solid pointer-events-auto flex items-center gap-2 border-s-4 px-4 py-3 text-start text-sm font-semibold shadow-xl ${tone[t.tone]}`}
          >
            <span>{icon[t.tone]}</span>
            <span>{t.text}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ConfirmButton({ onConfirm, children, confirmText = 'تأكيد؟', variant = 'danger', size = 'sm', className = '', disabled }: { onConfirm: () => void; children: ReactNode; confirmText?: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; className?: string; disabled?: boolean }) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(confirmText)) onConfirm();
      }}
    >
      {children}
    </Button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
