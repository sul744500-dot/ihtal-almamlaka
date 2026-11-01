import { useId } from 'react';

export function Crown({ size = 80, className = '', glow = true }: { size?: number; className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 120 88"
      width={size}
      height={(size * 88) / 120}
      className={className}
      style={glow ? { filter: 'drop-shadow(0 0 18px rgba(246,196,67,0.55)) drop-shadow(0 6px 10px rgba(0,0,0,0.5))' } : undefined}
      aria-hidden
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.35" stopColor="#ffd86b" />
          <stop offset="0.7" stopColor="#e2a923" />
          <stop offset="1" stopColor="#9a6a10" />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe7a3" />
          <stop offset="1" stopColor="#b98317" />
        </linearGradient>
        <radialGradient id={`r${id}`}>
          <stop offset="0" stopColor="#ff9fb0" />
          <stop offset="1" stopColor="#b3122f" />
        </radialGradient>
        <radialGradient id={`s${id}`}>
          <stop offset="0" stopColor="#a8cbff" />
          <stop offset="1" stopColor="#1d4fd1" />
        </radialGradient>
        <radialGradient id={`e${id}`}>
          <stop offset="0" stopColor="#a7f3d0" />
          <stop offset="1" stopColor="#047857" />
        </radialGradient>
      </defs>
      <path d="M10 70 L5 25 L21 44 L33 15 L46 38 L60 5 L74 38 L87 15 L99 44 L115 25 L110 70 Z" fill={`url(#g${id})`} stroke="#8a5f0f" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 66 L11 36 L22 49 L33 24 L47 45 L60 16 L73 45 L87 24 L98 49 L109 36 L106 66 Z" fill="#fff" opacity="0.13" />
      {[
        [5, 23],
        [33, 13],
        [60, 4],
        [87, 13],
        [115, 23],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 2 ? 5.5 : 4.5} fill={`url(#b${id})`} stroke="#8a5f0f" strokeWidth="1.2" />
      ))}
      <path d="M60 40 L67 50 L60 60 L53 50 Z" fill={`url(#e${id})`} stroke="#065f46" strokeWidth="1" />
      <rect x="7" y="66" width="106" height="17" rx="4" fill={`url(#b${id})`} stroke="#8a5f0f" strokeWidth="1.6" />
      <ellipse cx="30" cy="74.5" rx="6" ry="4.6" fill={`url(#r${id})`} stroke="#7f1d1d" strokeWidth="0.8" />
      <ellipse cx="60" cy="74.5" rx="7.5" ry="5.2" fill={`url(#s${id})`} stroke="#1e3a8a" strokeWidth="0.8" />
      <ellipse cx="90" cy="74.5" rx="6" ry="4.6" fill={`url(#r${id})`} stroke="#7f1d1d" strokeWidth="0.8" />
      {[16, 45, 75, 104].map((x) => (
        <circle key={x} cx={x} cy="74.5" r="2.4" fill="#fffbea" />
      ))}
    </svg>
  );
}

export function Logo({ size = 'md', tagline = false, className = '' }: { size?: 'sm' | 'md' | 'lg' | 'xl'; tagline?: boolean; className?: string }) {
  const dims = {
    sm: { crown: 34, text: 'text-2xl', gap: 'gap-0' },
    md: { crown: 60, text: 'text-4xl', gap: 'gap-1' },
    lg: { crown: 96, text: 'text-6xl', gap: 'gap-2' },
    xl: { crown: 140, text: 'text-7xl sm:text-8xl', gap: 'gap-3' },
  }[size];
  return (
    <div className={`flex flex-col items-center ${dims.gap} ${className}`}>
      <Crown size={dims.crown} />
      <h1 className={`font-display font-bold leading-tight ${dims.text}`} style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.6))' }}>
        <span className="gold-shine">احتلّ المملكة</span>
      </h1>
      {tagline && <p className="mt-1 text-center text-base text-gold-100/70 sm:text-lg">لعبة المسابقات الملكية — الأحمر ضد الأزرق على 25 منطقة</p>}
    </div>
  );
}

// نجوم ونقوش هندسية خلفية بشكل زخرفة إسلامية خفيفة
const PATTERN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='#f6c443' stroke-width='1'><path d='M60 8 L74 46 L112 60 L74 74 L60 112 L46 74 L8 60 L46 46 Z'/><rect x='32' y='32' width='56' height='56' transform='rotate(45 60 60)'/><circle cx='60' cy='60' r='10'/></g></svg>`,
)}")`;

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 2 + ((i * 13) % 4),
  delay: (i * 1.7) % 14,
  dur: 12 + ((i * 7) % 10),
}));

export function Backdrop({ intensity = 1, beams = true }: { intensity?: number; beams?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, #1d3a86 0%, rgba(13,26,64,0.85) 45%, rgba(4,8,23,1) 100%), radial-gradient(ellipse 60% 50% at 50% 110%, rgba(246,196,67,0.12), transparent 70%)',
        }}
      />
      <div className="absolute inset-0" style={{ backgroundImage: PATTERN, backgroundSize: '120px 120px', opacity: 0.05 * intensity }} />
      {beams && (
        <>
          <div
            className="absolute -top-1/3 left-[12%] h-[160%] w-[22%] origin-top opacity-[0.16] mix-blend-screen"
            style={{ background: 'linear-gradient(180deg, rgba(255,231,163,0.9), transparent 75%)', clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)', animation: 'beam 14s ease-in-out infinite' }}
          />
          <div
            className="absolute -top-1/3 right-[12%] h-[160%] w-[22%] origin-top opacity-[0.16] mix-blend-screen"
            style={{ background: 'linear-gradient(180deg, rgba(160,200,255,0.9), transparent 75%)', clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)', animation: 'beam 17s ease-in-out infinite reverse' }}
          />
        </>
      )}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-[-10px] rounded-full bg-gold-300"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            opacity: 0.7,
            boxShadow: '0 0 8px rgba(246,196,67,0.9)',
            animation: `rise ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  );
}

export function Emblem({ value, size = 64, className = '' }: { value: string; size?: number; className?: string }) {
  const isImg = value.startsWith('data:') || value.startsWith('http') || value.startsWith('blob:');
  if (isImg) {
    return <img src={value} alt="" className={`rounded-full object-cover ${className}`} style={{ width: size, height: size }} draggable={false} />;
  }
  return (
    <span className={`inline-flex items-center justify-center leading-none ${className}`} style={{ width: size, height: size, fontSize: size * 0.68 }}>
      {value}
    </span>
  );
}
