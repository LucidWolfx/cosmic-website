import { createHandlers, configFromEnv } from '../_shared/discord.mjs';

const handlers = createHandlers({
  config: configFromEnv((name: string) => Deno.env.get(name)),
});
Deno.serve(handlers.delivery);
