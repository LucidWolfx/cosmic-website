import {createStaffAvatarHandler, staffAvatarConfig} from '../_shared/staff-avatar.mjs';

Deno.serve(createStaffAvatarHandler({config: staffAvatarConfig((name: string) => Deno.env.get(name))}));
