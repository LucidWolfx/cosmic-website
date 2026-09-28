'use strict';
(() => {
  document.querySelectorAll('[data-team-avatar]').forEach(image => {
    const frame = image.closest('[data-team-avatar-frame]');
    if (!frame) return;
    const fallback = frame.querySelector('[data-team-avatar-fallback]');
    const showImage = loaded => {
      image.hidden = !loaded;
      if (fallback) fallback.hidden = loaded;
      frame.classList.toggle('is-loaded', loaded);
    };
    image.addEventListener('load', () => showImage(image.naturalWidth > 0));
    image.addEventListener('error', () => showImage(false));
    // Deferred scripts may run after an image has already finished from cache.
    if (image.complete) showImage(image.naturalWidth > 0);
  });
})();
