import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStaffAvatar, validateStaffDirectory, staffRetryAfterTime, mountStaffDirectory} from '../site/assets/team-directory.js';

const NOW = Date.parse('2026-09-28T12:00:00.000Z');
const WOLF = '351884909519831041';
const OTHER = '123456789012345678';
const GUILD = '1329107732003029093';
const GROUPS = ['ownership', 'management', 'administrator', 'moderator', 'trial-staff'];
const avatar = id => `https://cdn.discordapp.com/avatars/${id}/${'a'.repeat(32)}.png?size=256`;
const employee = (extra = {}) => ({id: WOLF, name: 'Wolf', avatarUrl: avatar(WOLF), primaryGroup: 'ownership', roles: ['ownership', 'management'], labels: ['Lead Developer'], ...extra});
const directory = (members = [employee()], at = NOW) => ({version: 1, updatedAt: new Date(at).toISOString(), refreshAfterSeconds: 300, members});
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', ...headers}});

test('directory validation returns only public fields and never trusts extra identity/profile properties', () => {
  const input = directory([employee({email: 'private@example.test', token: 'never-render', profile: {secret: 'private'}})]);
  input.serviceKey = 'never-render';
  const result = validateStaffDirectory(input, NOW);
  assert.deepEqual(Object.keys(result).sort(), ['expiresAt', 'members', 'updatedAt']);
  assert.deepEqual(Object.keys(result.members[0]).sort(), ['avatarUrl', 'id', 'labels', 'name', 'primaryGroup', 'roles']);
  assert.equal(result.expiresAt, NOW + 300000);
  assert.ok(!JSON.stringify(result).includes('never-render'));
  assert.ok(!JSON.stringify(result).includes('private@example.test'));
});

test('malformed, duplicated, nonstaff or incorrectly ordered members invalidate the entire response', () => {
  const invalidMembers = [
    [employee(), employee()],
    [employee({roles: [], primaryGroup: 'ownership'})],
    [employee({roles: ['management', 'ownership'], primaryGroup: 'management'})],
    [employee({roles: ['ownership', 'ownership']})],
    [employee({roles: ['owner'], primaryGroup: 'owner'})],
    [employee({primaryGroup: 'moderator'})],
    [employee({id: OTHER, labels: ['Lead Developer'], avatarUrl: avatar(OTHER)})],
    [employee({labels: ['Owner override']})],
    [employee({name: 'Spoof\u202eowner'})],
    [employee({name: 'Hidden\u0000name'})],
    [employee({id: '../other-account'})]
  ];
  for (const members of invalidMembers) assert.throws(() => validateStaffDirectory(directory(members), NOW));
  assert.throws(() => validateStaffDirectory({...directory(), members: null}, NOW));
  assert.throws(() => validateStaffDirectory({...directory(), refreshAfterSeconds: 3600}, NOW));
});

test('avatar URLs cannot escape Discord CDN, bind another account, or carry arbitrary parameters', () => {
  const valid = [avatar(WOLF), `https://cdn.discordapp.com/guilds/${GUILD}/users/${WOLF}/avatars/a_${'b'.repeat(32)}.png?size=256`, 'https://cdn.discordapp.com/embed/avatars/5.png'];
  for (const url of valid) assert.equal(validateStaffAvatar(url, WOLF), url);
  assert.equal(validateStaffAvatar(null, WOLF), null);
  const invalid = [
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    avatar(WOLF).replace('cdn.discordapp.com', 'evil.example'),
    avatar(WOLF).replace('cdn.discordapp.com', 'cdn.discordapp.com.evil.example'),
    avatar(WOLF).replace('https:', 'http:'),
    avatar(WOLF).replace('cdn.discordapp.com', 'secret@cdn.discordapp.com'),
    avatar(WOLF).replace('cdn.discordapp.com', 'cdn.discordapp.com:8443'),
    avatar(OTHER),
    valid[1].replace(GUILD, OTHER),
    avatar(WOLF) + '&token=private',
    avatar(WOLF) + '&size=128',
    avatar(WOLF) + '#x',
    avatar(WOLF).replace('?size=256', '?size=0'),
    'https://cdn.discordapp.com/embed/avatars/6.png'
  ];
  for (const url of invalid) assert.throws(() => validateStaffAvatar(url, WOLF), url);
});

