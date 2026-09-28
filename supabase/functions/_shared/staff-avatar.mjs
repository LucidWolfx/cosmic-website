// Public, explicitly approved staff artwork only. No portal profiles or roles.
const WOLF_ID = '351884909519831041';
const ID = /^[0-9]{17,20}$/;
const HASH = /^(?:a_)?[0-9a-f]{32}$/;
const ROUTES = new Set(['/staff-avatar/wolf', '/functions/v1/staff-avatar/wolf']);
const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;
const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

class AvatarFailure extends Error {
  constructor({status = 503, retryMs = 60000, transient = false} = {}) {
    super('Staff avatar unavailable.');
    this.status = status;
    this.retryMs = retryMs;
    this.transient = transient;
  }
}

export function staffAvatarConfig(get) {
  return {botToken: get('DISCORD_BOT_TOKEN'), guildId: get('DISCORD_GUILD_ID')};
}

async function readLimited(response, limit) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel();
    throw new AvatarFailure();
  }
  if (!response.body) throw new AvatarFailure();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AvatarFailure();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return bytes;
}

async function readJson(response) {
  const bytes = await readLimited(response, 128 * 1024);
  try {return JSON.parse(new TextDecoder().decode(bytes));}
  catch {throw new AvatarFailure();}
}

function retryDelay(response, body, at) {
  const header = response.headers.get('retry-after');
  const seconds = Number(header);
  const headerMs = header && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header || '') - at;
  const bodyMs = Number(body?.retry_after) * 1000;
  const delays = [headerMs, bodyMs].filter(value => Number.isFinite(value) && value > 0);
  return delays.length ? Math.max(1000, ...delays) : 60000;
}

function avatarUrl(member, guildId) {
  if (!member || member.user?.id !== WOLF_ID) throw new AvatarFailure();
  const cdn = 'https://cdn.discordapp.com';
  if (member.avatar != null) {
    if (typeof member.avatar !== 'string' || !HASH.test(member.avatar)) throw new AvatarFailure();
    return `${cdn}/guilds/${guildId}/users/${WOLF_ID}/avatars/${member.avatar}.png?size=256`;
  }
  if (member.user.avatar != null) {
    if (typeof member.user.avatar !== 'string' || !HASH.test(member.user.avatar)) throw new AvatarFailure();
    return `${cdn}/avatars/${WOLF_ID}/${member.user.avatar}.png?size=256`;
  }
  const discriminator = member.user.discriminator;
  const index = typeof discriminator === 'string' && /^[0-9]{1,4}$/.test(discriminator) && Number(discriminator) > 0
    ? Number(discriminator) % 5
    : Number((BigInt(WOLF_ID) >> 22n) % 6n);
  return `${cdn}/embed/avatars/${index}.png`;
}

export function createStaffAvatarHandler({config, fetchImpl = fetch, now = () => Date.now()}) {
  let cached = null;
  let inflight = null;
  let retryAt = 0;
  let failure = new AvatarFailure();

  async function refresh() {
    try {
      const memberResponse = await fetchImpl(`https://discord.com/api/v10/guilds/${config.guildId}/members/${WOLF_ID}`, {
        headers: {Authorization: `Bot ${config.botToken}`, 'User-Agent': 'DiscordBot (https://github.com/LucidWolfx/cosmic-website, 1.0)'},
        redirect: 'error', signal: AbortSignal.timeout(8000)
      });
      if (!memberResponse.ok) {
        let body;
        try {body = await readJson(memberResponse);} catch {}
        if (memberResponse.status === 404 && body?.code === 10007) {
          throw new AvatarFailure({status: 404, retryMs: FRESH_MS});
        }
        throw new AvatarFailure({
          retryMs: retryDelay(memberResponse, body, now()),
          transient: memberResponse.status === 429 || memberResponse.status >= 500
        });
      }
      const member = await readJson(memberResponse);
      const imageResponse = await fetchImpl(avatarUrl(member, config.guildId), {
        redirect: 'error', signal: AbortSignal.timeout(8000)
      });
      if (!imageResponse.ok) {
        let body;
        if (imageResponse.status === 429) {try {body = await readJson(imageResponse);} catch {}}
        else await imageResponse.body?.cancel();
        throw new AvatarFailure({
          retryMs: retryDelay(imageResponse, body, now()),
          transient: imageResponse.status === 429 || imageResponse.status >= 500
        });
      }
      const type = (imageResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!IMAGE_TYPES.has(type)) {
        await imageResponse.body?.cancel();
        throw new AvatarFailure();
      }
      const bytes = await readLimited(imageResponse, MAX_IMAGE);
      if (!bytes.byteLength) throw new AvatarFailure();
      cached = {bytes, type, at: now()};
      retryAt = 0;
      failure = null;
    } catch (error) {
      failure = error instanceof AvatarFailure ? error : new AvatarFailure({transient: true});
      retryAt = now() + failure.retryMs;
      // Confirmed departure, identity mismatch, invalid data and other permanent
      // failures must never continue displaying a previously fetched image.
      if (!failure.transient) cached = null;
    }
  }

  function unavailable(request, status = failure?.status || 503, allow = false) {
    const headers = {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'};
    if (allow) headers.allow = 'GET, HEAD';
    if (status === 503 && retryAt > now()) headers['retry-after'] = String(Math.ceil((retryAt - now()) / 1000));
    return new Response(request.method === 'HEAD' ? null : 'Staff avatar unavailable.', {status, headers});
  }

  function image(request, stale = false) {
    const remaining = (cached.at + (stale ? STALE_MS : FRESH_MS) - now()) / 1000;
    const maxAge = Math.max(0, Math.floor(Math.min(stale ? 30 : 300, remaining)));
    return new Response(request.method === 'HEAD' ? null : cached.bytes, {
      status: 200,
      headers: {
        'content-type': cached.type, 'content-length': String(cached.bytes.byteLength),
        'cache-control': `public, max-age=${maxAge}, must-revalidate`,
        'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'cross-origin'
      }
    });
  }

  return async request => {
    const url = new URL(request.url);
    if (!ROUTES.has(url.pathname) || request.url.includes('?') || url.hash) return unavailable(request, 404);
    if (!['GET', 'HEAD'].includes(request.method)) return unavailable(request, 405, true);
    if (!config || typeof config.botToken !== 'string' || !config.botToken.trim() || !ID.test(config.guildId || '')) {
      return unavailable(request, 503);
    }
    if (cached && now() - cached.at < FRESH_MS) return image(request);
    if (now() >= retryAt) {
      if (!inflight) inflight = refresh().finally(() => {inflight = null;});
      await inflight;
    }
    if (cached && now() - cached.at < FRESH_MS) return image(request);
    if (failure?.transient && cached && now() - cached.at < STALE_MS) return image(request, true);
    return unavailable(request);
  };
}
