// Public projection of current Cosmic staff roles. Never returns raw members.
const GUILD_ID = '1329107732003029093';
const WOLF_ID = '351884909519831041';
const ID = /^[0-9]{17,20}$/;
const HASH = /^(?:a_)?[0-9a-f]{32}$/;
const ROUTES = new Set(['/staff-directory', '/functions/v1/staff-directory']);
const ROLE_GROUPS = [
  ['ownership', '1329107732896284720'],
  ['management', '1329107732896284713'],
  ['administrator', '1329107732850151502'],
  ['moderator', '1329107732774781069'],
  ['trial-staff', '1329107732774781068']
];
const FRESH_MS = 300000;
const REQUEST_MS = 8000;
const TOTAL_MS = 25000;
const PAGE_LIMIT = 1000;
const MAX_PAGES = 20;
const MAX_PAGE_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();

class DirectoryFailure extends Error {
  constructor(retryMs = 60000) {super('Staff directory unavailable.'); this.retryMs = retryMs;}
}

export function staffDirectoryConfig(get) {
  return {botToken: get('DISCORD_BOT_TOKEN'), guildId: get('DISCORD_GUILD_ID')};
}

async function readJson(response, limit = MAX_PAGE_BYTES) {
  if (Number(response.headers.get('content-length')) > limit || !response.body) {
    await response.body?.cancel();
    throw new DirectoryFailure();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {await reader.cancel(); throw new DirectoryFailure();}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  try {return JSON.parse(new TextDecoder().decode(bytes));}
  catch {throw new DirectoryFailure();}
}

function retryDelay(response, body, at) {
  const header = response.headers.get('retry-after');
  const seconds = Number(header);
  const headerMs = header && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header || '') - at;
  const bodyMs = Number(body?.retry_after) * 1000;
  const delays = [headerMs, bodyMs].filter(value => Number.isFinite(value) && value > 0);
  return delays.length ? Math.max(1000, ...delays) : 60000;
}

