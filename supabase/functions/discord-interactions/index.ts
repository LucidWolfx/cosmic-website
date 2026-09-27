import { createHandlers, configFromEnv } from '../_shared/discord.mjs';

const handlers = createHandlers({
  config: configFromEnv((name: string) => Deno.env.get(name)),
  waitUntil: (task: Promise<unknown>) => EdgeRuntime.waitUntil(task),
});
Deno.serve(handlers.interactions);
