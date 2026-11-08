import { extractPages } from './pdfText';
import { parseCbPages, type CbItem, type FigureBox } from './cbParser';

export interface PdfProgress {
  stage: 'reading' | 'figures';
  done: number;
  total: number;
}

export interface PdfResult {
  items: CbItem[];
  pages: number;
  /** True when the file has (almost) no text layer, e.g. a scan. */
  looksScanned: boolean;
}

/**
 * Load pdf.js only when someone actually imports a PDF (it's big).
 * The "legacy" build is used because the default one needs brand-new browser features.
 */
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export async function importCbPdf(file: File, onProgress: (p: PdfProgress) => void): Promise<PdfResult> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    const pages = await extractPages(doc as never, {
      OPS: pdfjs.OPS,
      wantRules: (lines) => lines.some((l) => /underlin/i.test(l.text)),
      onProgress: (done, total) => onProgress({ stage: 'reading', done, total }),
    });
    const chars = pages.reduce((n, p) => n + p.lines.reduce((m, l) => m + l.text.trim().length, 0), 0);
    const looksScanned = chars < pages.length * 40;
    const items = looksScanned ? [] : parseCbPages(pages);

    // Render each chart/table region to an image.
    const withFigs = items.filter((i) => i.figures.length);
    let done = 0;
    for (const it of withFigs) {
      const imgs: string[] = [];
      for (const box of it.figures) {
        try {
          imgs.push(await renderRegion(doc, box));
        } catch (e) {
          imgs.push('');
          it.issues.push(`Couldn't draw figure: ${(e as Error).message}`);
        }
      }
      it.draft.figures = imgs;
      onProgress({ stage: 'figures', done: ++done, total: withFigs.length });
    }
    return { items, pages: doc.numPages, looksScanned };
  } finally {
    await task.destroy();
  }
}

type Doc = Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfjs>>['getDocument']>['promise']>;

async function renderRegion(doc: Doc, box: FigureBox): Promise<string> {
  const page = await doc.getPage(box.page);
  const scale = 2;
  const vp = page.getViewport({ scale });
  const [, , pw, ph] = page.view;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;

  const top = Math.max(0, (ph - box.top) * scale);
  const bottom = Math.min(canvas.height, (ph - box.bottom) * scale);
  const left = 12 * scale;
  const width = (pw - 24) * scale;
  const out = document.createElement('canvas');
  out.width = Math.round(width);
  out.height = Math.max(1, Math.round(bottom - top));
  out.getContext('2d')!.drawImage(canvas, left, top, width, out.height, 0, 0, out.width, out.height);
  page.cleanup();
  const final = trimWhite(out);
  const webp = final.toDataURL('image/webp', 0.9);
  return webp.startsWith('data:image/webp') ? webp : final.toDataURL('image/png');
}

/** Cut away empty white margins so small tables aren't shrunk to fit a full page width. */
function trimWhite(c: HTMLCanvasElement, pad = 16): HTMLCanvasElement {
  const { width: w, height: h } = c;
  const px = c.getContext('2d')!.getImageData(0, 0, w, h).data;
  const ink = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235;
  };
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (!ink(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return c;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0;
  out.height = y1 - y0;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
