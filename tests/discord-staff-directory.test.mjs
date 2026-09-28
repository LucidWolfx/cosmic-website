import test from 'node:test';
import assert from 'node:assert/strict';
import {createStaffDirectoryHandler, staffDirectoryConfig} from '../supabase/functions/_shared/staff-directory.mjs';

const GUILD = '1329107732003029093';
const WOLF = '351884909519831041';
const ROLES = ['1329107732896284720', '1329107732896284713', '1329107732850151502', '1329107732774781069', '1329107732774781068'];
const GROUPS = ['ownership', 'management', 'administrator', 'moderator', 'trial-staff'];
const config = {guildId: GUILD, botToken: 'private-test-bot'};
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json', ...headers}});
const idAt = index => String(100000000000000000n + BigInt(index));
const member = (id, roles = [ROLES[3]], extra = {}) => ({user: {id, username: 'User ' + id, global_name: null, avatar: null, discriminator: '0'}, roles, pending: false, ...extra});
const request = (path = '/functions/v1/staff-directory', method = 'GET', headers = {}) => new Request('https://test.supabase.co' + path, {method, headers});
const sorted = rows => rows.sort((a, b) => BigInt(a.user.id) < BigInt(b.user.id) ? -1 : 1);
const fullPage = start => Array.from({length: 1000}, (_, i) => member(idAt(start + i), []));

function fixture(options = {}) {
  let clock = 1000000;
  let respond = () => json(options.members || []);
  const calls = [];
  const handler = createStaffDirectoryHandler({config: options.config || config, now: () => clock, fetchImpl: async (url, init) => {
    calls.push({url, init}); return respond(url, init);
  }});
  return {handler, calls, advance: ms => {clock += ms;}, setTime: value => {clock = value;}, respond: fn => {respond = fn;}};
}

test('fixed role hierarchy publishes each human once with highest role and only approved fields', async () => {
  const members = GROUPS.map((group, i) => member(idAt(i + 1), ROLES.slice(i), {nick: group}));
  members.push(member(WOLF, [...ROLES].reverse(), {nick: 'Private nickname', user: {id: WOLF, username: 'private-handle', email: 'private@example.test', avatar: 'a'.repeat(32)}, bio: 'Private bio', joined_at: 'private'}));
  const f = fixture({members: sorted(members)});
  const response = await f.handler(request()); const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.version, 1); assert.equal(data.refreshAfterSeconds, 300);
  assert.equal(data.updatedAt, new Date(1000000).toISOString()); assert.equal(data.members.length, 6);
  for (let i = 0; i < GROUPS.length; i++) {
    const publicRow = data.members.find(row => row.id === idAt(i + 1));
    assert.equal(publicRow.primaryGroup, GROUPS[i]); assert.deepEqual(publicRow.roles, GROUPS.slice(i));
  }
  const wolf = data.members.find(row => row.id === WOLF);
  assert.equal(wolf.name, 'Wolf'); assert.equal(wolf.primaryGroup, 'ownership'); assert.deepEqual(wolf.labels, ['Lead Developer']);
  for (const row of data.members) assert.deepEqual(Object.keys(row).sort(), ['avatarUrl', 'id', 'labels', 'name', 'primaryGroup', 'roles']);
  const text = JSON.stringify(data);
  for (const secret of ['Private nickname', 'private-handle', 'private@example.test', 'Private bio', config.botToken, ...ROLES]) assert.ok(!text.includes(secret));
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
});

test('bots, pending members, unrelated roles and a Wolf account without staff roles are excluded', async () => {
  const bot = member(idAt(1), [ROLES[0]], {user: {id: idAt(1), username: 'Bot', bot: true}});
  const f = fixture({members: sorted([bot, member(idAt(2), [ROLES[1]], {pending: true}), member(idAt(3), ['123456789012345678']), member(WOLF, [])])});
  assert.deepEqual((await (await f.handler(request())).json()).members, []);
});

test('public name preference, aliases and deterministic name then ID ordering are preserved', async () => {
  const f = fixture({members: [
    member(idAt(1), undefined, {nick: 'Zulu', user: {id: idAt(1), global_name: 'Ignored', username: 'Ignored'}}),
    member(idAt(2), undefined, {nick: '', user: {id: idAt(2), global_name: 'Alpha', username: 'Ignored'}}),
    member(idAt(3), undefined, {user: {id: idAt(3), global_name: null, username: 'Alpha'}})
  ]});
  const rows = (await (await f.handler(request())).json()).members;
  assert.deepEqual(rows.map(row => row.id), [idAt(2), idAt(3), idAt(1)]);
  assert.deepEqual(rows.map(row => row.name), ['Alpha', 'Alpha', 'Zulu']);
  assert.ok(rows.every(row => row.labels.length === 0));
});

