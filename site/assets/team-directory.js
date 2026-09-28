'use strict';

export const STAFF_GROUPS = Object.freeze([
  ['ownership', 'Owner'],
  ['management', 'Cosmic Management'],
  ['administrator', 'Administrator'],
  ['moderator', 'Moderator'],
  ['trial-staff', 'Trial Staff']
]);
const ENDPOINT = 'https://mygpttrerwwexljgdiyq.supabase.co/functions/v1/staff-directory';
const GUILD_ID = '1329107732003029093';
const WOLF_ID = '351884909519831041';
const FRESH_MS = 300000;
const MANUAL_COOLDOWN_MS = 30000;
const MAX_TIMER_MS = 2147483647;
const MAX_DATE_MS = 8640000000000000;
const ROLE_LABELS = new Map(STAFF_GROUPS);
const GROUP_ORDER = STAFF_GROUPS.map(([slug]) => slug);
const SNOWFLAKE = /^[0-9]{17,20}$/;
const PLAIN_NAME = /^[^\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]+$/u;
const AVATAR_HASH = '(?:a_)?[a-f0-9]{32}';
const IMAGE_EXT = '(?:png|webp|jpe?g|gif)';
const AVATAR_SIZES = new Set(['16', '32', '64', '128', '256', '512', '1024', '2048', '4096']);

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateStaffAvatar(value, memberId) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 2048 || !SNOWFLAKE.test(memberId)) {
    throw new Error('Invalid staff avatar.');
  }
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.discordapp.com' || url.port || url.username || url.password || url.hash) {
    throw new Error('Invalid staff avatar destination.');
  }
  const userAvatar = new RegExp(`^/avatars/${memberId}/${AVATAR_HASH}\\.${IMAGE_EXT}$`);
  const guildAvatar = new RegExp(`^/guilds/${GUILD_ID}/users/${memberId}/avatars/${AVATAR_HASH}\\.${IMAGE_EXT}$`);
  if (!userAvatar.test(url.pathname) && !guildAvatar.test(url.pathname) && !/^\/embed\/avatars\/[0-5]\.png$/.test(url.pathname)) {
    throw new Error('Invalid staff avatar path.');
  }
  const parameters = [...url.searchParams];
  if (parameters.length > 1 || parameters.some(([key, size]) => key !== 'size' || !AVATAR_SIZES.has(size))) {
    throw new Error('Invalid staff avatar parameters.');
  }
  return url.href;
}

export function validateStaffDirectory(value, now = Date.now()) {
  if (!record(value) || value.version !== 1 || value.refreshAfterSeconds !== 300 ||
      typeof value.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value.updatedAt) ||
      !Array.isArray(value.members) || value.members.length > 1000) {
    throw new Error('Invalid staff directory response.');
  }
  const updatedAt = Date.parse(value.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt > now + 60000 || updatedAt + FRESH_MS <= now) {
    throw new Error('Staff directory is not current.');
  }
  const seen = new Set();
  const members = value.members.map(member => {
    if (!record(member) || typeof member.id !== 'string' || !SNOWFLAKE.test(member.id) || seen.has(member.id) ||
        typeof member.name !== 'string' || !member.name.trim() || [...member.name].length > 100 || !PLAIN_NAME.test(member.name) ||
        !Array.isArray(member.roles) || !member.roles.length || member.roles.length > STAFF_GROUPS.length ||
        !Array.isArray(member.labels) || member.labels.length > 1) {
      throw new Error('Invalid staff member.');
    }
    seen.add(member.id);
    let previous = -1;
    for (const role of member.roles) {
      const index = GROUP_ORDER.indexOf(role);
      if (index < 0 || index <= previous) throw new Error('Invalid staff role order.');
      previous = index;
    }
    if (member.primaryGroup !== member.roles[0]) throw new Error('Invalid primary staff role.');
    if (member.labels.some(label => member.id !== WOLF_ID || label !== 'Lead Developer')) {
      throw new Error('Unapproved staff label.');
    }
    return {
      id: member.id,
      name: member.name.trim(),
      avatarUrl: validateStaffAvatar(member.avatarUrl, member.id),
      primaryGroup: member.primaryGroup,
      roles: [...member.roles],
      labels: [...member.labels]
    };
  });
  return {updatedAt: new Date(updatedAt).toISOString(), expiresAt: updatedAt + FRESH_MS, members};
}

