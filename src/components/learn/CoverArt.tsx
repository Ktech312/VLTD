// Layered, on-brand cover art for Learn guide cards — a polished stopgap until
// real cover photos are dropped in (article.image). Each guide gets a distinct
// topical scene: gold line-art with soft fills, a spotlight, and a ground
// shadow so cards read as finished editorial covers, not floating icons.

const GOLD = "#C8CDD2";
const GOLD_DIM = "#B8873B";
const FILL = "rgba(203,208,213,0.10)";
const FILL_SOFT = "rgba(203,208,213,0.05)";

function Frame({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#241a0c" />
          <stop offset="55%" stopColor="#160f07" />
          <stop offset="100%" stopColor="#0c0805" />
        </linearGradient>
        <radialGradient id={`${id}-spot`} cx="0.5" cy="0.42" r="0.62">
          <stop offset="0%" stopColor="rgba(203,208,213,0.22)" />
          <stop offset="60%" stopColor="rgba(203,208,213,0.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <radialGradient id={`${id}-vig`} cx="0.5" cy="0.5" r="0.75">
          <stop offset="52%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
        </radialGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(203,208,213,0.28)" />
          <stop offset="100%" stopColor="rgba(203,208,213,0.04)" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${id}-bg)`} />
      <rect width="400" height="200" fill={`url(#${id}-spot)`} />
      {/* faint grid */}
      <g stroke={GOLD} strokeWidth="0.5" opacity="0.05">
        {[50, 130, 210, 290, 350].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="200" />
        ))}
        {[60, 120].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} />
        ))}
      </g>
      {/* ground shadow */}
      <ellipse cx="200" cy="176" rx="150" ry="16" fill="rgba(0,0,0,0.45)" />
      {children}
      <rect width="400" height="200" fill={`url(#${id}-vig)`} />
    </svg>
  );
}