function avatarUrl(member) {
  const id = member.user.id;
  if (member.avatar != null) {
    if (typeof member.avatar !== 'string' || !HASH.test(member.avatar)) throw new DirectoryFailure();
    return `https://cdn.discordapp.com/guilds/${GUILD_ID}/users/${id}/avatars/${member.avatar}.png?size=256`;
  }
  if (member.user.avatar != null) {
    if (typeof member.user.avatar !== 'string' || !HASH.test(member.user.avatar)) throw new DirectoryFailure();
    return `https://cdn.discordapp.com/avatars/${id}/${member.user.avatar}.png?size=256`;
  }
  const discriminator = member.user.discriminator;
  const index = typeof discriminator === 'string' && /^[0-9]{1,4}$/.test(discriminator) && Number(discriminator) > 0
    ? Number(discriminator) % 5 : Number((BigInt(id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function displayName(member) {
  if (member.user.id === WOLF_ID) return 'Wolf';
  for (const value of [member.nick, member.user.global_name, member.user.username]) {
    if (typeof value !== 'string') continue;
    const name = value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 80);
    if (name) return name;
  }
  throw new DirectoryFailure();
}

function publicMember(member) {
  if (!Array.isArray(member.roles) || member.roles.some(role => typeof role !== 'string' || !ID.test(role))) throw new DirectoryFailure();
  if ((member.user.bot !== undefined && typeof member.user.bot !== 'boolean') ||
      (member.pending !== undefined && typeof member.pending !== 'boolean')) throw new DirectoryFailure();
  if (member.user.bot === true || member.pending === true) return null;
  const roles = ROLE_GROUPS.filter(([, id]) => member.roles.includes(id)).map(([slug]) => slug);
  if (!roles.length) return null;
  return {id: member.user.id, name: displayName(member), avatarUrl: avatarUrl(member),
    primaryGroup: roles[0], roles, labels: member.user.id === WOLF_ID ? ['Lead Developer'] : []};
}

export function createStaffDirectoryHandler({config, fetchImpl = fetch, now = () => Date.now()}) {
  let cached = null;
  let inflight = null;
  let retryAt = 0;

  async function fetchPage(after, totalSignal, deadline) {
    if (totalSignal.aborted || now() >= deadline) throw new DirectoryFailure();
    const controller = new AbortController();
    const abort = () => controller.abort();
    totalSignal.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(abort, Math.min(REQUEST_MS, deadline - now()));
    try {
      const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=${PAGE_LIMIT}` + (after ? `&after=${after}` : '');
      const response = await fetchImpl(url, {headers: {
        Authorization: `Bot ${config.botToken}`,
        'User-Agent': 'DiscordBot (https://github.com/LucidWolfx/cosmic-website, 1.0)'
      }, redirect: 'error', signal: controller.signal});
      if (!response.ok) {
        let body;
        try {body = await readJson(response, 128 * 1024);} catch {}
        throw new DirectoryFailure(retryDelay(response, body, now()));
      }
      const rows = await readJson(response);
      if (controller.signal.aborted || totalSignal.aborted || now() >= deadline) throw new DirectoryFailure();
      return rows;
    } finally {
      clearTimeout(timer);
      totalSignal.removeEventListener('abort', abort);
    }
  }

  async function refresh() {
    const total = new AbortController();
    const timer = setTimeout(() => total.abort(), TOTAL_MS);
    const deadline = now() + TOTAL_MS;
    try {
      const members = [];
      let after = '';
      for (let page = 0; page < MAX_PAGES; page++) {
        const rows = await fetchPage(after, total.signal, deadline);
        if (!Array.isArray(rows) || rows.length > PAGE_LIMIT) throw new DirectoryFailure();
        let previous = after ? BigInt(after) : 0n;
        for (const member of rows) {
          const id = member?.user?.id;
          if (typeof id !== 'string' || !ID.test(id) || BigInt(id) <= previous) throw new DirectoryFailure();
          previous = BigInt(id);
          const published = publicMember(member);
          if (published) members.push(published);
        }
        if (total.signal.aborted || now() >= deadline) throw new DirectoryFailure();
        if (rows.length < PAGE_LIMIT) {
          members.sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}) || (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
          const at = now();
          const text = JSON.stringify({version: 1, updatedAt: new Date(at).toISOString(), refreshAfterSeconds: 300, members});
          cached = {at, text, length: encoder.encode(text).byteLength};
          retryAt = 0;
          return;
        }
        after = previous.toString();
      }
      // A full final page could mean more members. Never publish a truncated list.
      throw new DirectoryFailure();
    } catch (error) {
      cached = null;
      retryAt = now() + (error instanceof DirectoryFailure ? error.retryMs : 60000);
    } finally {clearTimeout(timer);}
  }

  function reply(request, status, text, cacheControl = 'no-store', extra = {}) {
    return new Response(request.method === 'HEAD' ? null : text, {status, headers: {
      'content-type': 'application/json; charset=utf-8', 'cache-control': cacheControl,
      'access-control-allow-origin': '*', 'access-control-expose-headers': 'Retry-After',
      'x-content-type-options': 'nosniff', ...extra
    }});
  }

  return async request => {
    const url = new URL(request.url);
    const error = JSON.stringify({error: 'Staff directory unavailable.'});
    if (!ROUTES.has(url.pathname) || request.url.includes('?') || url.hash) return reply(request, 404, error);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-max-age': '600', 'cache-control': 'no-store'
    }});
    if (!['GET', 'HEAD'].includes(request.method)) return reply(request, 405, error, 'no-store', {allow: 'GET, HEAD, OPTIONS'});
    if (!config || config.guildId !== GUILD_ID || !ID.test(config.guildId) || typeof config.botToken !== 'string' || !config.botToken.trim()) {
      return reply(request, 503, error);
    }
    if ((!cached || now() - cached.at >= FRESH_MS) && now() >= retryAt) {
      if (!inflight) inflight = refresh().finally(() => {inflight = null;});
      await inflight;
    }
    if (cached && now() - cached.at < FRESH_MS) {
      const remaining = Math.max(0, Math.floor((cached.at + FRESH_MS - now()) / 1000));
      return reply(request, 200, cached.text, `public, max-age=${remaining}, must-revalidate`, {'content-length': String(cached.length)});
    }
    return reply(request, 503, error, 'no-store', retryAt > now() ? {'retry-after': String(Math.ceil((retryAt - now()) / 1000))} : {});
  };
}
