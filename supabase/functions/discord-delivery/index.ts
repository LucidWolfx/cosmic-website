import { createHandlers, configFromEnv } from '../_shared/discord.mjs';
import { createRosterSync } from '../_shared/roster-sync.mjs';

const config = configFromEnv((name: string) => Deno.env.get(name));
const handlers = createHandlers({
  config,
  syncRoster: createRosterSync({config}),
});
Deno.serve(handlers.delivery);
