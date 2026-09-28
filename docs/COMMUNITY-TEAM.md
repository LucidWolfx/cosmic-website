# Community team directory

The Community page introduces the public leadership and staff team.
Edit `site/assets/team.json`, then run `python tools/build.py`.

Each member has a public `name`, `role`, and `group` (`leadership` or `staff`).
Optional fields are `initials`, `handle` (public Discord username), and `bio`.
Featured profiles also support `avatarUrl`, an HTTPS image URL. The picture
replaces the initials only after it loads successfully; unavailable images
keep the styled initials fallback.
Set `featured` to `true` for a full-width leadership profile. Optional `focus`
labels describe that person's confirmed responsibilities.
Array order controls display order within each group.

Only publish confirmed names and titles. An empty group shows a short directory
update message; it does not create fictional staff or imply a vacant position.
The owner is listed publicly as **Wolf — Owner & Lead Developer**, as requested.
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
