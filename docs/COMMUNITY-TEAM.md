# Community team directory

The Community page introduces the public leadership and staff team.
Edit `site/assets/team.json`, then run `python tools/build.py`.

The directory combines role panels (title, description, icon, member count)
with individual profile cards (hexagonal avatar, name, role badge, and bio).
The base remains black with crimson Ownership and cyan Development accents.

`groups` defines each panel with a unique URL-safe `id`, `title`, `description`,
`icon` from the existing icon set, and `accent` (`crimson` or `cyan`).
Each member has a unique `id`, public `name`, full `role`, and a `roles` mapping
from group ID to the title shown in that group. Optional `roleBios` overrides
the general `bio` for a particular panel. Array order controls display order.

Optional `avatarUrl` must be an HTTPS image URL. The picture replaces `initials`
only after it loads successfully; unavailable images retain the styled fallback.
All member cards use the existing avatar loader and public picture endpoint.

Only publish confirmed names and titles. An empty group shows a short directory
update message; it does not create fictional staff or imply a vacant position.
Wolf appears in Ownership as **Owner** and Development as **Lead Developer**.
Those are two roles held by one person. Panel counts count each role's published
members independently; they are not an overall unique staff total.
The Discord username is not part of the public profile.

This public directory is separate from website authorization and private
department rosters. Editing it does not grant portal access, Discord roles, or
department permissions. No private portal profiles are fetched or exposed here.

## Wolf's Discord picture

The public `staff-avatar/wolf` Edge Function returns only Wolf's profile image,
preferring his Cosmic server avatar and falling back to his global Discord
avatar. It uses the existing server-side `DISCORD_BOT_TOKEN` and
`DISCORD_GUILD_ID`; neither credential is exposed to the website. The fixed
allowlist in the function prevents it from looking up arbitrary members.

Successful images are cached for five minutes. Temporary Discord failures can
serve the last successful image for up to six hours; a confirmed departure
clears that cached image. The endpoint does not return usernames, role lists,
or member records. The public display name and title remain owner-maintained.

Deploy `staff-avatar` with JWT verification disabled because its only public
output is the approved profile picture. Other functions and authorization
settings are unchanged. GitHub Pages publishes the frontend; function deployment
is separate. Run `npm test` for the mocked Discord endpoint checks.