test('absolute snapshot expiry is not extended by a cached response or excessive future timestamp', () => {
  assert.equal(validateStaffDirectory(directory(), NOW + 299999).expiresAt, NOW + 300000);
  assert.throws(() => validateStaffDirectory(directory(), NOW + 300000));
  assert.throws(() => validateStaffDirectory(directory([], NOW + 60001), NOW));
  for (const updatedAt of ['invalid', '2026-09-28', '2026-09-28T12:00:00+00:00']) {
    assert.throws(() => validateStaffDirectory({...directory(), updatedAt}, NOW));
  }
});

test('Retry-After supports seconds and HTTP dates without converting long delays into rapid retries', () => {
  assert.equal(staffRetryAfterTime('120', NOW), NOW + 120000);
  assert.equal(staffRetryAfterTime('0.25', NOW), NOW + 250);
  assert.equal(staffRetryAfterTime(new Date(NOW + 600000).toUTCString(), NOW), NOW + 600000);
  assert.equal(staffRetryAfterTime('999999999999999999999999999999999999999999', NOW), 8640000000000000);
  for (const value of [null, '', 'nonsense']) assert.equal(staffRetryAfterTime(value, NOW), 0);
});

// A minimal DOM double rejects HTML insertion. It exercises mount/fetch/timers,
// so safe validation alone cannot hide unsafe rendering or stale-profile bugs.
class Node extends EventTarget {
  constructor(doc, fragment = false) {
    super(); this.ownerDocument = doc; this.fragment = fragment; this.children = [];
    this.selectors = new Map(); this.dataset = {}; this.attributes = new Map(); this.hidden = false;
    this.classList = {toggle() {}}; this.complete = false; this.naturalWidth = 0;
  }
  set innerHTML(value) {throw new Error('HTML insertion is forbidden in the staff directory test DOM.');}
  set textContent(value) {this.text = String(value); this.children = [];}
  get textContent() {return this.text || this.children.map(child => child.textContent).join('');}
  querySelector(selector) {return this.selectors.get(selector) || null;}
  setAttribute(key, value) {this.attributes.set(key, String(value));}
  removeAttribute(key) {this.attributes.delete(key);}
  append(...nodes) {for (const node of nodes) this.children.push(...(node.fragment ? node.children : [node]));}
  replaceChildren(...nodes) {this.children = []; this.text = ''; this.append(...nodes);}
  remove() {this.removed = true;}
}

function dom() {
  const doc = new EventTarget(); doc.hidden = false; doc.defaultView = new EventTarget();
  doc.createElement = () => new Node(doc);
  doc.createDocumentFragment = () => new Node(doc, true);
  const root = new Node(doc), panels = new Map();
  for (const selector of ['[data-team-directory-status]', '[data-team-directory-time]', '[data-team-directory-note]', '[data-team-directory-refresh]']) root.selectors.set(selector, new Node(doc));
  for (const group of GROUPS) {
    const panel = new Node(doc);
    for (const selector of ['[data-team-list]', '[data-team-count]', '[data-team-count-label]']) panel.selectors.set(selector, new Node(doc));
    root.selectors.set(`[data-team-role="${group}"]`, panel); panels.set(group, panel);
  }
  const card = {cloneNode() {
    const result = new Node(doc);
    for (const selector of ['[data-team-name]', '[data-team-badges]', '[data-team-bio]', '[data-team-avatar-frame]', '[data-team-avatar]', '[data-team-avatar-fallback]']) result.selectors.set(selector, new Node(doc));
    return result;
  }};
  root.selectors.set('[data-team-member-template]', {content: {firstElementChild: card}});
  return {doc, root, panels};
}

async function settle() {for (let i = 0; i < 5; i++) await new Promise(setImmediate);}

async function fixture(first = directory()) {
  const nodes = dom(); let now = NOW, counter = 0;
  const timers = new Map(), calls = [];
  let respond = () => response(first);
  const mounted = mountStaffDirectory(nodes.root, {
    clock: () => now,
    setTimer(fn, delay) {const id = ++counter; timers.set(id, {at: now + delay, fn}); return id;},
    clearTimer(id) {timers.delete(id);},
    fetcher: async (url, options) => {calls.push({url, options}); return respond();}
  });
  await settle();
  return {...nodes, mounted, calls, timers,
    time: () => now,
    respond(fn) {respond = fn;},
    count(group) {return nodes.panels.get(group).querySelector('[data-team-count]').textContent;},
    cards(group) {return nodes.panels.get(group).querySelector('[data-team-list]').children.filter(node => node.dataset.teamMember);},
    async advance(ms) {
      now += ms;
      for (let runs = 0;; runs++) {
        assert.ok(runs < 100, 'Timer must not spin');
        const due = [...timers.entries()].filter(([, task]) => task.at <= now).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); due[1].fn(); await settle();
      }
    }
  };
}

