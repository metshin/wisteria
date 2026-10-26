import { useState } from 'react';
import { useStore, uid } from '../store/store';
import { addWord, cleanWord } from '../logic/highlights';
import type { WordEntry } from '../types';
import { Daisy } from '../components/Decor';
import WordContext from '../components/WordContext';
import Flashcards from '../components/Flashcards';

type Filter = 'learning' | 'learned' | 'all';

export default function WordBank({ tab: initialTab = 'list' }: { tab?: 'list' | 'cards' }) {
  const { data, update } = useStore();
  const [tab, setTab] = useState(initialTab);
  const [filter, setFilter] = useState<Filter>('learning');
  const [search, setSearch] = useState('');
  const [newWord, setNewWord] = useState('');
  const [copied, setCopied] = useState(false);

  const words = data.wordBank;
  const shown = words
    .filter((w) => filter === 'all' || (filter === 'learned' ? w.learned : !w.learned))
    .filter((w) => !search || `${w.text} ${w.meaning}`.toLowerCase().includes(search.toLowerCase()));
  const patch = (id: string, p: Partial<WordEntry>) => update((d) => ({ ...d, wordBank: d.wordBank.map((w) => (w.id === id ? { ...w, ...p } : w)) }));
  const remove = (id: string) => update((d) => ({ ...d, wordBank: d.wordBank.filter((w) => w.id !== id) }));

  const addManual = () => {
    const text = cleanWord(newWord);
    if (!text) return;
    update((d) => ({ ...d, wordBank: addWord(d.wordBank, { id: uid('w_'), text, context: '', meaning: '', learned: false, addedAt: Date.now() }).bank }));
    setNewWord('');
  };

  const asLines = () => shown.map((w) => (w.meaning ? `${w.text} — ${w.meaning}` : w.text)).join('\n');
  const copyAll = async () => {
    await navigator.clipboard.writeText(asLines()).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const downloadCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = ['word,meaning,sentence,learned', ...shown.map((w) => [w.text, w.meaning, w.context, w.learned ? 'yes' : 'no'].map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `word-bank-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <h1>Word bank 🌱</h1>
        <span className="spacer" />
        <button className={`chip clickable ${tab === 'list' ? 'selected' : ''}`} onClick={() => setTab('list')}>📒 List</button>
        <button className={`chip clickable ${tab === 'cards' ? 'selected' : ''}`} onClick={() => setTab('cards')}>🃏 Flashcards</button>
      </div>
      {tab === 'cards' ? <Flashcards /> : (<>
      <div className="card blossom">
        <p className="muted" style={{ marginTop: 0 }}>
          While practising, <b>double-click a word</b> (or drag over a phrase) and press <b>🌱 Add to word bank</b>.
          The sentence it came from is saved too. Write the meaning in your own words below; that's what makes it stick.
        </p>
        <div className="row">
          <input type="text" placeholder="Add a word by hand…" value={newWord} style={{ flex: 1, minWidth: 180 }}
            onChange={(e) => setNewWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addManual()} />
          <button className="btn primary" onClick={addManual} disabled={!newWord.trim()}>Add</button>
        </div>
      </div>

      {words.length === 0 ? (
        <div className="card empty">
          <Daisy size={56} className="bob" />
          <p>No words yet. They'll bloom here as you collect them.</p>
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            {(['learning', 'learned', 'all'] as Filter[]).map((f) => (
              <button key={f} className={`chip clickable ${filter === f ? 'selected' : ''}`} onClick={() => setFilter(f)}>
                {f === 'learning' ? 'Still learning' : f === 'learned' ? 'Learned 🌸' : 'All'} (
                {f === 'all' ? words.length : words.filter((w) => (f === 'learned' ? w.learned : !w.learned)).length})
              </button>
            ))}
            <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
            <button className="btn small ghost" onClick={copyAll} disabled={!shown.length}>{copied ? 'Copied ✓' : 'Copy list'}</button>
            <button className="btn small ghost" onClick={downloadCsv} disabled={!shown.length} title="Opens in Excel/Sheets; can be imported into Anki or Quizlet">Download CSV</button>
          </div>
          {shown.length === 0 && <div className="empty">Nothing here 🌼</div>}
          <div className="grid two">
            {shown.map((w) => (
              <div key={w.id} className={`word-card pop-in ${w.learned ? 'learned' : ''}`}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <span className="word">{w.text}</span>
                  <span className="spacer" />
                  <a className="btn small ghost" href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(w.text)}`}
                    target="_blank" rel="noreferrer noopener" title="Opens merriam-webster.com in a new tab">Look up ↗</a>
                </div>
                {w.context && <div className="ctx"><WordContext text={w.context} word={w.text} /></div>}
                <textarea rows={2} placeholder="Meaning, in your own words…" value={w.meaning} style={{ minHeight: 54 }}
                  onChange={(e) => patch(w.id, { meaning: e.target.value })} />
                <div className="row" style={{ marginTop: 6 }}>
                  <button className={`btn small ${w.learned ? 'on' : 'ghost'}`} onClick={() => patch(w.id, { learned: !w.learned })}>
                    {w.learned ? '🌸 Learned' : 'Mark learned'}
                  </button>
                  <span className="spacer" />
                  <span className="muted small">{new Date(w.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <button className="btn small ghost" aria-label={`Delete ${w.text}`} onClick={() => confirm(`Delete “${w.text}”?`) && remove(w.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}
    </>
  );
}
