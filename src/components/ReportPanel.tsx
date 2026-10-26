import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { buildReport } from '../logic/report';

/** Progress report: a readable summary to copy into a chat (or save as a .md file) for analysis. */
export default function ReportPanel() {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => (open ? buildReport(data) : ''), [open, data]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.getElementById('report-text') as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wisteria-study-progress-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>📊 Progress report</h3>
        <span className="spacer" />
        <button className={`btn small ${open ? 'on' : ''}`} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Make report'}</button>
      </div>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        Accuracy, wrong vs skipped, time per skill, trends, repeat misses and your notes, as text you can paste into a chat
        and ask “where should I focus?”.
      </p>
      {open && (
        <div className="fade-up" style={{ marginTop: 10 }}>
          <textarea id="report-text" readOnly value={text} rows={14} className="report-text" aria-label="Progress report" />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy report'}</button>
            <button className="btn ghost" onClick={download}>Download .md</button>
            <span className="muted small">{text.length.toLocaleString()} characters · includes short question snippets</span>
          </div>
        </div>
      )}
    </div>
  );
}