test('mount renders hostile names as text, additional role badges in the highest group, and omits credentials', async () => {
  const name = '<img src=x onerror=alert(1)> & "Owner"';
  const f = await fixture(directory([employee(), employee({id: OTHER, name, avatarUrl: avatar(OTHER), primaryGroup: 'moderator', roles: ['moderator', 'trial-staff'], labels: []})]));
  assert.equal(f.root.dataset.directoryState, 'ready');
  assert.equal(f.count('ownership'), '1'); assert.equal(f.count('management'), '0');
  assert.equal(f.count('moderator'), '1'); assert.equal(f.count('trial-staff'), '0');
  const wolf = f.cards('ownership')[0], other = f.cards('moderator')[0];
  assert.deepEqual(wolf.querySelector('[data-team-badges]').children.map(node => node.textContent), ['Cosmic Management', 'Lead Developer']);
  assert.equal(other.querySelector('[data-team-name]').textContent, name);
  assert.equal(other.querySelector('[data-team-name]').children.length, 0);
  assert.equal(other.querySelector('[data-team-avatar]').src, avatar(OTHER));
  assert.equal(f.calls[0].options.credentials, 'omit');
  assert.equal(f.calls[0].options.cache, 'no-store');
  assert.equal(f.calls[0].options.redirect, 'error');
  assert.equal(f.calls[0].options.headers, undefined);
  f.mounted.destroy();
});

test('refreshing a cached snapshot does not extend its lifetime; role changes and departures replace old cards', async () => {
  const f = await fixture(); await f.advance(30000);
  await f.mounted.refresh(); assert.equal(f.calls.length, 2);
  f.respond(() => response(directory([employee({primaryGroup: 'moderator', roles: ['moderator']})], f.time())));
  await f.advance(270000);
  assert.equal(f.calls.length, 3); assert.equal(f.count('ownership'), '0'); assert.equal(f.count('moderator'), '1');
  assert.equal(f.cards('ownership').length, 0);
  f.respond(() => response(directory([], f.time()))); await f.advance(300000);
  for (const group of GROUPS) assert.equal(f.count(group), '0');
  assert.equal(f.root.dataset.directoryState, 'ready');
  f.mounted.destroy();
});

test('expiry and an outage remove stale profiles and report unavailable counts rather than zero staff', async () => {
  const f = await fixture(); let release;
  f.respond(() => new Promise(resolve => {release = resolve;}));
  await f.advance(300000);
  assert.equal(f.cards('ownership').length, 0); assert.equal(f.count('ownership'), '-');
  release(response({error: 'Unavailable'}, 503)); await settle();
  assert.equal(f.root.dataset.directoryState, 'error');
  for (const group of GROUPS) assert.equal(f.count(group), '-');
  assert.equal(f.root.querySelector('[data-team-directory-time]').hidden, true);
  f.mounted.destroy();
});

test('a malformed member rejects the whole successful response, leaving no partial directory', async () => {
  const f = await fixture(directory([employee(), employee({id: OTHER, avatarUrl: 'https://evil.example/avatar.png', labels: []})]));
  assert.equal(f.root.dataset.directoryState, 'error');
  for (const group of GROUPS) {assert.equal(f.count(group), '-'); assert.equal(f.cards(group).length, 0);}
  f.mounted.destroy();
});

test('rate-limit delays block manual and automatic retries until the server deadline', async () => {
  const f = await fixture(); f.respond(() => response({error: 'Unavailable'}, 503, {'Retry-After': '900'}));
  await f.advance(300000); const count = f.calls.length;
  await f.advance(600000); await f.mounted.refresh();
  assert.equal(f.calls.length, count);
  f.respond(() => response(directory([], f.time()))); await f.advance(300000);
  assert.equal(f.calls.length, count + 1); assert.equal(f.root.dataset.directoryState, 'ready');
  f.mounted.destroy();
});

test('returning to a hidden tab expires old data immediately, and destruction ignores late responses', async () => {
  const f = await fixture(); f.doc.hidden = true;
  f.doc.dispatchEvent(new Event('visibilitychange'));
  await f.advance(300000); assert.equal(f.calls.length, 1);
  let release; f.respond(() => new Promise(resolve => {release = resolve;}));
  f.doc.hidden = false; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.count('ownership'), '-'); assert.equal(f.cards('ownership').length, 0);
  f.mounted.destroy();
  release(response(directory([employee()], f.time()))); await settle();
  assert.equal(f.cards('ownership').length, 0);
  assert.equal(f.calls[1].options.signal.aborted, true);
  assert.equal(f.timers.size, 0);
});
