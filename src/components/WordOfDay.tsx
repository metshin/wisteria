import { useEffect } from 'react';
import type { Go } from '../route';
import { useStore } from '../store/store';
import { deckWords, dictUrl, wordOfDay } from '../logic/flashcards';
import { dayKey } from '../logic/session';
import WordContext from './WordContext';
import { SunflowerHead } from './Decor';

/** Home card: one word from your word bank each day, plus a way into flashcards. */
export default function WordOfDay({ go }: { go: Go }) {
  const { data, update } = useStore();
  const saved = data.settings.wordOfDay;
  const w = wordOfDay(data.wordBank, saved);
  const due = deckWords(data.wordBank, 'due').length;

  // Remember today's pick so adding words later today doesn't swap it.
  useEffect(() => {
    if (w && (saved?.id !== w.id || saved?.day !== dayKey(Date.now()))) {
      update((d) => ({ ...d, settings: { ...d.settings, wordOfDay: { day: dayKey(Date.now()), id: w.id } } }));
    }
  }, [w, saved, update]);

  if (!w) {
    return (
      <div className="card wotd">
        <div className="row"><SunflowerHead size={28} /><h3 style={{ margin: 0 }}>Word of the day</h3></div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Your word bank is empty. While practising, double-click a word you don't know and press <b>🌱 Add to word bank</b>.
          One of them will show up here every day.
        </p>
      </div>
    );
  }

  const setMeaning = (meaning: string) =>
    update((d) => ({ ...d, wordBank: d.wordBank.map((x) => (x.id === w.id ? { ...x, meaning } : x)) }));

  return (
    <div className="card blossom wotd fade-up">
      <div className="row">
        <SunflowerHead size={30} />
        <span className="muted small" style={{ fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Word of the day</span>
        <span className="spacer" />
        <a className="btn small ghost" href={dictUrl(w.text)} target="_blank" rel="noreferrer noopener" title="Opens merriam-webster.com in a new tab">Look up ↗</a>
      </div>
      <div className="wotd-word">{w.text}</div>
      {w.meaning ? (
        <div className="wotd-meaning">{w.meaning}</div>
      ) : (
        <textarea rows={2} placeholder="No meaning yet. Look it up and write it in your own words…" style={{ minHeight: 50 }}
          onBlur={(e) => e.target.value.trim() && setMeaning(e.target.value.trim())} aria-label={`Meaning of ${w.text}`} />
      )}
      {w.context && <div className="ctx"><WordContext text={w.context} word={w.text} /></div>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary small" onClick={() => go({ name: 'words', tab: 'cards' })}>
          🃏 Flashcards{due ? ` · ${due} due` : ''}
        </button>
        <span className="muted small">{data.wordBank.filter((x) => !x.learned).length} still learning · {data.wordBank.filter((x) => x.learned).length} learned</span>
      </div>
    </div>
  );
}
