import { useEffect, useRef, useState } from 'react';
import { useStore, uid } from '../store/store';
import { NOTE_COLORS, type NoteColor, type StickyNote } from '../types';

interface Template { label: string; title: string; kind: StickyNote['kind']; color: NoteColor; body?: string; showOnBuild?: boolean; placeholder: string }

const TEMPLATES: Template[] = [
  { label: '🎯 Today’s goal', title: '🎯 Today’s goal', kind: 'text', color: 'yellow', placeholder: 'e.g. 1 timed hard module + retry my skipped ones' },
  { label: '✅ To-do', title: '✅ To-do', kind: 'todo', color: 'green', placeholder: '' },
  { label: '📚 Topics', title: '📚 Topics to review', kind: 'text', color: 'blue', placeholder: 'e.g. semicolons vs colons, Text 1/Text 2 questions…' },
  { label: '📈 Progress', title: '📈 Progress', kind: 'text', color: 'peach', placeholder: 'e.g. Oct 30: 21/27 on hard module, timing better' },
  { label: '🧮 Formulas & rules', title: '🧮 Formulas & rules', kind: 'text', color: 'pink',
    placeholder: 'e.g. independent clause ; independent clause\nFANBOYS needs a comma before it' },
  { label: '🧠 Keep in mind', title: '🧠 Keep in mind', kind: 'text', color: 'yellow', showOnBuild: true,
    placeholder: 'e.g. Read the question first. Predict the answer before looking at choices. ~70 s per question, then flag and move on.' },
];

/** What a note says, as plain text (for empty checks). */
const hasContent = (n: StickyNote) => !!(n.body.trim() || n.items.length);

export default function StickyNotes() {
  const { data, update } = useStore();
  const notes = data.notes;
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Close the "+ Add note" menu when clicking anywhere else.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.open && !menuRef.current.contains(e.target as Node)) menuRef.current.open = false;
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const add = (t: Template | null) => {
    const now = Date.now();
    const note: StickyNote = {
      id: uid('n_'), title: t?.title ?? '', kind: t?.kind ?? 'text', body: t?.body ?? '', items: [],
      color: t?.color ?? NOTE_COLORS[notes.length % NOTE_COLORS.length], showOnBuild: !!t?.showOnBuild, createdAt: now, updatedAt: now,
    };
    update((d) => ({ ...d, notes: [note, ...d.notes] }));
    if (menuRef.current) menuRef.current.open = false;
  };

  return (
    <div className="card notes-card">
      <div className="row" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>📝 Notes board</h3>
        <span className="spacer" />
        <details className="add-note" ref={menuRef}>
          <summary className="btn small primary">+ Add note</summary>
          <div className="add-note-menu">
            {TEMPLATES.map((t) => <button key={t.label} onClick={() => add(t)}>{t.label}</button>)}
            <button onClick={() => add(null)}>📄 Blank note</button>
          </div>
        </details>
      </div>
      {notes.length === 0 ? (
        <div className="muted small center" style={{ padding: '10px 0 4px' }}>
          No notes yet. Press <b>+ Add note</b>. Tip: a 🧠 <b>Keep in mind</b> note is 📌 pinned, so it also shows on the Build module screen right before you start. Pin any note the same way.
        </div>
      ) : (
        <div className="notes-board">
          {notes.map((n, i) => <Note key={n.id} note={n} tilt={i % 3 === 0 ? -1 : i % 3 === 1 ? 0.8 : -0.4} />)}
        </div>
      )}
    </div>
  );
}

function Note({ note, tilt }: { note: StickyNote; tilt: number }) {
  const { update } = useStore();
  const [newItem, setNewItem] = useState('');
  const placeholder = TEMPLATES.find((t) => t.title === note.title)?.placeholder || 'Write anything…';

  const patch = (p: Partial<StickyNote>) =>
    update((d) => ({ ...d, notes: d.notes.map((x) => (x.id === note.id ? { ...x, ...p, updatedAt: Date.now() } : x)) }));
  const remove = () => {
    if (hasContent(note) && !confirm(`Delete “${note.title || 'this note'}”?`)) return;
    update((d) => ({ ...d, notes: d.notes.filter((x) => x.id !== note.id) }));
  };
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    patch({ items: [...note.items, { id: uid('i_'), text, done: false }] });
    setNewItem('');
  };
  const done = note.items.filter((x) => x.done).length;

  return (
    <div className={`sticky sticky-${note.color} pop-in`} style={{ ['--tilt' as string]: `${tilt}deg` }}>
      <input className="sticky-title" value={note.title} placeholder="Title" aria-label="Note title"
        onChange={(e) => patch({ title: e.target.value })} />
      {note.kind === 'text' ? (
        <textarea className="sticky-body" value={note.body} placeholder={placeholder} aria-label={`${note.title || 'Note'} text`}
          rows={Math.min(12, Math.max(3, note.body.split('\n').length + 1))}
          onChange={(e) => patch({ body: e.target.value })} />
      ) : (
        <div className="sticky-todo">
          {note.items.map((it) => (
            <div key={it.id} className={`todo-item ${it.done ? 'done' : ''}`}>
              <input type="checkbox" checked={it.done} aria-label={it.text}
                onChange={() => patch({ items: note.items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)) })} />
              <input className="todo-text" value={it.text} aria-label="To-do text"
                onChange={(e) => patch({ items: note.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })} />
              <button className="todo-x" aria-label={`Remove ${it.text}`} onClick={() => patch({ items: note.items.filter((x) => x.id !== it.id) })}>✕</button>
            </div>
          ))}
          <input className="todo-new" value={newItem} placeholder="+ Add a task, press Enter" aria-label="New task"
            onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} onBlur={addItem} />
          {note.items.length > 0 && (
            <div className="row small" style={{ marginTop: 4 }}>
              <span className="muted">{done}/{note.items.length} done{done === note.items.length ? ' 🌸' : ''}</span>
              <span className="spacer" />
              {done > 0 && <button className="sticky-link" onClick={() => patch({ items: note.items.filter((x) => !x.done) })}>Clear done</button>}
            </div>
          )}
        </div>
      )}
      <div className="sticky-foot">
        {NOTE_COLORS.map((c) => (
          <button key={c} className={`note-dot sticky-${c} ${note.color === c ? 'on' : ''}`} aria-label={`${c} note`} onClick={() => patch({ color: c })} />
        ))}
        <span className="spacer" />
        <button className={`sticky-link ${note.showOnBuild ? 'on' : ''}`} onClick={() => patch({ showOnBuild: !note.showOnBuild })}
          title={note.showOnBuild ? 'Shown on the Build module screen before you start. Click to unpin.' : 'Pin: also show this note on the Build module screen, right before you start a test'} aria-pressed={note.showOnBuild}>
          📌 {note.showOnBuild ? 'Pinned' : 'Pin'}
        </button>
        <button className="sticky-link" aria-label="Delete note" onClick={remove}>🗑</button>
      </div>
    </div>
  );
}

/** Notes marked "Show before tests", read-only, above the Start button on the Build screen. */
export function BuildReminders() {
  const { data } = useStore();
  const notes = data.notes.filter((n) => n.showOnBuild && hasContent(n));
  if (!notes.length) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>📌 Before you start</h3>
      <div className="notes-board">
        {notes.map((n) => (
          <div key={n.id} className={`sticky sticky-${n.color} readonly`}>
            {n.title && <div className="sticky-title">{n.title}</div>}
            {n.kind === 'text' ? <div className="sticky-body" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div> : (
              <ul className="sticky-list">
                {n.items.map((it) => <li key={it.id} className={it.done ? 'done' : ''}>{it.text}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
