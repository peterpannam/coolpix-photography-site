/** The detail panel: photographs and facts for one place, with previous/next along the whole journey. */
import type { Tone } from './constants';
import { fmtCoords, fmtKm, pad2, plural } from './format';
import { hash, paintPlaceholder } from './placeholder';
import type { PlacedPlace, RegionInfo } from './types';

export interface PanelContext {
  region: RegionInfo;
  index: number;
  total: number;
  prev?: PlacedPlace;
  next?: PlacedPlace;
  tone: Tone;
  startName: string;
}

export interface Panel {
  open(p: PlacedPlace, ctx: PanelContext, focus?: boolean): void;
  close(): boolean;
  isOpen(): boolean;
  el: HTMLElement;
}

export function createPanel(el: HTMLElement, onStep: (dir: -1 | 1) => void, onClose: () => void): Panel {
  const q = <T extends Element>(ref: string) => el.querySelector<T>(`[data-ref="${ref}"]`)!;
  const eyebrow = q<HTMLElement>('panel-eyebrow');
  const title = q<HTMLElement>('panel-title');
  const story = q<HTMLElement>('panel-story');
  const meta = q<HTMLElement>('panel-meta');
  const links = q<HTMLElement>('panel-links');
  const strip = q<HTMLElement>('panel-strip');
  const prevBtn = q<HTMLButtonElement>('panel-prev');
  const nextBtn = q<HTMLButtonElement>('panel-next');

  q<HTMLButtonElement>('panel-close').addEventListener('click', onClose);
  prevBtn.addEventListener('click', () => onStep(-1));
  nextBtn.addEventListener('click', () => onStep(1));

  function open(p: PlacedPlace, ctx: PanelContext, focus = false) {
    eyebrow.textContent = `${ctx.region.title} · ${ctx.region.state} · ${pad2(ctx.index + 1)} / ${pad2(ctx.total)}`;
    title.textContent = p.name;
    story.textContent = p.story ?? '';
    story.hidden = !p.story;

    meta.replaceChildren();
    const rows: [string, string][] = [
      ['Position', fmtCoords(p)],
      ['Distance', `${fmtKm(p.km)} km from ${ctx.startName}`],
      ['State', p.state],
      ['Frames', plural(p.photos, 'photograph')],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      meta.append(dt, dd);
    }

    links.replaceChildren();
    const link = (text: string, href: string) => {
      const a = document.createElement('a');
      a.className = 'tp-link';
      a.href = href;
      a.textContent = text;
      links.append(a);
    };
    if (p.storyHref) link('Full story →', p.storyHref);
    if (p.print && p.printHref) link('View prints →', p.printHref);
    links.hidden = !links.childElementCount;

    strip.replaceChildren();
    const count = p.images?.length || p.photos;
    strip.classList.toggle('is-multi', count > 1);
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < count; i++) {
      const fig = document.createElement('figure');
      fig.className = 'shot';
      const cap = document.createElement('figcaption');
      const image = p.images?.[i];
      if (image) {
        const img = document.createElement('img');
        img.src = image.src;
        img.alt = image.alt;
        img.loading = 'lazy';
        img.decoding = 'async';
        fig.append(img);
        cap.textContent = `${pad2(i + 1)} / ${pad2(count)}`;
      } else {
        const c = document.createElement('canvas');
        c.setAttribute('role', 'img');
        c.setAttribute('aria-label', `Placeholder for photograph ${i + 1} of ${count}`);
        canvases.push(c);
        fig.append(c);
        cap.textContent = `Placeholder · ${pad2(i + 1)} / ${pad2(count)}`;
      }
      fig.append(cap);
      strip.append(fig);
    }
    strip.scrollLeft = 0;

    prevBtn.disabled = !ctx.prev;
    nextBtn.disabled = !ctx.next;
    prevBtn.querySelector('.step-name')!.textContent = ctx.prev ? ctx.prev.name : '—';
    nextBtn.querySelector('.step-name')!.textContent = ctx.next ? ctx.next.name : '—';

    el.inert = false;
    el.classList.add('is-open');
    requestAnimationFrame(() => canvases.forEach((c, i) => paintPlaceholder(c, hash(p.id) + i * 977, ctx.tone)));
    if (focus) title.focus({ preventScroll: true });
  }

  /** Returns false if it was already closed */
  function close(): boolean {
    if (!el.classList.contains('is-open')) return false;
    el.classList.remove('is-open');
    el.inert = true;
    return true;
  }

  return { open, close, isOpen: () => el.classList.contains('is-open'), el };
}
