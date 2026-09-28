import test from 'node:test';
import assert from 'node:assert/strict';
import {createStaffAvatarHandler, staffAvatarConfig} from '../supabase/functions/_shared/staff-avatar.mjs';

const WOLF = '351884909519831041';
const GUILD = '1329107732003029093';
const GUILD_HASH = 'a_' + 'a'.repeat(32);
const USER_HASH = 'b'.repeat(32);
const config = {botToken: 'private-test-bot', guildId: GUILD};
const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json', ...headers}});
const member = (extra = {}) => ({avatar: GUILD_HASH, user: {id: WOLF, avatar: USER_HASH, discriminator: '0'}, ...extra});
const request = (path = '/functions/v1/staff-avatar/wolf', method = 'GET') => new Request('https://test.supabase.co' + path, {method});

function fixture(options = {}) {
  const calls = [];
  let clock = 1000000;
  let memberReply = () => json(options.member || member());
  let imageReply = () => new Response(imageBytes, {headers: {'content-type': 'image/png'}});
  const handler = createStaffAvatarHandler({config: options.config || config, now: () => clock, fetchImpl: async (url, init) => {
    calls.push({url, init});
    return url.startsWith('https://discord.com/api/v10/') ? memberReply(url, init) : imageReply(url, init);
  }});
  return {handler, calls, advance: ms => {clock += ms;}, setTime: value => {clock = value;},
    memberReply: fn => {memberReply = fn;}, imageReply: fn => {imageReply = fn;}};
}

test('fixed guild avatar is proxied without profile data, upstream headers or bot credentials', async () => {
  const f = fixture();
  f.imageReply(() => new Response(imageBytes, {headers: {'content-type': 'image/png', 'set-cookie': 'private=secret', 'x-private': 'secret'}}));
  const response = await f.handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), imageBytes);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300, must-revalidate');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('x-private'), null);
  assert.equal(response.headers.get('location'), null);
  assert.equal(f.calls[0].url, `https://discord.com/api/v10/guilds/${GUILD}/members/${WOLF}`);
  assert.equal(f.calls[0].init.headers.Authorization, 'Bot private-test-bot');
  assert.equal(f.calls[0].init.headers['User-Agent'], 'DiscordBot (https://github.com/LucidWolfx/cosmic-website, 1.0)');
  assert.equal(f.calls[1].url, `https://cdn.discordapp.com/guilds/${GUILD}/users/${WOLF}/avatars/${GUILD_HASH}.png?size=256`);
  assert.equal(f.calls[1].init.headers, undefined);
  for (const call of f.calls) {assert.equal(call.init.redirect, 'error'); assert.ok(call.init.signal instanceof AbortSignal);}
});

test('account avatar and Discord default avatars are used only when the preferred image is absent', async () => {
  const global = fixture({member: member({avatar: null})});
  assert.equal((await global.handler(request())).status, 200);
  assert.equal(global.calls[1].url, `https://cdn.discordapp.com/avatars/${WOLF}/${USER_HASH}.png?size=256`);
  for (const discriminator of ['0', '1234']) {
    const f = fixture({member: member({avatar: null, user: {id: WOLF, avatar: null, discriminator}})});
    assert.equal((await f.handler(request())).status, 200);
    const index = discriminator === '0' ? Number((BigInt(WOLF) >> 22n) % 6n) : 4;
    assert.equal(f.calls[1].url, `https://cdn.discordapp.com/embed/avatars/${index}.png`);
  }
});

test('only the two deployment route forms and GET or HEAD can access the fixed identity', async () => {
  const f = fixture();
  for (const path of ['/functions/v1/staff-avatar', '/functions/v1/staff-avatar/other', '/functions/v1/staff-avatar/wolf/', '/staff-avatar/%77olf', '/staff-avatar/wolf?user=' + WOLF, '/staff-avatar/wolf?x=1', '/staff-avatar/wolf?']) {
    assert.equal((await f.handler(request(path))).status, 404, path);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await f.handler(request('/staff-avatar/wolf', method));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  }
  assert.equal(f.calls.length, 0);
  const head = await f.handler(request('/staff-avatar/wolf', 'HEAD'));
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal(head.headers.get('content-length'), String(imageBytes.byteLength));
  assert.equal((await f.handler(request())).status, 200);
  assert.equal(f.calls.length, 2);
});

test('invalid configuration, returned identity and avatar hashes cannot choose another upstream', async () => {
  for (const c of [{botToken: '', guildId: GUILD}, {botToken: config.botToken, guildId: '../bad'}]) {
    const f = fixture({config: c}); assert.equal((await f.handler(request())).status, 503); assert.equal(f.calls.length, 0);
  }
  for (const m of [member({user: {id: '100000000000000001', avatar: USER_HASH}}), member({avatar: '../../anything'}), member({avatar: null, user: {id: WOLF, avatar: 'https://evil.test/avatar'}})]) {
    const f = fixture({member: m}); const response = await f.handler(request());
    assert.equal(response.status, 503); assert.equal(f.calls.length, 1);
    assert.equal(await response.text(), 'Staff avatar unavailable.');
  }
  const read = [];
  assert.deepEqual(staffAvatarConfig(name => {read.push(name); return name;}), {botToken: 'DISCORD_BOT_TOKEN', guildId: 'DISCORD_GUILD_ID'});
  assert.deepEqual(read, ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);
});

