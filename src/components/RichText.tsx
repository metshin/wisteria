import { Fragment } from 'react';

/**
 * Shows question text that may contain <u>underlined</u> parts and [[fig:N]] chart/table images.
 * Parsed by hand (never as HTML), so pasted text can't inject markup.
 */
export default function RichText({ text, figures }: { text: string; figures?: string[] }) {
  const parts = text.split(/(\[\[fig:\d+\]\])/);
  return (
    <>
      {parts.map((p, i) => {
        const fig = p.match(/^\[\[fig:(\d+)\]\]$/);
        if (fig) {
          const src = figures?.[Number(fig[1])];
          return src ? (
            <img key={i} src={src} alt="Chart or table from the question" className="figure-img" />
          ) : (
            <span key={i} className="chip warn">figure missing</span>
          );
        }
        // The image is a block already, so drop the blank lines around it.
        const t = p.replace(i > 0 ? /^\n+/ : /^$/, '').replace(i < parts.length - 1 ? /\n+$/ : /$^/, '');
        return <Fragment key={i}>{underlines(t)}</Fragment>;
      })}
    </>
  );
}

function underlines(s: string) {
  const bits = s.split(/(<u>[\s\S]*?<\/u>|^Text \d$)/m);
  return bits.map((b, i) => {
    const m = b.match(/^<u>([\s\S]*)<\/u>$/);
    if (m) return <u key={i}>{m[1]}</u>;
    if (/^Text \d$/.test(b)) return <b key={i} style={{ fontFamily: 'var(--font)' }}>{b}</b>;
    return <Fragment key={i}>{b}</Fragment>;
  });
}
