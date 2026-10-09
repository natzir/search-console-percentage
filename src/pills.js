// The pills: the % next to each Difference in the table, and the difference and % in each card.
import { cardLabel, change, tableLabel } from './change.js';
import { readRows } from './detect.js';

export function pillElement(doc, text, tone, kind = 'pill') {
  const pill = doc.createElement('span');
  pill.setAttribute('data-scpc', kind);
  pill.className = `scpc-pill scpc-${tone}`;
  pill.textContent = text;
  return pill;
}

// Redraws a pill only when what it says changed; Google re-rendering a cell takes the old one away.
function place(container, kind, stamp, make) {
  const old = container.querySelector(`[data-scpc="${kind}"]`);
  if (old?.dataset.stamp === stamp) return;
  old?.remove();
  const pill = make();
  pill.dataset.stamp = stamp;
  container.append(pill);
}

export function annotateTable(model, lang) {
  for (const { values, diffCells } of readRows(model)) {
    for (const [key, [last, previous]] of Object.entries(values)) {
      const cell = diffCells[key];
      if (!cell || Number.isNaN(last) || Number.isNaN(previous)) continue;
      const c = change(key, last, previous);
      const target = cell.querySelector('span span') ?? cell;
      place(target, 'pill', `${last}|${previous}|${lang}`, () => pillElement(cell.ownerDocument, tableLabel(c, lang), c.tone));
    }
  }
}

// A selected card is filled with its metric's colour: there the pill is white so it still reads.
const onColour = el => {
  const bg = el.ownerDocument.defaultView.getComputedStyle(el).backgroundColor;
  return Boolean(bg) && !/^(rgba?\(255, 255, 255(, 1)?\)|rgba\(0, 0, 0, 0\)|transparent)$/.test(bg);
};

// The CTR card's title is rounded to one decimal ("0.7%"); each period's CTR is exactly its clicks over
// its impressions. Null when either card is missing or a period has no impressions.
function exactCtr(cards) {
  const clicks = cards.find(card => card.key === 'CLICKS');
  const impressions = cards.find(card => card.key === 'IMPRESSIONS');
  if (!clicks || !impressions) return null;
  const ctr = (c, i) => (i > 0 ? (c / i) * 100 : NaN);
  const last = ctr(clicks.last, impressions.last);
  const previous = ctr(clicks.previous, impressions.previous);
  return Number.isFinite(last) && Number.isFinite(previous) ? { last, previous } : null;
}

export function annotateCards(cards, lang) {
  const ctr = exactCtr(cards);
  for (const card of cards) {
    const { last, previous } = card.key === 'CTR' && ctr ? ctr : card;
    if (!Number.isFinite(last) || !Number.isFinite(previous)) continue;
    const c = change(card.key, last, previous);
    const coloured = onColour(card.el);
    const target = card.el.querySelector('[title]')?.parentElement ?? card.el.querySelector('[role="button"]') ?? card.el;
    place(target, 'card-pill', `${last}|${previous}|${lang}|${coloured}`, () => {
      const pill = pillElement(card.el.ownerDocument, cardLabel(card.key, c, lang), c.tone, 'card-pill');
      pill.classList.add('scpc-card-pill');
      if (coloured) pill.classList.add('scpc-on-colour');
      return pill;
    });
  }
}

export function removeAll(doc) {
  doc.querySelectorAll('[data-scpc]').forEach(el => el.remove());
}