test('public nicknames strip ASCII and bidi controls before client validation', async () => {
  const f = fixture({members: [member(idAt(1), undefined, {nick: ' \u202aA\u202bl\u202cp\u202dh\u202ea\u2066\u2067\u2068\u2069\u0000 '})]});
  const response = await f.handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).members[0].name, 'Alpha');
});

test('avatar URL preference is guild, account, then modern or legacy Discord default', async () => {
  const rows = [
    member(idAt(1), undefined, {avatar: 'a_' + 'a'.repeat(32)}),
    member(idAt(2), undefined, {user: {id: idAt(2), username: 'Second', avatar: 'b'.repeat(32)}}),
    member(idAt(3)),
    member(idAt(4), undefined, {user: {id: idAt(4), username: 'Fourth', discriminator: '1234'}})
  ];
  const f = fixture({members: rows}); const result = (await (await f.handler(request())).json()).members;
  const url = id => result.find(row => row.id === id).avatarUrl;
  assert.equal(url(idAt(1)), `https://cdn.discordapp.com/guilds/${GUILD}/users/${idAt(1)}/avatars/a_${'a'.repeat(32)}.png?size=256`);
  assert.equal(url(idAt(2)), `https://cdn.discordapp.com/avatars/${idAt(2)}/${'b'.repeat(32)}.png?size=256`);
  assert.equal(url(idAt(3)), `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(idAt(3)) >> 22n) % 6n)}.png`);
  assert.equal(url(idAt(4)), 'https://cdn.discordapp.com/embed/avatars/4.png');
  assert.equal(f.calls.length, 1);
});

test('only fixed routes and read methods work; request credentials and selectors never reach Discord', async () => {
  const f = fixture();
  for (const path of ['/functions/v1/staff-directory/wolf', '/staff-directory/', '/staff-director%79', '/staff-directory?guild=other', '/staff-directory?after=0', '/staff-directory?']) {
    assert.equal((await f.handler(request(path))).status, 404);
  }
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await f.handler(request('/staff-directory', method))).status, 405);
  const preflight = await f.handler(request('/staff-directory', 'OPTIONS'));
  assert.equal(preflight.status, 204); assert.equal(f.calls.length, 0);
  const head = await f.handler(request('/staff-directory', 'HEAD', {authorization: 'Bearer caller-secret', cookie: 'private=cookie', origin: 'https://lucidwolfx.github.io'}));
  assert.equal(head.status, 200); assert.equal(head.body, null);
  const response = await f.handler(request()); assert.equal(response.status, 200); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `https://discord.com/api/v10/guilds/${GUILD}/members?limit=1000`);
  assert.deepEqual(f.calls[0].init.headers, {Authorization: 'Bot private-test-bot', 'User-Agent': 'DiscordBot (https://github.com/LucidWolfx/cosmic-website, 1.0)'});
  assert.equal(f.calls[0].init.redirect, 'error'); assert.ok(f.calls[0].init.signal instanceof AbortSignal);
  assert.equal(head.headers.get('content-length'), String((await response.arrayBuffer()).byteLength));
});

test('configuration reads only bot and guild secrets and fails for any other guild', async () => {
  const reads = [];
  assert.deepEqual(staffDirectoryConfig(key => {reads.push(key); return key;}), {botToken: 'DISCORD_BOT_TOKEN', guildId: 'DISCORD_GUILD_ID'});
  assert.deepEqual(reads, ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);
  for (const c of [{...config, guildId: '123456789012345678'}, {...config, guildId: '../bad'}, {...config, botToken: ''}]) {
    const f = fixture({config: c}); assert.equal((await f.handler(request())).status, 503); assert.equal(f.calls.length, 0);
  }
});

test('cache has a five-minute absolute lifetime and concurrent expired requests share one refresh', async () => {
  const f = fixture({members: [member(WOLF, [ROLES[0]])]});
  await f.handler(request()); f.advance(120000);
  assert.equal((await f.handler(request())).headers.get('cache-control'), 'public, max-age=180, must-revalidate'); assert.equal(f.calls.length, 1);
  f.advance(180000); let release;
  f.respond(() => new Promise(resolve => {release = resolve;}));
  const pending = Array.from({length: 5}, () => f.handler(request())); assert.equal(f.calls.length, 2);
  release(json([member(WOLF, [ROLES[3]])]));
  for (const response of await Promise.all(pending)) assert.equal((await response.json()).members[0].primaryGroup, 'moderator');
  assert.equal(f.calls.length, 2);
  f.advance(300000); f.respond(() => json([]));
  assert.deepEqual((await (await f.handler(request())).json()).members, []);
});