function Motif({ slug, barId }: { slug: string; barId: string }) {
  const s = { fill: "none", stroke: GOLD, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const dim = { ...s, stroke: GOLD_DIM, strokeWidth: 2, opacity: 0.55 };

  switch (slug) {
    case "before-you-sell":
      return (
        <g>
          <path {...dim} d="M40 150 L130 104 L200 128 L310 52" />
          <path {...dim} d="M292 52 H310 V70" />
          <g transform="translate(150 44) rotate(6)">
            <path d="M0 22 L78 22 L124 78 L66 132 L0 132 Z" fill={FILL} stroke={GOLD} strokeWidth="3" strokeLinejoin="round" />
            <circle cx="30" cy="50" r="11" fill="none" stroke={GOLD} strokeWidth="3" />
            <circle cx="30" cy="50" r="3" fill={GOLD} />
          </g>
        </g>
      );
    case "insurance-basics":
      return (
        <g>
          <circle cx="200" cy="98" r="88" {...dim} />
          <circle cx="200" cy="98" r="66" fill={FILL_SOFT} stroke={GOLD_DIM} strokeWidth="1.5" opacity="0.6" />
          <g transform="translate(200 98)">
            <path d="M0 -60 L48 -40 V8 C48 44 26 66 0 78 C-26 66 -48 44 -48 8 V-40 Z" fill={FILL} stroke={GOLD} strokeWidth="3.5" strokeLinejoin="round" />
            <path fill="none" stroke={GOLD} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" d="M-20 4 L-5 21 L24 -16" />
          </g>
        </g>
      );
    case "pricing-with-confidence":
      return (
        <g transform="translate(110 34)">
          <rect x="0" y="86" width="30" height="66" fill={`url(#${barId})`} stroke={GOLD} strokeWidth="2.5" />
          <rect x="48" y="54" width="30" height="98" fill={`url(#${barId})`} stroke={GOLD} strokeWidth="2.5" />
          <rect x="96" y="28" width="30" height="124" fill={`url(#${barId})`} stroke={GOLD} strokeWidth="2.5" />
          <rect x="144" y="6" width="30" height="146" fill={`url(#${barId})`} stroke={GOLD} strokeWidth="2.5" />
          <path fill="none" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" d="M12 100 L62 70 L110 44 L158 18" />
          <path fill="none" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" d="M142 18 H158 V34" />
        </g>
      );
    case "photographing-items":
      return (
        <g transform="translate(112 40)">
          <rect x="0" y="30" width="176" height="112" rx="14" fill={FILL} stroke={GOLD} strokeWidth="3" />
          <path fill={FILL} stroke={GOLD} strokeWidth="3" strokeLinejoin="round" d="M50 30 L64 10 H112 L126 30" />
          <circle cx="88" cy="88" r="38" fill={FILL_SOFT} stroke={GOLD} strokeWidth="3" />
          <circle cx="88" cy="88" r="22" fill="none" stroke={GOLD_DIM} strokeWidth="2.5" opacity="0.7" />
          <circle cx="150" cy="50" r="5" fill={GOLD} />
        </g>
      );
    case "storage-and-labels":
      return (
        <g transform="translate(96 30)">
          <path d="M18 66 L74 46 L130 66 L130 130 L74 150 L18 130 Z" fill={FILL} stroke={GOLD} strokeWidth="3" strokeLinejoin="round" />
          <path fill="none" stroke={GOLD} strokeWidth="2.5" d="M18 66 L74 86 L130 66 M74 86 V150" />
          <path d="M140 44 L196 24 L236 38 L236 92 L180 112 L140 98 Z" fill={FILL_SOFT} stroke={GOLD_DIM} strokeWidth="2.5" strokeLinejoin="round" opacity="0.75" />
          <g transform="translate(158 104)" fill={GOLD}>
            <rect x="0" y="0" width="9" height="9" />
            <rect x="15" y="0" width="9" height="9" />
            <rect x="0" y="15" width="9" height="9" />
            <rect x="15" y="15" width="9" height="9" opacity="0.55" />
            <rect x="30" y="6" width="6" height="6" opacity="0.7" />
          </g>
        </g>
      );
    case "building-exhibitions":
      return (
        <g transform="translate(64 34)">
          <path d="M132 -18 L92 26 H172 Z" fill={FILL_SOFT} stroke={GOLD_DIM} strokeWidth="1.5" opacity="0.7" />
          <path fill="none" stroke={GOLD_DIM} strokeWidth="2" opacity="0.6" d="M-4 132 H276" />
          <rect x="20" y="38" width="60" height="80" rx="4" fill={FILL} stroke={GOLD} strokeWidth="3" />
          <rect x="108" y="22" width="64" height="96" rx="4" fill={FILL} stroke={GOLD} strokeWidth="3.5" />
          <rect x="200" y="46" width="56" height="72" rx="4" fill={FILL} stroke={GOLD} strokeWidth="3" />
        </g>
      );
    case "market-comps":
      return (
        <g transform="translate(104 40)">
          <rect x="0" y="74" width="26" height="54" fill={`url(#${barId})`} stroke={GOLD_DIM} strokeWidth="2" opacity="0.8" />
          <rect x="36" y="48" width="26" height="80" fill={`url(#${barId})`} stroke={GOLD_DIM} strokeWidth="2" opacity="0.8" />
          <rect x="72" y="62" width="26" height="66" fill={`url(#${barId})`} stroke={GOLD_DIM} strokeWidth="2" opacity="0.8" />
          <circle cx="128" cy="56" r="44" fill={FILL_SOFT} stroke={GOLD} strokeWidth="3.5" />
          <path fill="none" stroke={GOLD} strokeWidth="4.5" strokeLinecap="round" d="M160 88 L196 124" />
          <path fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" opacity="0.75" d="M110 56 H146 M128 38 V74" />
        </g>
      );
    default:
      return (
        <g transform="translate(168 58)">
          <path d="M32 0 L41 24 L66 26 L46 43 L52 68 L32 54 L12 68 L18 43 L-2 26 L23 24 Z" fill={FILL} stroke={GOLD} strokeWidth="3" strokeLinejoin="round" />
        </g>
      );
  }
}

export default function CoverArt({ slug, className = "" }: { slug: string; className?: string }) {
  const id = `cov-${slug}`;
  return (
    <div className={`overflow-hidden ${className}`}>
      <Frame id={id}>
        <Motif slug={slug} barId={`${id}-bar`} />
      </Frame>
    </div>
  );
}
