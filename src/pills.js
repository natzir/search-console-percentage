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

export function annotateCards(cards, lang) {
  for (const card of cards) {
    if (!Number.isFinite(card.last) || !Number.isFinite(card.previous)) continue;
    const c = change(card.key, card.last, card.previous);
    const coloured = onColour(card.el);
    const target = card.el.querySelector('[title]')?.parentElement ?? card.el.querySelector('[role="button"]') ?? card.el;
    place(target, 'card-pill', `${card.last}|${card.previous}|${lang}|${coloured}`, () => {
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
