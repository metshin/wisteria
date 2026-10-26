import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { shuffle } from '../logic/buildModule';
import { BOX_DAYS, deckWords, dictUrl, review, type Deck } from '../logic/flashcards';
import WordContext from './WordContext';
import { Daisy, FallingPetals, SunflowerHead } from './Decor';

const DECK_LABEL: Record<Deck, string> = { due: 'Due today', learning: 'All still learning', all: 'All words' };

/** Flip-card practice for the word bank, with simple spaced repetition. */
export default function Flashcards() {
  const { data, update } = useStore();
  const [deck, setDeck] = useState<Deck>('due');
  const [meaningFirst, setMeaningFirst] = useState(false);
  /** Ids still to go this round (front of the array = current card). Null = not started. */
  const [queue, setQueue] = useState<string[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ got: 0, again: 0, missed: [] as string[] });

  const counts = useMemo(() => ({
    due: deckWords(data.wordBank, 'due').length,
    learning: deckWords(data.wordBank, 'learning').length,
    all: data.wordBank.length,
  }), [data.wordBank]);

  const start = (ids: string[]) => {
    setQueue(shuffle(ids));
    setFlipped(false);
    setTally({ got: 0, again: 0, missed: [] });
  };

  const current = queue?.length ? data.wordBank.find((w) => w.id === queue[0]) : undefined;

  const answer = useCallback((gotIt: boolean) => {
    if (!current || !queue) return;
    update((d) => ({ ...d, wordBank: d.wordBank.map((w) => (w.id === current.id ? review(w, gotIt) : w)) }));
    setTally((t) => gotIt
      ? { ...t, got: t.got + 1 }
      : { ...t, again: t.again + 1, missed: t.missed.includes(current.id) ? t.missed : [...t.missed, current.id] });
    // A missed card goes to the back of this round so you see it again.
    setQueue(gotIt ? queue.slice(1) : [...queue.slice(1), current.id]);
    setFlipped(false);
  }, [current, queue, update]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
      else if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) answer(false);
      else if (flipped && (e.key === '2' || e.key === 'ArrowRight')) answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, flipped, answer]);

  if (!data.wordBank.length) {
    return (
      <div className="card empty">
        <Daisy size={56} className="bob" />
        <p>No words yet. Add some while practising and they'll become flashcards here.</p>
      </div>
    );
  }

  // Deck picker
  if (!queue) {
    return (
      <div className="card blossom">
        <h3 style={{ marginTop: 0 }}>🃏 Flashcards</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Say the meaning out loud (or in your head), then flip. <b>Got it</b> sends the card further away
          ({BOX_DAYS.join(', ')} days); <b>Again</b> brings it back this round and tomorrow. After {BOX_DAYS.length} “Got it”s on
          different days it's marked learned 🌸.
        </p>
        <div className="row" style={{ marginBottom: 12 }}>
          {(Object.keys(DECK_LABEL) as Deck[]).map((d) => (
            <button key={d} className={`chip clickable ${deck === d ? 'selected' : ''}`} onClick={() => setDeck(d)}>
              {DECK_LABEL[d]} ({counts[d]})
            </button>
          ))}
        </div>
        <label className="row small" style={{ gap: 6, marginBottom: 14 }}>
          <input type="checkbox" checked={meaningFirst} onChange={(e) => setMeaningFirst(e.target.checked)} />
          Show the meaning first and guess the word (cards without a meaning still show the word)
        </label>
        <button className="btn primary" disabled={!counts[deck]} onClick={() => start(deckWords(data.wordBank, deck).map((w) => w.id))}>
          Start {counts[deck]} card{counts[deck] === 1 ? '' : 's'} →
        </button>
        {deck === 'due' && !counts.due && <span className="muted small" style={{ marginLeft: 10 }}>Nothing due today 🌼 Pick another deck to practise anyway.</span>}
      </div>
    );
  }

  // Finished
  if (!current) {
    return (
      <div className="card empty fade-up">
        {tally.again === 0 && tally.got > 0 && <FallingPetals />}
        <Daisy size={56} className="bob" />
        <h2>Round done 🌸</h2>
        <p>{tally.got} got it · {tally.again} again{tally.missed.length ? ` (${tally.missed.length} word${tally.missed.length === 1 ? '' : 's'})` : ''}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          {tally.missed.length > 0 && <button className="btn primary" onClick={() => start(tally.missed)}>Practise the {tally.missed.length} I missed</button>}
          <button className="btn ghost" onClick={() => setQueue(null)}>Back to decks</button>
        </div>
      </div>
    );
  }

  const showMeaningFront = meaningFirst && !!current.meaning.trim();
  const setMeaning = (meaning: string) => update((d) => ({ ...d, wordBank: d.wordBank.map((w) => (w.id === current.id ? { ...w, meaning } : w)) }));
  const total = tally.got + queue.length;

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="muted small">Card {tally.got + 1} of {total} · {tally.again} again so far</span>
        <span className="spacer" />
        <button className="btn small ghost" onClick={() => setQueue(null)}>End round</button>
      </div>
      <div className="fc-progress"><div style={{ width: `${(tally.got / total) * 100}%` }} /></div>

      <div className={`fc ${flipped ? 'flipped' : ''}`} role="button" tabIndex={0} aria-label={flipped ? 'Card back' : 'Card front, press space to flip'}
        onClick={(e) => !(e.target as HTMLElement).closest('a, textarea, button') && setFlipped(!flipped)}>
        <div className="fc-inner">
          <div className="fc-face fc-front">
            <SunflowerHead size={34} className="fc-sunflower" />
            {showMeaningFront ? <div className="fc-meaning">{current.meaning}</div> : <div className="fc-word">{current.text}</div>}
            <div className="muted small fc-hint">tap or press space to flip</div>
          </div>
          <div className="fc-face fc-back">
            <div className="fc-word small-word">{current.text}</div>
            {current.meaning.trim()
              ? <div className="fc-meaning">{current.meaning}</div>
              : <textarea key={current.id} rows={2} placeholder="No meaning yet. Write it in your own words…" style={{ minHeight: 50, width: '100%' }}
                  onBlur={(e) => e.target.value.trim() && setMeaning(e.target.value.trim())} aria-label={`Meaning of ${current.text}`} />}
            {current.context && <div className="ctx"><WordContext text={current.context} word={current.text} /></div>}
            <a className="btn small ghost" href={dictUrl(current.text)} target="_blank" rel="noreferrer noopener">Look up ↗</a>
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', marginTop: 14, visibility: flipped ? 'visible' : 'hidden' }}>
        <button className="btn pink" onClick={() => answer(false)}>🔁 Again <span className="muted small">(1)</span></button>
        <button className="btn primary" onClick={() => answer(true)}>🌸 Got it <span className="small" style={{ opacity: 0.7 }}>(2)</span></button>
      </div>
    </div>
  );
}
