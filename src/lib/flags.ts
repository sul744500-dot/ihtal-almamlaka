// أعلام مرسومة يدويًا بصيغة SVG (لا تعتمد على صور خارجية أو خطوط إيموجي)

const W = 300;
const H = 200;

const rect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

const h2 = (a: string, b: string) => rect(0, 0, W, H / 2, a) + rect(0, H / 2, W, H / 2, b);
const h3 = (a: string, b: string, c: string) =>
  rect(0, 0, W, H / 3, a) + rect(0, H / 3, W, H / 3 + 0.5, b) + rect(0, (2 * H) / 3, W, H / 3 + 0.5, c);
const v3 = (a: string, b: string, c: string) =>
  rect(0, 0, W / 3, H, a) + rect(W / 3, 0, W / 3 + 0.5, H, b) + rect((2 * W) / 3, 0, W / 3 + 0.5, H, c);

/** نقاط نجمة منتظمة. angle = زاوية الرأس الأول بالدرجات (‎-90 = للأعلى) */
function starPoints(cx: number, cy: number, r: number, n = 5, angle = -90, inner = 0.382): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = ((angle + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push(`${(cx + rr * Math.cos(rad)).toFixed(2)},${(cy + rr * Math.sin(rad)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const star = (cx: number, cy: number, r: number, fill: string, angle = -90, n = 5, inner = 0.382) =>
  `<polygon points="${starPoints(cx, cy, r, n, angle, inner)}" fill="${fill}"/>`;

/** هلال = دائرة ناقص دائرة أخرى (باستخدام قناع بمعرّف فريد) */
const crescent = (uid: string, cx: number, cy: number, r: number, cx2: number, cy2: number, r2: number, fill: string) =>
  `<mask id="${uid}"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="#000"/></mask>` +
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" mask="url(#${uid})"/>`;

/** شريط مسنن (قطر والبحرين) */
function serrated(teeth: number, base: number, tip: number): string {
  const h = H / teeth;
  const pts = [`0,0`, `${base},0`];
  for (let i = 0; i < teeth; i++) pts.push(`${tip},${(i + 0.5) * h}`, `${base},${(i + 1) * h}`);
  pts.push(`0,${H}`);
  return `<polygon points="${pts.join(' ')}" fill="#fff"/>`;
}

/** نجمة خماسية مفرغة (المغرب) */
function pentagram(cx: number, cy: number, r: number, stroke: string, width: number): string {
  const p = [0, 2, 4, 1, 3].map((k) => {
    const a = ((-90 + k * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `<polygon points="${p.join(' ')}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="miter"/>`;
}

type FlagDraw = (uid: string) => string;

interface FlagDef {
  name: string;
  draw: FlagDraw;
}

const towards = (x: number, y: number, tx: number, ty: number) => (Math.atan2(ty - y, tx - x) * 180) / Math.PI;

export const FLAGS: Record<string, FlagDef> = {
  jp: { name: 'اليابان', draw: () => rect(0, 0, W, H, '#fff') + `<circle cx="150" cy="100" r="60" fill="#BC002D"/>` },
  bd: { name: 'بنغلاديش', draw: () => rect(0, 0, W, H, '#006A4E') + `<circle cx="135" cy="100" r="60" fill="#F42A41"/>` },
  de: { name: 'ألمانيا', draw: () => h3('#000000', '#DD0000', '#FFCE00') },
  it: { name: 'إيطاليا', draw: () => v3('#009246', '#ffffff', '#CE2B37') },
  fr: { name: 'فرنسا', draw: () => v3('#0055A4', '#ffffff', '#EF4135') },
  ie: { name: 'أيرلندا', draw: () => v3('#169B62', '#ffffff', '#FF883E') },
  ci: { name: 'ساحل العاج', draw: () => v3('#F77F00', '#ffffff', '#009E60') },
  be: { name: 'بلجيكا', draw: () => v3('#000000', '#FDDA24', '#EF3340') },
  ng: { name: 'نيجيريا', draw: () => v3('#008751', '#ffffff', '#008751') },
  ml: { name: 'مالي', draw: () => v3('#14B53A', '#FCD116', '#CE1126') },
  gn: { name: 'غينيا', draw: () => v3('#CE1126', '#FCD116', '#009460') },
  nl: { name: 'هولندا', draw: () => h3('#AE1C28', '#ffffff', '#21468B') },
  ru: { name: 'روسيا', draw: () => h3('#ffffff', '#0039A6', '#D52B1E') },
  at: { name: 'النمسا', draw: () => h3('#ED2939', '#ffffff', '#ED2939') },
  hu: { name: 'المجر', draw: () => h3('#CD2A3E', '#ffffff', '#436F4D') },
  bg: { name: 'بلغاريا', draw: () => h3('#ffffff', '#00966E', '#D62612') },
  ee: { name: 'إستونيا', draw: () => h3('#0072CE', '#000000', '#ffffff') },
  lt: { name: 'ليتوانيا', draw: () => h3('#FDB913', '#006A44', '#C1272D') },
  ye: { name: 'اليمن', draw: () => h3('#CE1126', '#ffffff', '#000000') },
  pl: { name: 'بولندا', draw: () => h2('#ffffff', '#DC143C') },
  ua: { name: 'أوكرانيا', draw: () => h2('#0057B7', '#FFD700') },
  id: { name: 'إندونيسيا', draw: () => h2('#CE1126', '#ffffff') },
  se: { name: 'السويد', draw: () => rect(0, 0, W, H, '#006AA7') + rect(93.75, 0, 37.5, H, '#FECC00') + rect(0, 80, W, 40, '#FECC00') },
  fi: { name: 'فنلندا', draw: () => rect(0, 0, W, H, '#ffffff') + rect(83.3, 0, 50, H, '#002F6C') + rect(0, 72.7, W, 54.6, '#002F6C') },
  dk: { name: 'الدنمارك', draw: () => rect(0, 0, W, H, '#C8102E') + rect(97.3, 0, 32.4, H, '#ffffff') + rect(0, 85.7, W, 28.6, '#ffffff') },
  no: {
    name: 'النرويج',
    draw: () =>
      rect(0, 0, W, H, '#BA0C2F') +
      rect(81.8, 0, 54.6, H, '#ffffff') +
      rect(0, 75, W, 50, '#ffffff') +
      rect(95.5, 0, 27.2, H, '#00205B') +
      rect(0, 87.5, W, 25, '#00205B'),
  },
  kw: {
    name: 'الكويت',
    draw: () => h3('#007A3D', '#ffffff', '#CE1126') + `<polygon points="0,0 75,66.67 75,133.33 0,200" fill="#000000"/>`,
  },
  ae: {
    name: 'الإمارات',
    draw: () =>
      rect(75, 0, 225, H / 3, '#00732F') +
      rect(75, H / 3, 225, H / 3 + 0.5, '#ffffff') +
      rect(75, (2 * H) / 3, 225, H / 3 + 0.5, '#000000') +
      rect(0, 0, 75, H, '#EF3340'),
  },
  sd: { name: 'السودان', draw: () => h3('#D21034', '#ffffff', '#000000') + `<polygon points="0,0 100,100 0,200" fill="#007229"/>` },
  ps: { name: 'فلسطين', draw: () => h3('#000000', '#ffffff', '#007A3D') + `<polygon points="0,0 100,100 0,200" fill="#CE1126"/>` },
  jo: {
    name: 'الأردن',
    draw: () =>
      h3('#000000', '#ffffff', '#007A3D') +
      `<polygon points="0,0 150,100 0,200" fill="#CE1126"/>` +
      star(50, 100, 15, '#ffffff', -90, 7, 0.5),
  },
  qa: { name: 'قطر', draw: () => rect(0, 0, W, H, '#8A1538') + serrated(9, 75, 105) },
  bh: { name: 'البحرين', draw: () => rect(0, 0, W, H, '#CE1126') + serrated(5, 75, 110) },
  tr: {
    name: 'تركيا',
    draw: (u) => rect(0, 0, W, H, '#E30A17') + crescent(`${u}c`, 112, 100, 50, 125, 100, 40, '#ffffff') + star(168, 100, 22, '#ffffff', 180),
  },
  tn: {
    name: 'تونس',
    draw: (u) =>
      rect(0, 0, W, H, '#E70013') +
      `<circle cx="150" cy="100" r="50" fill="#ffffff"/>` +
      crescent(`${u}c`, 146, 100, 37, 156, 100, 30, '#E70013') +
      star(163, 100, 18, '#E70013', 180),
  },
  dz: {
    name: 'الجزائر',
    draw: (u) =>
      rect(0, 0, 150, H, '#006233') +
      rect(150, 0, 150, H, '#ffffff') +
      crescent(`${u}c`, 145, 100, 50, 160, 100, 41, '#D21034') +
      star(175, 100, 21, '#D21034', 180),
  },
  ly: {
    name: 'ليبيا',
    draw: (u) =>
      rect(0, 0, W, 50, '#E70013') +
      rect(0, 50, W, 100, '#000000') +
      rect(0, 150, W, 50, '#239E46') +
      crescent(`${u}c`, 142, 100, 30, 151, 100, 25, '#ffffff') +
      star(170, 100, 12, '#ffffff', 180),
  },
  pk: {
    name: 'باكستان',
    draw: (u) =>
      rect(0, 0, 75, H, '#ffffff') +
      rect(75, 0, 225, H, '#01411C') +
      crescent(`${u}c`, 185, 105, 56, 201, 92, 48, '#ffffff') +
      star(214, 78, 18, '#ffffff', towards(214, 78, 185, 105) + 180),
  },
  ma: { name: 'المغرب', draw: () => rect(0, 0, W, H, '#C1272D') + pentagram(150, 103, 48, '#006233', 7) },
  cn: {
    name: 'الصين',
    draw: () =>
      rect(0, 0, W, H, '#EE1C25') +
      star(50, 50, 30, '#FFFF00') +
      [
        [100, 20],
        [120, 40],
        [120, 70],
        [100, 90],
      ]
        .map(([x, y]) => star(x, y, 10, '#FFFF00', towards(x, y, 50, 50)))
        .join(''),
  },
  vn: { name: 'فيتنام', draw: () => rect(0, 0, W, H, '#DA251D') + star(150, 100, 60, '#FFFF00') },
  so: { name: 'الصومال', draw: () => rect(0, 0, W, H, '#4189DD') + star(150, 100, 42, '#ffffff') },
  br: {
    name: 'البرازيل',
    draw: (u) =>
      rect(0, 0, W, H, '#009C3B') +
      `<polygon points="150,18 282,100 150,182 18,100" fill="#FFDF00"/>` +
      `<clipPath id="${u}k"><circle cx="150" cy="100" r="52"/></clipPath>` +
      `<circle cx="150" cy="100" r="52" fill="#002776"/>` +
      `<path d="M 90,92 Q 150,70 212,112" stroke="#ffffff" stroke-width="9" fill="none" clip-path="url(#${u}k)"/>`,
  },
  ar: { name: 'الأرجنتين', draw: () => h3('#74ACDF', '#ffffff', '#74ACDF') + `<circle cx="150" cy="100" r="18" fill="#F6B40E"/>` },
  gr: {
    name: 'اليونان',
    draw: () => {
      const s = H / 9;
      let out = '';
      for (let i = 0; i < 9; i++) out += rect(0, i * s, W, s + 0.5, i % 2 === 0 ? '#0D5EAF' : '#ffffff');
      out += rect(0, 0, s * 5, s * 5, '#0D5EAF') + rect(0, s * 2, s * 5, s, '#ffffff') + rect(s * 2, 0, s, s * 5, '#ffffff');
      return out;
    },
  },
  es: { name: 'إسبانيا', draw: () => rect(0, 0, W, H, '#AA151B') + rect(0, 50, W, 100, '#F1BF00') },
  ch: { name: 'سويسرا', draw: () => rect(0, 0, W, H, '#DA291C') + rect(132, 40, 36, 120, '#ffffff') + rect(90, 82, 120, 36, '#ffffff') },
  ro: { name: 'رومانيا', draw: () => v3('#002B7F', '#FCD116', '#CE1126') },
  pe: { name: 'بيرو', draw: () => v3('#D91023', '#ffffff', '#D91023') },
  co: { name: 'كولومبيا', draw: () => rect(0, 0, W, 100, '#FCD116') + rect(0, 100, W, 50, '#003893') + rect(0, 150, W, 50, '#CE1126') },
  th: {
    name: 'تايلاند',
    draw: () => {
      const u = H / 6;
      return rect(0, 0, W, H, '#A51931') + rect(0, u, W, u * 4, '#F4F5F8') + rect(0, u * 2, W, u * 2, '#2D2A4A');
    },
  },
  cz: { name: 'التشيك', draw: () => h2('#ffffff', '#D7141A') + `<polygon points="0,0 150,100 0,200" fill="#11457E"/>` },
  cl: { name: 'تشيلي', draw: () => h2('#ffffff', '#D52B1E') + rect(0, 0, 100, 100, '#0039A6') + star(50, 50, 24, '#ffffff') },
  is: {
    name: 'آيسلندا',
    draw: () =>
      rect(0, 0, W, H, '#02529C') +
      rect(84, 0, 48, H, '#ffffff') +
      rect(0, 77.8, W, 44.4, '#ffffff') +
      rect(96, 0, 24, H, '#DC1E35') +
      rect(0, 88.9, W, 22.2, '#DC1E35'),
  },
  in: {
    name: 'الهند',
    draw: () => {
      let spokes = '';
      for (let i = 0; i < 24; i++) {
        const a = (i * 15 * Math.PI) / 180;
        spokes += `<line x1="150" y1="100" x2="${(150 + 24 * Math.cos(a)).toFixed(2)}" y2="${(100 + 24 * Math.sin(a)).toFixed(2)}" stroke="#000080" stroke-width="1.5"/>`;
      }
      return (
        h3('#FF9933', '#ffffff', '#138808') +
        `<circle cx="150" cy="100" r="25" fill="none" stroke="#000080" stroke-width="3"/>` +
        spokes +
        `<circle cx="150" cy="100" r="4" fill="#000080"/>`
      );
    },
  },
  mr: {
    name: 'موريتانيا',
    draw: (u) =>
      rect(0, 0, W, H, '#00A95C') +
      rect(0, 0, W, 28, '#D01C1F') +
      rect(0, 172, W, 28, '#D01C1F') +
      crescent(`${u}c`, 150, 98, 50, 150, 76, 46, '#FFD700') +
      star(150, 80, 17, '#FFD700'),
  },
  us: {
    name: 'الولايات المتحدة',
    draw: () => {
      const s = H / 13;
      let out = '';
      for (let i = 0; i < 13; i++) out += rect(0, i * s, W, s + 0.5, i % 2 === 0 ? '#B22234' : '#ffffff');
      const cw = 120;
      const ch = s * 7;
      out += rect(0, 0, cw, ch, '#3C3B6E');
      for (let r = 0; r < 9; r++) {
        const n = r % 2 === 0 ? 6 : 5;
        for (let c = 0; c < n; c++) {
          const x = ((r % 2 === 0 ? 2 * c + 1 : 2 * c + 2) * cw) / 12;
          out += star(x, ((r + 1) * ch) / 10, 4.6, '#ffffff');
        }
      }
      return out;
    },
  },
};

export const FLAG_CODES = Object.keys(FLAGS);

let counter = 0;
export function flagSvg(code: string): string | null {
  const def = FLAGS[code];
  if (!def) return null;
  const uid = `f${code}${++counter}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${def.draw(uid)}</svg>`;
}