test('expired staff data is never served during an outage, including cooldown and HEAD requests', async () => {
  const f = fixture({members: [member(WOLF, [ROLES[0]])]}); await f.handler(request()); f.advance(300000);
  f.respond(() => json({message: 'secret upstream detail'}, 503));
  const response = await f.handler(request());
  assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {error: 'Staff directory unavailable.'});
  assert.equal((await f.handler(request('/staff-directory', 'HEAD'))).body, null); assert.equal(f.calls.length, 2);
  f.advance(60000); f.respond(() => json([])); assert.equal((await f.handler(request())).status, 200);
});

test('pagination advances from the highest validated ID and publishes only after the last page', async () => {
  const first = fullPage(1); first[0].roles = [ROLES[3]];
  const f = fixture(); f.respond(url => json(url.includes('&after=') ? [member(WOLF, [ROLES[0]])] : first));
  const response = await f.handler(request()); const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.members.length, 2); assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].url, `https://discord.com/api/v10/guilds/${GUILD}/members?limit=1000&after=${idAt(1000)}`);
});

test('duplicate, unsorted, malformed and non-advancing IDs fail without a partial directory', async () => {
  for (const rows of [[member(idAt(2)), member(idAt(1))], [member(idAt(1)), member(idAt(1))], [member('../bad')], {members: []}, [member(idAt(1), ['invalid-role'])], [member(idAt(1), undefined, {avatar: 'https://evil.test/image'})]]) {
    const f = fixture(); f.respond(() => json(rows)); assert.equal((await f.handler(request())).status, 503);
  }
  const first = fullPage(1); first[0].roles = [ROLES[0]];
  const f = fixture(); f.respond(() => json(first));
  const response = await f.handler(request()); assert.equal(response.status, 503); assert.equal(f.calls.length, 2);
  assert.deepEqual(await response.json(), {error: 'Staff directory unavailable.'});
});

test('page cap and oversized page lists fail closed instead of claiming a complete count', async () => {
  const f = fixture(); f.respond(() => json(fullPage((f.calls.length - 1) * 1000 + 1)));
  assert.equal((await f.handler(request())).status, 503); assert.equal(f.calls.length, 20);
  const g = fixture(); g.respond(() => json([...fullPage(1), member(idAt(1001))]));
  assert.equal((await g.handler(request())).status, 503);
  const h = fixture(); h.respond(() => new Response('[]', {headers: {'content-length': String(8 * 1024 * 1024 + 1)}}));
  assert.equal((await h.handler(request())).status, 503);
});

test('rate limits honor both Retry-After and JSON retry_after, then recover', async () => {
  const f = fixture(); f.respond(() => json({retry_after: 120}, 429, {'retry-after': '90'}));
  const response = await f.handler(request()); assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '120');
  assert.ok(response.headers.get('access-control-expose-headers').toLowerCase().split(',').map(value => value.trim()).includes('retry-after'));
  f.advance(119000); await f.handler(request()); assert.equal(f.calls.length, 1);
  f.advance(1000); f.respond(() => json([])); assert.equal((await f.handler(request())).status, 200); assert.equal(f.calls.length, 2);
  const g = fixture(); g.setTime(Date.parse('2026-01-01T00:00:00Z')); g.respond(() => json({}, 429, {'retry-after': 'Thu, 01 Jan 2026 00:02:00 GMT'}));
  assert.equal((await g.handler(request())).headers.get('retry-after'), '120');
});

test('later-page errors, missing privileged intent and network errors return no partial or internal data', async () => {
  for (const failure of [() => json({message: 'Missing privileged intent'}, 403), () => json({message: config.botToken}, 500), () => {throw new Error(config.botToken);}]) {
    const first = fullPage(1); first[0].roles = [ROLES[0]];
    const f = fixture(); f.respond(() => f.calls.length === 1 ? json(first) : failure());
    const response = await f.handler(request()); assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {error: 'Staff directory unavailable.'}); assert.equal(f.calls.length, 2);
  }
});

test('total deadline stops further pagination before a partial result can be published', async () => {
  const f = fixture(); f.respond(() => {f.advance(7000); return json(fullPage((f.calls.length - 1) * 1000 + 1));});
  const response = await f.handler(request()); assert.equal(response.status, 503); assert.equal(f.calls.length, 4);
});

test('per-request timeout aborts an unresponsive Discord fetch at eight seconds', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture();
  f.respond((url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('Timed out')), {once: true})));
  const pending = f.handler(request());
  t.mock.timers.tick(7999); assert.equal(f.calls[0].init.signal.aborted, false);
  t.mock.timers.tick(1); assert.equal(f.calls[0].init.signal.aborted, true);
  assert.equal((await pending).status, 503);
});
