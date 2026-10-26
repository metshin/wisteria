import { useState, type ButtonHTMLAttributes, type CSSProperties, type MouseEvent } from 'react';

/* Small inline-SVG flowers and plants. No images, nothing loaded from the web. */

export function Daisy({ size = 40, petal = '#fff', center = '#f7d56b', className = '', style }: {
  size?: number; petal?: string; center?: string; className?: string; style?: CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} style={style} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="20" cy="9" rx="4.2" ry="8" fill={petal} stroke="#e8e2d2" strokeWidth="0.6"
          transform={`rotate(${i * 45} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="5.5" fill={center} />
      <circle cx="18.4" cy="18.6" r="1.4" fill="#fff" opacity="0.6" />
    </svg>
  );
}

function Stem({ h, x = 20 }: { h: number; x?: number }) {
  return (
    <>
      <path d={`M${x} 40 Q ${x - 2} ${40 + h / 2} ${x} ${40 + h}`} stroke="#5e8c61" strokeWidth="2.4" fill="none" />
      <path d={`M${x} ${40 + h * 0.55} q 9 -6 12 -1 q -6 5 -12 1z`} fill="#7fae7a" />
      <path d={`M${x} ${40 + h * 0.75} q -9 -6 -12 -1 q 6 5 12 1z`} fill="#7fae7a" />
    </>
  );
}

export function StemDaisy({ height = 90, petal = '#fff', delay = 0 }: { height?: number; petal?: string; delay?: number }) {
  return (
    <svg width={40} height={height} viewBox={`0 0 40 ${40 + (height - 40)}`} className="sway"
      style={{ animationDelay: `${delay}s`, overflow: 'visible' }} aria-hidden>
      <Stem h={height - 40} />
      <g>
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="20" cy="9" rx="4.2" ry="8" fill={petal} stroke="#e8e2d2" strokeWidth="0.6"
            transform={`rotate(${i * 45} 20 20)`} />
        ))}
        <circle cx="20" cy="20" r="5.5" fill="#f7d56b" />
      </g>
    </svg>
  );
}

export function Tulip({ height = 80, color = '#f5b5c8', delay = 0 }: { height?: number; color?: string; delay?: number }) {
  return (
    <svg width={40} height={height} viewBox={`0 0 40 ${height}`} className="sway-soft"
      style={{ animationDelay: `${delay}s`, overflow: 'visible' }} aria-hidden>
      <Stem h={height - 40} />
      <path d="M10 18 Q 10 38 20 38 Q 30 38 30 18 L 25 24 L 20 14 L 15 24 Z" fill={color} />
      <path d="M20 14 L 15 24 Q 17 36 20 38 Q 23 36 25 24 Z" fill="#fff" opacity="0.25" />
    </svg>
  );
}

export function Sunflower({ height = 110, delay = 0 }: { height?: number; delay?: number }) {
  return (
    <svg width={44} height={height} viewBox={`0 0 40 ${height}`} className="sway"
      style={{ animationDelay: `${delay}s`, overflow: 'visible' }} aria-hidden>
      <Stem h={height - 40} />
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={i} cx="20" cy="7" rx="3.4" ry="8" fill="#f7c948" transform={`rotate(${i * 30} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="7" fill="#8a5a2b" />
      <circle cx="20" cy="20" r="4" fill="#6b4220" />
    </svg>
  );
}

/** Just a sunflower's head, for small spots like card headers. */
export function SunflowerHead({ size = 30, className = '', style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} style={style} aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={i} cx="20" cy="7" rx="3.6" ry="7.5" fill="#f7c948" transform={`rotate(${i * 30} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="8" fill="#8a5a2b" />
      <circle cx="20" cy="20" r="4.6" fill="#6b4220" />
    </svg>
  );
}

export function Sprout({ size = 34, className = 'sway-soft', grown = 1 }: { size?: number; className?: string; grown?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" className={className} aria-hidden>
      <path d="M17 33 V 16" stroke="#5e8c61" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17 18 C 8 18 4 12 5 6 C 12 6 17 10 17 18Z" fill="#8fbf86" style={{ transform: `scale(${grown})`, transformOrigin: '17px 18px' }} />
      <path d="M17 16 C 25 16 30 10 29 4 C 21 4 17 8 17 16Z" fill="#a8c69f" style={{ transform: `scale(${grown})`, transformOrigin: '17px 16px' }} />
    </svg>
  );
}

const WISTERIA = ['#e3d4f5', '#d0bbef', '#bea2e6', '#ab8ad9', '#9673cb', '#8160bd'];

/** One hanging wisteria raceme: florets in rows, wide and pale at the top, narrow and deeper at the tip. */
function Raceme({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const rows: [number, number][] = [[3, 2], [3, 5.2], [2, 8.4], [2, 11.4], [1, 14.2], [1, 16.8]];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {rows.map(([n, dy], r) =>
        Array.from({ length: n }, (_, i) => (
          <circle key={`${r}-${i}`} cx={(i - (n - 1) / 2) * 3 + (r % 2 ? 0.5 : -0.5)} cy={dy} r={r < 2 ? 1.9 : r < 4 ? 1.7 : 1.45} fill={WISTERIA[r]} />
        )),
      )}
    </g>
  );
}

/** A small wisteria tree for the logo: a twisting trunk, a leafy crown and blossoms hanging below it. */
export function WisteriaTree({ size = 30, className = 'sway-soft', delay = 0 }: { size?: number; className?: string; delay?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" className={className}
      style={{ transformOrigin: 'bottom center', animationDelay: `${delay}s`, flex: 'none' }} aria-hidden>
      <path d="M17 33 C 15 28 19 25 17 20 C 16 17 17 15 17 13" stroke="#7a5a3a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M17 18 C 13 17 11 15 10 13" stroke="#7a5a3a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g fill="#8fbf86">
        <ellipse cx="10" cy="10" rx="7" ry="5" />
        <ellipse cx="24" cy="10" rx="7" ry="5" />
        <ellipse cx="17" cy="7" rx="8" ry="6" />
      </g>
      <g fill="#a8c69f">
        <ellipse cx="13" cy="6" rx="4" ry="3" />
        <ellipse cx="22" cy="6.5" rx="3.6" ry="2.6" />
      </g>
      <Raceme x={6} y={12} scale={0.62} />
      <Raceme x={12.5} y={13} scale={0.7} />
      <Raceme x={22.5} y={13} scale={0.7} />
      <Raceme x={28.5} y={12} scale={0.62} />
    </svg>
  );
}

export function Leaf({ size = 28, color = '#a8c69f', className = '', style }: {
  size?: number; color?: string; className?: string; style?: CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" className={className} style={style} aria-hidden>
      <path d="M4 26 C 4 12 12 4 26 4 C 26 18 18 26 4 26Z" fill={color} />
      <path d="M4 26 L 20 10" stroke="#fff" strokeWidth="1.3" opacity="0.6" />
    </svg>
  );
}

export function WiltedFlower({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-label="needs fixing" role="img">
      <path d="M15 29 V 16 Q 15 9 21 9" stroke="#9aa58f" strokeWidth="2.2" fill="none" />
      <g transform="rotate(110 22 11)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="22" cy="6.5" rx="2.6" ry="4.4" fill="#d9b7a8" transform={`rotate(${r} 22 11)`} />
        ))}
        <circle cx="22" cy="11" r="2.6" fill="#b89a5d" />
      </g>
    </svg>
  );
}

export function SpinningDaisy({ size = 40, label = 'Loading…' }: { size?: number; label?: string }) {
  return (
    <div className="center" style={{ padding: 20 }}>
      <Daisy size={size} className="spin" />
      <div className="muted small">{label}</div>
    </div>
  );
}

/** A potted plant whose leaves fill in as `value` approaches `max`. */
export function FlowerPot({ value, max, color = '#f5b5c8' }: { value: number; max: number; color?: string }) {
  const f = max > 0 ? Math.min(1, value / max) : 0;
  const blooms = Math.round(f * 5);
  return (
    <svg width="70" height="80" viewBox="0 0 70 80" aria-hidden>
      <g style={{ transform: `scaleY(${0.25 + f * 0.75})`, transformOrigin: '35px 56px', transition: 'transform 0.4s' }}>
        <path d="M35 56 V 14" stroke="#5e8c61" strokeWidth="3" />
        <path d="M35 40 q 14 -8 18 -2 q -9 7 -18 2z" fill="#8fbf86" />
        <path d="M35 32 q -14 -8 -18 -2 q 9 7 18 2z" fill="#8fbf86" />
      </g>
      {Array.from({ length: blooms }, (_, i) => {
        const pos = [[35, 12], [22, 22], [48, 20], [26, 34], [45, 33]][i];
        return (
          <g key={i} className="pop-in" style={{ transformOrigin: `${pos[0]}px ${pos[1]}px` }}>
            {[0, 72, 144, 216, 288].map((r) => (
              <circle key={r} cx={pos[0]} cy={pos[1] - 4} r="3.2" fill={color} transform={`rotate(${r} ${pos[0]} ${pos[1]})`} />
            ))}
            <circle cx={pos[0]} cy={pos[1]} r="2.4" fill="#f7d56b" />
          </g>
        );
      })}
      <path d="M16 56 H 54 L 50 78 H 20 Z" fill="#c98a5e" />
      <rect x="13" y="52" width="44" height="8" rx="3" fill="#b5764a" />
    </svg>
  );
}

/** Score flower: sprout → bud → bloom by percentage. */
export function ScoreFlower({ pct, size = 140 }: { pct: number; size?: number }) {
  const stage = pct >= 80 ? 'bloom' : pct >= 50 ? 'bud' : 'sprout';
  const stemTop = 60 - Math.min(1, pct / 100) * 30;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={`${stage}, ${pct}%`} role="img">
      <ellipse cx="50" cy="94" rx="30" ry="5" fill="#d8c7a8" />
      <g className="sway-soft">
        <path d={`M50 92 V ${stemTop}`} stroke="#5e8c61" strokeWidth="3.4" strokeLinecap="round"
          style={{ animation: 'grow-up 0.9s ease both', transformOrigin: '50px 92px' }} />
        <path d="M50 78 C 36 78 30 70 30 62 C 42 62 50 68 50 78Z" fill="#8fbf86" />
        <path d="M50 72 C 64 72 70 64 70 56 C 58 56 50 62 50 72Z" fill="#a8c69f" />
        {stage === 'bud' && (
          <g className="bloom-open">
            <ellipse cx="50" cy={stemTop - 6} rx="7" ry="10" fill="#f5b5c8" />
            <path d={`M43 ${stemTop - 2} Q 50 ${stemTop + 6} 57 ${stemTop - 2}`} fill="#8fbf86" />
          </g>
        )}
        {stage === 'bloom' && (
          <g className="bloom-open">
            {Array.from({ length: 8 }, (_, i) => (
              <ellipse key={i} cx="50" cy={stemTop - 12} rx="6" ry="11" fill="#f5b5c8"
                transform={`rotate(${i * 45} 50 ${stemTop})`} />
            ))}
            <circle cx="50" cy={stemTop} r="7.5" fill="#f7d56b" />
          </g>
        )}
      </g>
    </svg>
  );
}

export function FallingPetals({ count = 28 }: { count?: number }) {
  const [petals] = useState(() =>
    Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      dur: 3 + Math.random() * 3,
      delay: Math.random() * 1.5,
      drift: Math.random() * 120 - 60,
      hue: Math.random() < 0.3 ? '#fde3ec' : Math.random() < 0.5 ? '#f7d56b' : '#f5b5c8',
    })),
  );
  return (
    <div className="falling-petals" aria-hidden>
      {petals.map((p, i) => (
        <span key={i} style={{
          left: `${p.left}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
          background: p.hue, ['--drift' as string]: `${p.drift}px`,
        }} />
      ))}
    </div>
  );
}

