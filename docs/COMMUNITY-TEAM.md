# Community team directory

The Community page introduces the public leadership and staff team.
Edit `site/assets/team.json`, then run `python tools/build.py`.

Each member has a public `name`, `role`, and `group` (`leadership` or `staff`).
Optional fields are `initials`, `handle` (public Discord username), and `bio`.
Array order controls display order within each group.

Only publish confirmed names and titles. An empty group shows a short directory
update message; it does not create fictional staff or imply a vacant position.
The initial leadership entry uses the owner's confirmed Discord display name.

This public directory is separate from website authorization and private
department rosters. Editing it does not grant portal access, Discord roles, or
department permissions. No private user profiles are fetched or exposed here.