test('five-minute cache ages without extending freshness and coalesces refreshes', async () => {
  const f = fixture();
  await f.handler(request()); f.advance(120000);
  assert.equal((await f.handler(request())).headers.get('cache-control'), 'public, max-age=180, must-revalidate');
  assert.equal(f.calls.length, 2);
  f.advance(180000);
  let release;
  f.memberReply(() => new Promise(resolve => {release = resolve;}));
  const pending = Array.from({length: 8}, () => f.handler(request()));
  assert.equal(f.calls.length, 3);
  release(json(member({avatar: 'c'.repeat(32)})));
  const responses = await Promise.all(pending);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(f.calls.length, 4);
  assert.ok(f.calls[3].url.includes('c'.repeat(32)));
});

test('transient failures use bounded stale images and cannot extend their six-hour lifetime', async () => {
  const f = fixture(); await f.handler(request()); f.advance(300000);
  f.memberReply(() => json({error: 'private upstream detail'}, 503));
  const stale = await f.handler(request());
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get('cache-control'), 'public, max-age=30, must-revalidate');
  assert.equal(f.calls.length, 3);
  await f.handler(request()); assert.equal(f.calls.length, 3);
  f.advance(6 * 60 * 60 * 1000 - 300001);
  assert.equal((await f.handler(request())).headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  f.advance(1);
  const expired = await f.handler(request());
  assert.equal(expired.status, 503);
  assert.equal(expired.headers.get('cache-control'), 'no-store');
  assert.equal(await expired.text(), 'Staff avatar unavailable.');
});

test('Discord 429 honors both Retry-After and JSON retry_after without repeated upstream calls', async () => {
  const f = fixture();
  f.memberReply(() => json({retry_after: 120}, 429, {'retry-after': '90'}));
  const response = await f.handler(request());
  assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '120');
  f.advance(119000); await f.handler(request()); assert.equal(f.calls.length, 1);
  f.advance(1000); f.memberReply(() => json(member()));
  assert.equal((await f.handler(request())).status, 200); assert.equal(f.calls.length, 3);
});

test('CDN 429 honors HTTP-date Retry-After and retains an already cached image', async () => {
  const f = fixture(); f.setTime(Date.parse('2026-01-01T00:00:00Z'));
  await f.handler(request()); f.advance(300000);
  f.imageReply(() => json({retry_after: 30}, 429, {'retry-after': 'Thu, 01 Jan 2026 00:07:00 GMT'}));
  assert.equal((await f.handler(request())).status, 200); assert.equal(f.calls.length, 4);
  f.advance(119000); await f.handler(request()); assert.equal(f.calls.length, 4);
  f.advance(1000); await f.handler(request()); assert.equal(f.calls.length, 6);
});

test('confirmed Unknown Member clears the image and negatively caches departure', async () => {
  const f = fixture(); await f.handler(request()); f.advance(300000);
  f.memberReply(() => json({code: 10007, message: 'Unknown Member'}, 404));
  assert.equal((await f.handler(request())).status, 404);
  assert.equal(f.calls.length, 3);
  f.advance(299999); assert.equal((await f.handler(request())).status, 404); assert.equal(f.calls.length, 3);
  f.advance(1); f.memberReply(() => json(member()));
  assert.equal((await f.handler(request())).status, 200); assert.equal(f.calls.length, 5);
});

test('permanent authorization and identity failures do not expose the stale avatar', async () => {
  for (const reply of [() => json({message: config.botToken}, 403), () => json(member({user: {id: '100000000000000001'}}))]) {
    const f = fixture(); await f.handler(request()); f.advance(300000); f.memberReply(reply);
    const response = await f.handler(request()); assert.equal(response.status, 503);
    assert.equal(await response.text(), 'Staff avatar unavailable.');
    assert.equal((await f.handler(request('/staff-avatar/wolf', 'HEAD'))).body, null);
  }
});

test('non-image, empty and oversized image bodies are rejected, including streamed bodies', async () => {
  const tooLarge = 5 * 1024 * 1024 + 1;
  for (const reply of [
    () => new Response('<script>bad</script>', {headers: {'content-type': 'text/html'}}),
    () => new Response('', {headers: {'content-type': 'image/png'}}),
    () => new Response(imageBytes, {headers: {'content-type': 'image/png', 'content-length': String(tooLarge)}}),
    () => new Response(new ReadableStream({start(controller) {controller.enqueue(new Uint8Array(tooLarge)); controller.close();}}), {headers: {'content-type': 'image/png'}})
  ]) {
    const f = fixture(); f.imageReply(reply);
    const response = await f.handler(request()); assert.equal(response.status, 503);
    assert.equal(await response.text(), 'Staff avatar unavailable.');
  }
});

test('network exceptions produce a generic response and a retry cooldown', async () => {
  const f = fixture(); f.memberReply(() => {throw new Error('private-test-bot and upstream internals');});
  const response = await f.handler(request()); assert.equal(response.status, 503);
  assert.equal(await response.text(), 'Staff avatar unavailable.');
  await f.handler(request()); assert.equal(f.calls.length, 1);
  f.advance(60000); f.memberReply(() => json(member()));
  assert.equal((await f.handler(request())).status, 200);
});