/** Button that throws a few petals when clicked. */
export function PetalButton({ onClick, children, className = 'btn primary', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const [bursts, setBursts] = useState<number[]>([]);
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    const id = Date.now();
    setBursts((b) => [...b, id]);
    setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 700);
    onClick?.(e);
  };
  return (
    <button {...rest} className={className} onClick={handle}>
      {children}
      {bursts.map((id) =>
        Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return (
            <span key={`${id}-${i}`} className="petal-burst-piece"
              style={{ ['--dx' as string]: `${Math.cos(a) * 34}px`, ['--dy' as string]: `${Math.sin(a) * 26}px` }} />
          );
        }),
      )}
    </button>
  );
}

/** Flower strip along the bottom of the home screen. */
export function Garden() {
  const plants = [
    <Tulip key="a" height={70} color="#f5b5c8" delay={0.2} />,
    <StemDaisy key="b" height={95} delay={0.8} />,
    <Sunflower key="c" height={120} delay={0.4} />,
    <Tulip key="d" height={85} color="#f8c19a" delay={1.1} />,
    <StemDaisy key="e" height={75} petal="#fde3ec" delay={0.1} />,
    <Sprout key="f" size={34} />,
    <Tulip key="g" height={95} color="#e9a8d6" delay={0.6} />,
    <StemDaisy key="h" height={105} delay={1.4} />,
    <Sunflower key="i" height={95} delay={0.9} />,
    <Tulip key="j" height={65} color="#f5b5c8" delay={1.7} />,
    <StemDaisy key="k" height={80} petal="#fff7c2" delay={0.3} />,
  ];
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-around',
      alignItems: 'flex-end', pointerEvents: 'none', zIndex: 0, opacity: 0.85,
      background: 'linear-gradient(transparent 70%, rgba(168,198,159,0.35))', height: 130,
    }} aria-hidden>
      {plants}
    </div>
  );
}

export function CornerLeaves() {
  return (
    <div aria-hidden style={{ position: 'fixed', pointerEvents: 'none', zIndex: 0, inset: 0 }}>
      <Leaf size={60} className="sway" style={{ position: 'absolute', top: 70, left: -10, opacity: 0.5 }} />
      <Leaf size={40} color="#8fbf86" className="sway-soft" style={{ position: 'absolute', top: 120, left: 22, opacity: 0.4 }} />
      <Leaf size={54} className="sway-soft" style={{ position: 'absolute', top: 80, right: -6, opacity: 0.45, transform: 'scaleX(-1)' }} />
    </div>
  );
}
