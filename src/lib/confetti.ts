import confetti from 'canvas-confetti';

const GOLD = ['#fff3c4', '#ffd86b', '#f6c443', '#e2a923', '#ffffff'];

const lite = () => document.documentElement.dataset.effects === 'lite';
const off = () => document.documentElement.dataset.motion === 'reduced';

export function goldBurst(x = 0.5, y = 0.45, extra: string[] = []): void {
  if (off()) return;
  void confetti({
    particleCount: lite() ? 60 : 140,
    spread: 100,
    startVelocity: 45,
    origin: { x, y },
    colors: [...GOLD, ...extra],
    scalar: 1.1,
    zIndex: 90,
  });
}

export function teamBurst(color: string, light: string): void {
  if (off()) return;
  const opts = { particleCount: lite() ? 50 : 110, spread: 75, startVelocity: 55, colors: [color, light, '#ffd86b', '#ffffff'], zIndex: 90 };
  void confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.7 } });
  void confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.7 } });
}

let celebrating: number | null = null;

/** احتفال الفائز: مدافع قصاصات من الجانبين وألعاب نارية */
export function celebrate(colors: string[], durationMs = 7000): void {
  if (off()) return;
  if (celebrating) clearInterval(celebrating);
  const end = Date.now() + durationMs;
  const palette = [...colors, ...GOLD];
  celebrating = window.setInterval(() => {
    if (Date.now() > end) {
      if (celebrating) clearInterval(celebrating);
      celebrating = null;
      return;
    }
    const n = lite() ? 4 : 9;
    void confetti({ particleCount: n, angle: 60, spread: 60, startVelocity: 70, origin: { x: 0, y: 0.85 }, colors: palette, zIndex: 90 });
    void confetti({ particleCount: n, angle: 120, spread: 60, startVelocity: 70, origin: { x: 1, y: 0.85 }, colors: palette, zIndex: 90 });
    if (Math.random() < 0.12) {
      void confetti({
        particleCount: lite() ? 40 : 90,
        spread: 360,
        startVelocity: 30,
        gravity: 0.7,
        ticks: 120,
        origin: { x: 0.2 + Math.random() * 0.6, y: 0.15 + Math.random() * 0.3 },
        colors: palette,
        shapes: ['star'],
        zIndex: 90,
      });
    }
  }, 120);
}

export function stopCelebration(): void {
  if (celebrating) clearInterval(celebrating);
  celebrating = null;
  confetti.reset();
}
