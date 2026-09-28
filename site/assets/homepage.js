'use strict';
(() => {
  const ticker = document.querySelector('[data-home-ticker]');
  if (!ticker) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rows = [...ticker.querySelectorAll('.ad-ticker-track')].map(track => ({
    track, group: track.firstElementChild, items: [...track.firstElementChild.children]
  }));
  let previousWidth = -1;
  function duplicate(element, className) {
    const copy = element.cloneNode(true);
    copy.classList.add(className);
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    return copy;
  }
  function fitRows(force = false) {
    const width = ticker.clientWidth;
    if (!force && width === previousWidth) return;
    previousWidth = width;
    ticker.dataset.motionReady = String(!reducedMotion.matches);
    for (const {track, group, items} of rows) {
      track.querySelector('.ad-ticker-copy')?.remove();
      group.querySelectorAll('.ad-ticker-fill').forEach(item => item.remove());
      if (reducedMotion.matches) continue;
      // Fill wide screens with repeated phrases rather than stretching the gaps.
      const groupWidth = group.getBoundingClientRect().width;
      if (!groupWidth) continue;
      const repeats = Math.max(1, Math.ceil(width / groupWidth));
      for (let repeat = 1; repeat < repeats; repeat++) {
        items.forEach(item => group.append(duplicate(item, 'ad-ticker-fill')));
      }
      track.append(duplicate(group, 'ad-ticker-copy'));
    }
  }
  reducedMotion.addEventListener('change', () => fitRows(true));
  new ResizeObserver(() => fitRows()).observe(ticker);
  fitRows(true);
})();
