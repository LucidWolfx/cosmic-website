# Private department workspace

Sign in to the portal, select **My departments**, and open LSPD. Membership
comes from the current roles in the Cosmic Discord server, not the website's
applicant/member/staff/admin role.

| Capability | Discord roles required |
| --- | --- |
| Read published LSPD notices and the active employee roster | `1449442096955002982` |
| Edit notices and employees, view drafts, archive and restore | Both `1449442096955002982` and `1449494268329852938` |

Website administrators have no department bypass. Suspended website accounts
are denied. Command membership alone does not grant entry without the LSPD role.

## Using the workspace

- **New notice:** enter a title and plain-text notice. Leave Publish unchecked
  for a command-only draft. Pin important published notices above other updates.
- **Approve & add employee:** approve a department application in the
  portal Staff review view. Enter character name, rank, call sign, and optionally
  division and duty status (in training, active, reserve, or on leave). Staff can edit these details later.
  The reviewer needs their existing review permission plus both department roles.
- The applicant's verified Discord account is linked automatically. Each employee
  displays a Discord profile link, username and stable user ID. Identity cannot
  be reassigned by editing the roster. One employee is allowed per Discord account
  per department. Approval and roster creation succeed or fail together.
- A department application must select a department. Older requests without a
  selected department need to be returned for changes and resubmitted.
- **Archive:** removes an entry from the active list. Command can use Show
  archived entries to restore it. There is no permanent-delete button.
- **Refresh:** reloads current content and rechecks roles. Concurrent edits use
  revision checks so one editor cannot silently overwrite another's saved work.

## Automatic departure handling

The existing one-minute `cosmic-discord-delivery` scheduled job now also checks
roster membership, up to 30 due entries per run with a 45-second work budget.
Successful checks are due again after two minutes. Larger rosters and Discord
rate limits may take longer; this is periodic synchronization, not an instant
Discord gateway event.

A confirmed HTTP 404 with Discord code `10007` (Unknown Member) archives the
entry and marks it **Left the Discord server**. Permission failures, unknown
guilds, outages and rate limits never remove employees. Archives retain the
character details and audit history. Returning members require a new department
approval; stale checks cannot remove a freshly re-approved entry.

This creates roster entries and links identities. Discord role assignment still
uses the server's existing staff process; the bot does not have Manage Roles.

Notices paginate at 20 and roster entries at 50. Titles allow 120 characters;
notice bodies allow 8,000. Use roleplay information rather than real-world
employment or personal details. Notice edits and roster maintenance do not post
Discord messages. Department submissions notify #department-apps and mention
LSPD Command with a website review link; full answers stay on the website.

## Deployment and access enforcement

1. Apply `backend/003_department_hub.sql` and `004_department_enrollment.sql`
   after migrations 001 and 002, followed by `005_department_notifications.sql`.
2. Deploy `department-hub`, `discord-interactions`, and `discord-delivery`.
   The delivery entry point includes `_shared/roster-sync.mjs`. They reuse the existing
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, and
   `DISCORD_GUILD_ID` secrets and review configuration. Never put credentials in public source.
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

General application review permissions and Core Hub access retain their existing
model. Department approval additionally requires command roles to create the
roster entry. Other decisions remain with the existing reviewers. Intake stays closed.

Provider references: [Discord guild membership](https://docs.discord.com/developers/resources/guild#get-guild-member),
[Supabase session verification](https://supabase.com/docs/reference/javascript/auth-getuser).
