import { useId } from 'react';
import type { FruitKind } from '../types';

export const FRUITS: { kind: FruitKind; label: string; ripe: string }[] = [
  { kind: 'tomato', label: 'Tomato', ripe: '#e5533d' },
  { kind: 'strawberry', label: 'Strawberry', ripe: '#e8475f' },
  { kind: 'peach', label: 'Peach', ripe: '#f7a072' },
  { kind: 'lemon', label: 'Lemon', ripe: '#f7d046' },
  { kind: 'cherry', label: 'Cherry', ripe: '#c8243f' },
  { kind: 'kiwi', label: 'Kiwi', ripe: '#8cc63f' },
];

const UNRIPE = '#b9d89a';

/** A fruit that "ripens" from green to its colour as `ripeness` goes 0 → 1. */
export default function FruitIcon({ kind, size = 120, ripeness = 1 }: { kind: FruitKind; size?: number; ripeness?: number }) {
  const id = useId().replace(/:/g, '');
  const ripe = FRUITS.find((f) => f.kind === kind)!.ripe;
  const r = Math.max(0, Math.min(1, ripeness));
  const body = shape(kind);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${kind}, ${Math.round(r * 100)}% ripe`}>
      <defs>
        <clipPath id={`c${id}`}>{body.clip}</clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect x="0" y="0" width="100" height="100" fill={UNRIPE} />
        <rect x="0" y={100 - r * 100} width="100" height={r * 100} fill={ripe} style={{ transition: 'y 1s linear, height 1s linear' }} />
        {body.overlay}
      </g>
      {body.top}
    </svg>
  );
}

function shape(kind: FruitKind) {
  const leaf = (x: number, y: number, rot: number) => (
    <path d={`M${x} ${y} q 10 -10 20 -2 q -10 8 -20 2z`} fill="#5e8c61" transform={`rotate(${rot} ${x} ${y})`} />
  );
  switch (kind) {
    case 'tomato':
      return {
        clip: <ellipse cx="50" cy="58" rx="36" ry="31" />,
        overlay: <ellipse cx="38" cy="46" rx="8" ry="5" fill="#fff" opacity="0.35" />,
        top: (
          <g fill="#4f8a4f">
            <path d="M50 30 l-14 -4 l9 7 l-12 4 l14 1 l3 8 l3 -8 l14 -1 l-12 -4 l9 -7z" />
            <rect x="48.5" y="20" width="3" height="10" rx="1.5" />
          </g>
        ),
      };
    case 'strawberry':
      return {
        clip: <path d="M50 92 C 22 70 14 46 26 34 C 36 26 64 26 74 34 C 86 46 78 70 50 92Z" />,
        overlay: (
          <g fill="#fff3b0" opacity="0.9">
            {[[38, 44], [50, 42], [62, 44], [33, 56], [45, 55], [57, 55], [68, 56], [40, 67], [52, 67], [62, 67], [47, 78], [55, 78]].map(([x, y]) => (
              <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.6" ry="2.4" />
            ))}
          </g>
        ),
        top: (
          <g fill="#4f8a4f">
            <path d="M50 34 l-18 -6 l12 9 l-10 6 l16 -4 l0 6 l0 -6 l16 4 l-10 -6 l12 -9z" />
            <rect x="48.5" y="18" width="3" height="14" rx="1.5" />
          </g>
        ),
      };
    case 'peach':
      return {
        clip: <path d="M50 30 C 20 26 12 60 30 78 C 40 88 60 88 70 78 C 88 60 80 26 50 30Z" />,
        overlay: <path d="M50 32 C 44 50 44 66 50 86" stroke="#d97a52" strokeWidth="2" fill="none" opacity="0.5" />,
        top: <>{leaf(52, 30, -20)}<rect x="48.5" y="20" width="3" height="11" rx="1.5" fill="#7a5a3a" /></>,
      };
    case 'lemon':
      return {
        clip: <path d="M14 58 C 14 40 32 30 50 30 C 68 30 86 40 86 58 C 86 76 68 84 50 84 C 32 84 14 76 14 58Z M10 58 l6 -4 l0 8z M90 58 l-6 -4 l0 8z" />,
        overlay: <ellipse cx="36" cy="46" rx="9" ry="4" fill="#fff" opacity="0.35" />,
        top: leaf(56, 30, -30),
      };
    case 'cherry':
      return {
        clip: <><circle cx="34" cy="68" r="18" /><circle cx="68" cy="72" r="18" /></>,
        overlay: <><circle cx="28" cy="62" r="4" fill="#fff" opacity="0.4" /><circle cx="62" cy="66" r="4" fill="#fff" opacity="0.4" /></>,
        top: (
          <g>
            <path d="M34 50 Q 44 24 58 14 M68 54 Q 64 30 58 14" stroke="#5e8c61" strokeWidth="2.5" fill="none" />
            {leaf(58, 14, 10)}
          </g>
        ),
      };
    case 'kiwi':
      return {
        clip: <circle cx="50" cy="56" r="34" />,
        overlay: (
          <g>
            <circle cx="50" cy="56" r="26" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="8" />
            <ellipse cx="50" cy="56" rx="10" ry="8" fill="#f7f3d6" />
            {Array.from({ length: 12 }, (_, i) => (
              <ellipse key={i} cx="50" cy="40" rx="1.3" ry="2.6" fill="#2b2b2b" transform={`rotate(${i * 30} 50 56)`} />
            ))}
          </g>
        ),
        top: <circle cx="50" cy="56" r="34" fill="none" stroke="#8a6a3f" strokeWidth="4" />,
      };
  }
}
