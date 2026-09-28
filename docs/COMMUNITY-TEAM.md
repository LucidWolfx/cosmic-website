# Community team directory

The Community page uses Discord staff roles to populate the approved role-panel
and hexagonal profile-card layout. `site/assets/team.json` holds public panel
copy; it does not maintain a manual member roster. `team-directory.js` loads the
public `staff-directory` Edge Function. Build with `python tools/build.py`.

## Role hierarchy

| Order | Website section | Discord role ID |
| --- | --- | --- |
| 1 | Owners | 1329107732896284720 |
| 2 | Cosmic Management | 1329107732896284713 |
| 3 | Administrators | 1329107732850151502 |
| 4 | Moderators | 1329107732774781069 |
| 5 | Trial Staff | 1329107732774781068 |

A person appears once, under their highest matching role. Other matching staff
roles appear as badges on that same card. Counts describe the people listed in
each section, not everyone who holds a lower role. Bots and pending members are
excluded. People without a mapped staff role are never returned to the website.
The section's own role is not repeated as a badge. Wolf appears first in Owners
as the community's creator; other members retain the directory's normal order.

The public name uses the server nickname, then Discord display name, then
username. Wolf's verified Discord ID (351884909519831041) always displays as
**Wolf**, with an additional **Lead Developer** badge. This override never keeps
him in the directory if he leaves the guild or loses all mapped staff roles.
Server-specific avatars take precedence over global/default Discord avatars.
No personal bios are imported from Discord.

## Updating and availability

The server reads all member pages and publishes a complete filtered snapshot.
Successful snapshots are cached for up to five minutes per warm function
instance, with browser caching limited to the snapshot's remaining freshness.
The browser refreshes while the page is visible and rechecks on return.
Role changes, departures, display names, and pictures are reflected on refresh.

Expired member cards are cleared when a refresh fails. The page distinguishes
unavailable data from a successfully checked empty section. It does not keep a
persistent browser copy of the staff list. Rate limits use retry backoff; an
incomplete, failed, or truncated Discord response is never treated as a roster.

## Backend setup

`supabase/functions/_shared/staff-directory.mjs` owns the fixed guild and role
allowlist and safe public serialization. Its thin Deno entry point is
`supabase/functions/staff-directory/index.ts`. It uses the existing server-side
`DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID`, expected guild 1329107732003029093.
The bot's Server Members Intent must be enabled for Discord's List Guild Members
endpoint. This was already enabled when the feature was configured.

Deploy `staff-directory` with JWT verification disabled: this specific endpoint
is intentionally public and returns only approved staff display information.
It accepts no arbitrary guild, role, member, or URL parameters. It returns no
bot token, private portal records, email addresses, messages, or unrelated roles.
The frontend treats Discord names as text and restricts image URLs to Discord's
known CDN paths for the matching member. Existing authentication, department
permissions, and private rosters are unaffected by this public directory.

GitHub Pages deployment does not deploy Supabase functions. Deploy and verify
the function separately before publishing the frontend. Run `npm test` for
backend behavior and client payload validation tests.

The earlier `staff-avatar/wolf` image endpoint is retained for compatibility;
its fixed-identity policy and credentials are unchanged. The directory uses the
current avatar URL from each fresh Discord member snapshot instead.
