'use strict';
(() => {
  const ticker = document.querySelector('[data-home-ticker]');
  if (!ticker) return;
  const toggle = ticker.querySelector('[data-ticker-toggle]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  for (const track of ticker.querySelectorAll('.ad-ticker-track')) {
    const copy = track.firstElementChild.cloneNode(true);
    copy.classList.add('ad-ticker-copy');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    track.append(copy);
  }
  let paused = false;
  function updateMotion() {
    ticker.dataset.motionReady = String(!reducedMotion.matches);
    ticker.dataset.paused = String(paused);
    toggle.hidden = reducedMotion.matches;
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.setAttribute('aria-pressed', String(paused));
  }
  toggle.addEventListener('click', () => { paused = !paused; updateMotion(); });
  reducedMotion.addEventListener('change', updateMotion);
  updateMotion();
})();