// Respect longer server delays without overflowing a browser timer.
export function staffRetryAfterTime(value, now = Date.now()) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) return 0;
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    if (!Number.isFinite(seconds)) return MAX_DATE_MS;
    return Math.min(MAX_DATE_MS, now + Math.ceil(seconds * 1000));
  }
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(now, date) : 0;
}

export function mountStaffDirectory(root, options = {}) {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const clock = options.clock || (() => Date.now());
  const fetcher = options.fetcher || globalThis.fetch.bind(globalThis);
  const setTimer = options.setTimer || globalThis.setTimeout.bind(globalThis);
  const clearTimer = options.clearTimer || globalThis.clearTimeout.bind(globalThis);
  const template = root.querySelector('[data-team-member-template]');
  const status = root.querySelector('[data-team-directory-status]');
  const updated = root.querySelector('[data-team-directory-time]');
  const note = root.querySelector('[data-team-directory-note]');
  const refreshButton = root.querySelector('[data-team-directory-refresh]');
  const panels = new Map(GROUP_ORDER.map(slug => {
    const panel = root.querySelector(`[data-team-role="${slug}"]`);
    return [slug, {
      list: panel?.querySelector('[data-team-list]'),
      count: panel?.querySelector('[data-team-count]'),
      label: panel?.querySelector('[data-team-count-label]')
    }];
  }));
  if (!template || !status || !updated || !note || !refreshButton ||
      [...panels.values()].some(panel => !panel.list || !panel.count || !panel.label)) {
    throw new Error('Incomplete staff directory markup.');
  }
  let active = true;
  let busy = false;
  let failed = false;
  let wakeTimer = null;
  let controller = null;
  let expiresAt = 0;
  let nextFetchAt = 0;
  let blockedUntil = 0;
  let manualAllowedAt = 0;

  const timeLabel = value => new Date(value).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  const emptyMessage = message => {
    const paragraph = doc.createElement('p');
    paragraph.className = 'team-state';
    paragraph.textContent = message;
    return paragraph;
  };
  function clearMembers(message) {
    for (const panel of panels.values()) {
      panel.list.replaceChildren(emptyMessage(message));
      panel.count.textContent = '-';
      panel.count.setAttribute('aria-label', 'Member count unavailable');
      panel.label.textContent = 'members';
    }
    updated.hidden = true;
    updated.removeAttribute('datetime');
    updated.textContent = '';
  }
  function expireMembers() {
    if (expiresAt && clock() >= expiresAt) {
      expiresAt = 0;
      clearMembers('Checking current staff members...');
      status.textContent = 'Checking the current team...';
      root.dataset.directoryState = 'loading';
    }
  }
  function updateButton() {
    const now = clock();
    const allowedAt = Math.max(blockedUntil, manualAllowedAt);
    refreshButton.disabled = busy || now < allowedAt;
    refreshButton.textContent = busy ? 'Checking...' : failed ? 'Try again' : 'Refresh';
    note.hidden = busy || now >= allowedAt;
    if (!note.hidden) {
      note.textContent = blockedUntil > now && failed
        ? (blockedUntil - now > 86400000 ? 'Please try again later.' : `Try again after ${timeLabel(blockedUntil)}.`)
        : 'Please wait a moment before refreshing again.';
    }
  }
  function schedule() {
    clearTimer(wakeTimer);
    wakeTimer = null;
    if (!active || doc.hidden) return;
    const now = clock();
    const deadlines = [];
    if (expiresAt) deadlines.push(expiresAt);
    if (manualAllowedAt > now) deadlines.push(manualAllowedAt);
    if (!busy) deadlines.push(Math.max(nextFetchAt, blockedUntil));
    if (deadlines.length) wakeTimer = setTimer(tick, Math.max(1, Math.min(MAX_TIMER_MS, Math.min(...deadlines) - now)));
  }
  function tick() {
    if (!active) return;
    expireMembers();
    updateButton();
    if (!doc.hidden && !busy && clock() >= Math.max(nextFetchAt, blockedUntil)) {
      refresh(false);
    } else schedule();
  }
  function createMember(member) {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.teamMember = member.id;
    card.querySelector('[data-team-name]').textContent = member.name;
    const badges = card.querySelector('[data-team-badges]');
    for (const label of [...member.roles.map(role => ROLE_LABELS.get(role)), ...member.labels]) {
      const badge = doc.createElement('span');
      badge.className = 'team-role';
      badge.textContent = label;
      badges.append(badge);
    }
    const bio = card.querySelector('[data-team-bio]');
    if (member.id === WOLF_ID) {
      bio.textContent = 'Leading the community. Building the experience.';
      bio.hidden = false;
    }
    const frame = card.querySelector('[data-team-avatar-frame]');
    const image = card.querySelector('[data-team-avatar]');
    const fallback = card.querySelector('[data-team-avatar-fallback]');
    fallback.textContent = member.name.split(/\s+/u).slice(0, 2).map(part => [...part][0]).join('').toLocaleUpperCase();
    if (member.avatarUrl) {
      const show = loaded => {
        image.hidden = !loaded;
        fallback.hidden = loaded;
        frame.classList.toggle('is-loaded', loaded);
      };
      image.alt = `${member.name}’s Discord profile picture`;
      image.addEventListener('load', () => show(image.naturalWidth > 0));
      image.addEventListener('error', () => show(false));
      image.src = member.avatarUrl;
      if (image.complete) show(image.naturalWidth > 0);
    } else image.remove();
    return card;
  }
  function render(snapshot) {
    const grouped = new Map(GROUP_ORDER.map(slug => [slug, []]));
    snapshot.members.forEach(member => grouped.get(member.primaryGroup).push(member));
    for (const [slug, members] of grouped) {
      const fragment = doc.createDocumentFragment();
      if (!members.length) fragment.append(emptyMessage('No staff listed in this section.'));
      else members.forEach(member => fragment.append(createMember(member)));
      const panel = panels.get(slug);
      panel.list.replaceChildren(fragment);
      panel.count.textContent = String(members.length);
      panel.count.removeAttribute('aria-label');
      panel.label.textContent = members.length === 1 ? 'member' : 'members';
    }
    expiresAt = snapshot.expiresAt;
    nextFetchAt = snapshot.expiresAt;
    status.textContent = 'Synced with Discord';
    updated.dateTime = snapshot.updatedAt;
    updated.textContent = `Updated at ${timeLabel(Date.parse(snapshot.updatedAt))}`;
    updated.hidden = false;
    root.dataset.directoryState = 'ready';
  }
  async function refresh(manual) {
    if (!active || busy || doc.hidden) return;
    const now = clock();
    if (now < blockedUntil || (manual && now < manualAllowedAt) || (!manual && now < nextFetchAt)) {
      updateButton();
      schedule();
      return;
    }
    expireMembers();
    busy = true;
    failed = false;
    root.setAttribute('aria-busy', 'true');
    status.textContent = 'Checking the staff directory...';
    updateButton();
    schedule();
    controller = new AbortController();
    const timeout = setTimer(() => controller?.abort(), 30000);
    let retryAt = 0;
    try {
      const response = await fetcher(ENDPOINT, {method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal});
      retryAt = staffRetryAfterTime(response.headers.get('Retry-After'), clock());
      if (!response.ok || !response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
        throw new Error('Staff directory request failed.');
      }
      const text = await response.text();
      if (text.length > 1000000) throw new Error('Staff directory response too large.');
      const snapshot = validateStaffDirectory(JSON.parse(text), clock());
      if (!active) return;
      render(snapshot);
      blockedUntil = retryAt;
      manualAllowedAt = Math.max(clock() + MANUAL_COOLDOWN_MS, retryAt);
    } catch {
      if (!active) return;
      failed = true;
      expiresAt = 0;
      clearMembers('Staff members are temporarily unavailable.');
      status.textContent = 'The staff directory is unavailable. Please try again shortly.';
      root.dataset.directoryState = 'error';
      nextFetchAt = Math.max(clock() + FRESH_MS, retryAt);
      blockedUntil = nextFetchAt;
      manualAllowedAt = nextFetchAt;
    } finally {
      clearTimer(timeout);
      controller = null;
      busy = false;
      if (active) {
        root.setAttribute('aria-busy', 'false');
        updateButton();
        schedule();
      }
    }
  }
  const manualRefresh = () => refresh(true);
  refreshButton.addEventListener('click', manualRefresh);
  doc.addEventListener('visibilitychange', tick);
  view?.addEventListener('focus', tick);
  view?.addEventListener('pageshow', tick);
  tick();
  return {
    refresh: manualRefresh,
    destroy() {
      active = false;
      clearTimer(wakeTimer);
      controller?.abort();
      refreshButton.removeEventListener('click', manualRefresh);
      doc.removeEventListener('visibilitychange', tick);
      view?.removeEventListener('focus', tick);
      view?.removeEventListener('pageshow', tick);
    }
  };
}

if (typeof document !== 'undefined') {
  const directory = document.querySelector('[data-team-directory]');
  if (directory) mountStaffDirectory(directory);
}
