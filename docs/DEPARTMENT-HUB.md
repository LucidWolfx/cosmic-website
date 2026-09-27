# Private department workspace

Sign in to the portal, select **My departments**, and open LSPD. Membership
comes from the current roles in the Cosmic Discord server, not the website's
applicant/member/staff/admin role.

| Capability | Discord roles required |
| --- | --- |
| Read published LSPD notices and the active employee roster | `1449442096955002982` |
| Create/edit notices and employees, view drafts, archive and restore | Both `1449442096955002982` and `1449494268329852938` |

Website administrators have no department bypass. Suspended website accounts
are denied. Command membership alone does not grant entry without the LSPD role.

## Using the workspace

- **New notice:** enter a title and plain-text notice. Leave Publish unchecked
  for a command-only draft. Pin important published notices above other updates.
- **Add employee:** enter a character name, rank, call sign, division, and status
  (active, in training, reserve, or on leave). The roster is maintained manually;
  it does not import all Discord members or change Discord ranks.
- **Archive:** removes an entry from the active list. Command can use Show
  archived entries to restore it. There is no permanent-delete button.
- **Refresh:** reloads current content and rechecks roles. Concurrent edits use
  revision checks so one editor cannot silently overwrite another's saved work.

Notices paginate at 20 and roster entries at 50. Titles allow 120 characters;
notice bodies allow 8,000. Use roleplay information rather than real-world
employment or personal details. This feature sends no Discord messages.

## Deployment and access enforcement

1. Apply `backend/003_department_hub.sql` after migrations 001 and 002.
2. Deploy `supabase/functions/department-hub`. It reuses the existing
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, and
   `DISCORD_GUILD_ID` secrets. Never put these credentials in public source.
3. Use the function configuration in `supabase/config.toml`. Gateway JWT
   verification is disabled because the handler verifies the bearer session
   with Supabase Auth on every request before reading private data.
4. Publish the website with `python tools/build.py` and the Pages workflow.

The handler obtains the Discord ID from the verified `auth.identities` record,
fetches current guild membership with the bot, and passes those roles to a
service-only database function. Browser-supplied roles or Discord IDs are never
trusted. Direct table access and function execution are denied to anonymous and
authenticated browser clients. Every read and edit rechecks the roles; Discord
errors fail closed. Responses use `Cache-Control: no-store`.

The visible workspace also rechecks access every minute while the tab is active.
Role removal blocks subsequent requests; previously viewed data cannot be
retracted from a recipient. Private entries never ship in static HTML, search
indexes, or the design preview. Notices and roster fields render as escaped text.
Every successful mutation records the actor and before/after values in the
private audit table. Website suspension and department enabled status are also
checked inside the database transaction.

`npm test` covers the HTTP authorization flow and PostgreSQL permissions,
draft visibility, role removal, editing, revisions, archive/restore, and audit.

Application reviews and general Core Hub resources retain their existing access
model; the new department roles do not change those permissions or open intake.

Provider references: [Discord guild membership](https://docs.discord.com/developers/resources/guild#get-guild-member),
[Supabase session verification](https://supabase.com/docs/reference/javascript/auth-getuser).
