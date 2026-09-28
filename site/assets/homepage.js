'use strict';
(() => {
  const stage = document.querySelector('[data-home-scene]');
  if (!stage) return;
  const artwork = document.querySelector('#home-art');
  const cityArt = CosmicUI.safeUrl(window.COSMIC?.heroImage) || 'assets/cosmic-after-dark.jpg';
  const scenes = {
    city: {kicker:'Welcome to your other life', lines:['Make your','own story.'], copy:'Good friends. Bad decisions. A whole city of possibilities. Who will you become?', action:'Enter Cosmic', href:'portal.html#apply', foot:'Character first. Story always.', image:cityArt, alt:'Promotional artwork of fictional Los Santos residents, a sports car, and the city at night.'},
    calling: {kicker:'Los Santos Police Department', lines:['The city','is calling.'], copy:'A partner. A patrol. A purpose. Find your place in the Los Santos Police Department.', action:'Explore LSPD', href:'department-lspd.html', foot:'Your character. Your calling.', image:'assets/lspd-city-patrol.webp', alt:'Promotional artwork of a Los Santos patrol car above the city at sunset.'},
    start: {kicker:'Your introduction to Cosmic', lines:['It starts','with you.'], copy:'Bring a character with a past and a reason to stay. Read the rules, connect Discord, and send your application.', action:'Start your application', href:'portal.html#apply', foot:'18+ / Story-focused serious roleplay', image:cityArt, alt:'Promotional artwork of fictional Los Santos residents, a sports car, and the city at night.'}
  };
  document.querySelectorAll('[data-home-choice]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.homeChoice, scene = scenes[key];
    if (!scene) return;
    stage.dataset.homeScene = key;
    document.querySelector('#home-kicker').textContent = scene.kicker;
    document.querySelector('#home-heading').replaceChildren(...scene.lines.map(line => {const span=document.createElement('span');span.textContent=line;return span;}));
    document.querySelector('#home-description').textContent = scene.copy;
    const action = document.querySelector('#home-action');
    action.textContent = scene.action + ' ↗'; action.href = scene.href;
    document.querySelector('#home-scene-label').textContent = scene.foot;
    artwork.src = scene.image; artwork.alt = scene.alt;
    document.querySelectorAll('[data-home-choice]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
})();
