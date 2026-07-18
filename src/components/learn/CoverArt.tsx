// Layered, on-brand cover art for Learn guide cards — a stopgap until real
// cover photos are dropped in (article.image). Each guide gets a distinct
// topical scene in warm gold line-art over a warm-dark ground, so cards read
// as finished editorial covers rather than plain icon tiles.

const GOLD = "#F5B548";
const GOLD_DIM = "#B8873B";

function Frame({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c1408" />
          <stop offset="55%" stopColor="#120d07" />
          <stop offset="100%" stopColor="#0a0805" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.7" cy="0.25" r="0.8">
          <stop offset="0%" stopColor="rgba(245,181,72,0.20)" />
          <stop offset="55%" stopColor="rgba(245,181,72,0.03)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <radialGradient id={`${id}-vig`} cx="0.5" cy="0.5" r="0.75">
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${id}-bg)`} />
      <rect width="400" height="200" fill={`url(#${id}-glow)`} />
      {/* faint grid for depth */}
      <g stroke={GOLD} strokeWidth="0.5" opacity="0.06">
        {[40, 120, 200, 280, 360].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="200" />
        ))}
        {[50, 100, 150].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} />
        ))}
      </g>
      {children}
      <rect width="400" height="200" fill={`url(#${id}-vig)`} />
    </svg>
  );
}

function Motif({ slug }: { slug: string }) {
  const s = { fill: "none", stroke: GOLD, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const dim = { ...s, stroke: GOLD_DIM, opacity: 0.5 };

  switch (slug) {
    case "before-you-sell":
      return (
        <g>
          {/* rising trend behind */}
          <path {...dim} d="M60 150 L140 110 L200 130 L300 60" />
          <path {...dim} d="M285 60 H300 V75" />
          {/* price tag */}
          <g transform="translate(150 60) rotate(8)">
            <path {...s} d="M0 18 L70 18 L110 70 L60 118 L0 118 Z" />
            <circle cx="26" cy="42" r="9" {...s} />
          </g>
        </g>
      );
    case "insurance-basics":
      return (
        <g>
          <circle cx="205" cy="100" r="86" {...dim} />
          <circle cx="205" cy="100" r="64" {...dim} />
          <g transform="translate(205 100)">
            <path {...s} d="M0 -56 L44 -38 V6 C44 40 24 60 0 72 C-24 60 -44 40 -44 6 V-38 Z" />
            <path {...s} strokeWidth="3" d="M-18 4 L-4 20 L22 -14" />
          </g>
        </g>
      );
    case "pricing-with-confidence":
      return (
        <g transform="translate(120 40)">
          {/* bars */}
          <rect {...s} x="0" y="80" width="26" height="60" />
          <rect {...s} x="42" y="52" width="26" height="88" />
          <rect {...s} x="84" y="30" width="26" height="110" />
          <rect {...dim} x="126" y="8" width="26" height="132" />
          {/* trend */}
          <path {...s} strokeWidth="2.4" d="M8 96 L54 66 L96 44 L140 18" />
          <path {...s} d="M126 18 H140 V32" />
        </g>
      );
    case "photographing-items":
      return (
        <g transform="translate(120 46)">
          <rect {...s} x="0" y="26" width="160" height="104" rx="12" />
          <path {...s} d="M46 26 L58 10 H102 L114 26" />
          <circle cx="80" cy="80" r="34" {...s} />
          <circle cx="80" cy="80" r="20" {...dim} />
          <circle cx="134" cy="46" r="4" fill={GOLD} stroke="none" />
        </g>
      );
    case "storage-and-labels":
      return (
        <g transform="translate(96 40)">
          {/* stacked boxes */}
          <path {...s} d="M20 60 L70 44 L120 60 L120 118 L70 134 L20 118 Z" />
          <path {...s} d="M20 60 L70 76 L120 60 M70 76 V134" />
          <path {...dim} d="M132 40 L182 24 L212 34 L212 84 L162 100 L132 90 Z" />
          {/* QR label */}
          <g transform="translate(150 96)" stroke={GOLD} strokeWidth="0" fill={GOLD}>
            <rect x="0" y="0" width="8" height="8" />
            <rect x="14" y="0" width="8" height="8" />
            <rect x="0" y="14" width="8" height="8" />
            <rect x="14" y="14" width="8" height="8" opacity="0.5" />
            <rect x="28" y="6" width="6" height="6" opacity="0.6" />
          </g>
        </g>
      );
    case "building-exhibitions":
      return (
        <g transform="translate(70 42)">
          {/* gallery wall with framed works */}
          <path {...dim} d="M0 118 H260" />
          <rect {...s} x="20" y="34" width="56" height="72" rx="3" />
          <rect {...s} x="102" y="20" width="60" height="86" rx="3" />
          <rect {...s} x="188" y="40" width="52" height="66" rx="3" />
          {/* spotlight cone */}
          <path {...dim} d="M132 -14 L96 20 H168 Z" />
        </g>
      );
    case "market-comps":
      return (
        <g transform="translate(110 44)">
          {/* comparison bars */}
          <rect {...dim} x="0" y="70" width="22" height="52" />
          <rect {...dim} x="34" y="46" width="22" height="76" />
          <rect {...dim} x="68" y="58" width="22" height="64" />
          {/* magnifier */}
          <circle cx="120" cy="58" r="40" {...s} />
          <path {...s} strokeWidth="3" d="M149 87 L182 120" />
          <path {...s} d="M104 58 H136 M120 42 V74" opacity="0.7" />
        </g>
      );
    default:
      return (
        <g transform="translate(170 60)">
          <path {...s} d="M30 0 L38 22 L60 24 L42 40 L48 62 L30 50 L12 62 L18 40 L0 24 L22 22 Z" />
        </g>
      );
  }
}

export default function CoverArt({ slug, className = "" }: { slug: string; className?: string }) {
  const id = `cov-${slug}`;
  return (
    <div className={`overflow-hidden ${className}`}>
      <Frame id={id}>
        <Motif slug={slug} />
      </Frame>
    </div>
  );
}
