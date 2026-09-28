import {createStaffDirectoryHandler, staffDirectoryConfig} from '../_shared/staff-directory.mjs';

Deno.serve(createStaffDirectoryHandler({config: staffDirectoryConfig((name: string) => Deno.env.get(name))}));
