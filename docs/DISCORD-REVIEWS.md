# Discord application reviews

Applications saved as drafts stay in Supabase. Submitting creates a delivery
queue entry. Department requests send only an embed notification and command-role
mention to **#department-apps**, with a link to website Staff review. No answers,
attachments, applicant identity, feedback, or decision buttons go to Discord for
these requests. Other application types use the existing private review channel.
A scheduled Edge Function sends their full answers as a text
attachment to the private review channel, with Approve, Deny, and Request
changes buttons. Reviews update the website's application status and feedback.
Approval of a whitelist application grants portal membership only.

Department approvals happen in the website's **Staff review** view. The approval
form collects character name, call sign, rank, optional division, status and
feedback. The reviewer needs website staff/admin access and both department roles.
The verified applicant Discord identity is linked automatically to the roster.
The scheduled delivery service also archives confirmed Discord departures.
See `DEPARTMENT-HUB.md`.

## Cosmic deployment

- GitHub Pages: https://cosmicrp.net/
- Supabase project: `mygpttrerwwexljgdiyq`
- Discord application: `1399288433595252777` (Cosmic Roleplay, the owner's existing app)
- Discord server: `1329107732003029093`
- Review channel: `1449966265195171892` (#website-applications; selected earlier as #pending-staff-app)
- Department notifications: `1449966318072627362` (#department-apps)
- Department notification mention: `1449494268329852938` (LSPD Command)
- Reviewer roles: `1329107732896284713`, `1329107732896284720`

These IDs are configuration, not credentials. Never commit the bot token,
OAuth client secret, service-role key, or worker secret to the repository.

Live setup was verified on 28 September 2026: Discord login, private-channel
delivery, request changes, resubmission, and approval all worked. After switching
to the owner's existing Cosmic Roleplay app, sign-in, delivery, and approval
were verified again using submission 3 of the same fictional support request.
The saved decision and Discord message are synchronized. One clearly
labeled fictional support request remains as test evidence. Whitelist and
member/support-request submissions are open at the owner’s direction on
28 September 2026, following publication of the version 1.0 rulebook.
This includes LSPD department interest for approved members. Existing application
permissions and Discord routing remain in place; reserve and transfer routes
remain closed.

## Setup

1. Apply `backend/001_cosmic_portal.sql`, then `backend/002_discord_reviews.sql`.
   Also apply migrations 003, 004 and `005_department_notifications.sql` in order.
   The first migration must precede the second. Both were tested together
   against PostgreSQL through PGlite, including the original permission suite.
2. Configure Discord OAuth through Supabase Auth. Register the exact Supabase
   callback URL in the Discord application and the exact website callback URL
   in Supabase's redirect allowlist. Put only the public project URL and
   publishable key in `site/assets/config.js`.
3. Install the bot in the configured server. Give it View Channel, Send
   Messages, Embed Links, Attach Files, and Read Message History in the review
   channel. It does not require Administrator, Manage Roles, message-content
   intent, or server-member intent. Keep the channel private: @everyone must
   explicitly deny View Channel. Other server/channel role grants should be
   limited to staff; administrators inherently retain access.
   In #department-apps the bot needs View Channel, Send Messages and Embed Links.
   LSPD Command must be able to view the channel. To ping an unmentionable role,
   Discord requires the bot's channel-scoped Mention @everyone, @here, and All Roles
   permission; the code only permits the specific configured command role.
4. Set Edge Function secrets: `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`,
   `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_REVIEW_CHANNEL_ID`,
   `DISCORD_REVIEWER_ROLE_IDS` (comma-separated). Optional non-secret overrides
   `DISCORD_DEPARTMENT_CHANNEL_ID` and `DISCORD_DEPARTMENT_NOTIFY_ROLE_ID` default
   to the department IDs listed above. Supabase supplies
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_SECRET_KEYS`
   automatically. An optional dedicated `DISCORD_DELIVERY_SECRET` must have
   at least 32 characters if used instead of the built-in scheduler key.
5. Deploy `discord-interactions` and `discord-delivery`. Both use custom
   authentication and have gateway JWT verification disabled in
   `supabase/config.toml`. The interaction endpoint requires Discord's
   Ed25519 signature and a recent timestamp. The delivery endpoint requires
   an exact private project key from `SUPABASE_SECRET_KEYS` in the `apikey`
   header, or the optional private worker bearer secret. A publishable key
   cannot call it.
6. Set Discord's Interactions Endpoint URL to
   `https://mygpttrerwwexljgdiyq.supabase.co/functions/v1/discord-interactions`.
   Discord must accept the signed validation ping before saving.
7. Schedule the delivery endpoint every minute using Supabase Cron and
   `pg_net`. Choose the Edge Function and Add header options > Add secret key
   in the dashboard. Switch to SQL Snippet and use `timeout_milliseconds:=120000`
   (the simple form limits this to 5000ms). The job stays inside the private
   Supabase database. If using a dedicated bearer secret instead, store it in
   Vault. Never put credentials into a publicly shared snippet or source file.
   Each invocation processes
   up to five queue items; use queue age to decide if frequency needs adjusting.
8. Complete a live sign-in, submit, request-changes, resubmit, and approval
   check before opening intake. Approve the rulebook and publish owner/contact
   and retention details before collecting real applications.

## Review behavior

The website's **Staff review** navigation item appears for portal accounts with
the `staff` or `admin` role in `cosmic_access`. Discord reviewer roles authorize
the Discord buttons independently; they do not automatically promote a website
account. A new sign-in starts as `applicant`. The owner verifies the linked
Discord identity before assigning access using `backend/owner-operations.sql`.
Reload the portal after a role change to load the staff navigation and queue.

- Only the configured server, channel, and reviewer roles are accepted.
- Current Discord role membership is checked again before saving a decision.
- Applicant identity comes from Supabase's verified Discord identity, not
  editable profile metadata. Self-review and suspended reviewers are rejected.
- Deny and Request changes require feedback, visible to the applicant.
- All decisions open a confirmation form. Duplicate Discord submissions are
  idempotent; old buttons cannot decide a resubmitted application.
- Closed applications have their buttons removed on the next delivery pass.
- Department submission revisions notify once after successful delivery; ordinary
  status changes do not re-ping. Withdrawn/decided requests are skipped if their
  notification has not yet gone out. Resubmission creates a new notification.
  Stable per-submission nonces prevent duplicate immediate retry messages within
  Discord's nonce deduplication window. Delivery uses leases and records the
  notified revision; a prolonged outage after sending but before recording may
  still require checking for a duplicate.
- No supplied text can trigger Discord mentions. Email addresses are not
  included in review messages. Only non-department answers are attached.
  Legacy department approval buttons redirect to the website; other legacy
  department decisions are rejected by the database.
- An unavailable Discord service does not lose the saved application.
  Leases, version checks, retry delays, and rate-limit handling preserve work.
- The bot uses HTTP interactions; it does not require a continuously running
  gateway connection. Discord may show it as offline while buttons work.

## Operations and privacy

Inspect `cosmic_discord_reviews` from the authorized Supabase dashboard for
`attempts`, `next_attempt_at`, and `last_error`. A row with
`version > delivered_version` still needs delivery. Check function logs for
generic configuration or network failures; secrets and raw applicant answers
are not logged by the handlers.

Do not manually change the stored canonical Discord message IDs to bypass a
failed decision. Fix bot permissions/configuration and retry. A deleted review
message is recreated by a later queued update. Rotate a compromised token in
Discord, then update only the server-side secret.

Discord attachments are an additional copy of application data. Database
deletion does not remove Discord messages/attachments. The owner must define
retention and remove the Discord copy as part of a valid deletion workflow.
Withdrawing changes the review status but does not erase prior records.

## Verification

Run `npm ci --ignore-scripts` and `npm test`. Tests exercise signed and forged
requests, role checks, self-review, stale decisions, retry behavior, private
channel checks, full answer attachments, and PostgreSQL permissions. These
tests do not replace a live OAuth and Discord integration check.

Provider reference: [Discord allowed mentions](https://docs.discord.com/developers/resources/message#allowed-mentions-object).

A privileged operator can mark an outbox row `notification_test=true` to send a
clearly labeled fictional setup alert through the same route. Browser clients
cannot write this flag, and answer fields do not control it. Never open intake
for a setup check; close the fictional request after confirming delivery.
