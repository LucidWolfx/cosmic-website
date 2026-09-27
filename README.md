# Cosmic: public website + member portal

The third visual revision of the Cosmic public website and member portal.
It uses provisional charcoal, silver, ice-blue accents, and city imagery from
the supplied brand concept board. The visible name remains **Cosmic**.

The brand is not final. The project now has its own repository at
https://github.com/LucidWolfx/cosmic-website. Read `docs/BRAND-DIRECTION.md`
for replacing the artwork and `docs/GITHUB-HANDOFF.md` for publishing details.

## Included

The public website covers **Home, About, Community, Join, Rules, Core Hub,
Departments, Businesses, Organizations, Media, News, and Status**. It also has
public guides, editorial previews, login, an OAuth callback, privacy information,
a member portal, and a separate fictional design preview.

The LSPD directory entry opens a dedicated department page with mission and
expectations, a joining pathway, closed recruitment indicators, proposed units
and command structure, and the owner's LSPD screenshot. See `docs/LSPD-PAGE.md` for editing
the content and replacing the artwork with approved server media.

The portal source implements Discord sign-in, private account profiles, saved
application drafts, submission, withdrawal, progress history, applicant-visible
feedback, protected member/staff resources, requests, and a staff review queue.
The **My departments** area includes private LSPD notices and an employee roster,
with live Discord membership checks and separate command editing permissions.
See `docs/DEPARTMENT-HUB.md` for the role mapping and publishing instructions.
A Supabase SQL migration supplies tables, authorization policies, and checked
write operations. Website whitelist approval grants portal membership, not
automatic FiveM admission or Discord roles.

Discord review integration is implemented in `supabase/functions/` and
`backend/002_discord_reviews.sql`. Submitted applications are queued for a
private review channel with Approve, Deny, and Request changes buttons.
Decisions update the same application records used by the portal. See
`docs/DISCORD-REVIEWS.md` for configuration, tests, and operation.

The live website is https://lucidwolfx.github.io/cosmic-website/. Discord sign-in
and private reviews are configured and verified. The review channel is currently
named **#website-applications**. Submissions remain closed at the owner's request
while the draft rules are reviewed. Read `TEST-REPORT.md` for verified behavior
and remaining test limits. Public pages and fictional previews also work without
a backend when using a separate copy of this project.

## Preview

Open `site/index.html` or run:

```sh
python -m http.server 8080 --directory site
```

Open `site/portal-preview.html` for applicant, member, and staff layouts using
fictional data. It does not authenticate, save records, or grant permissions.
For real authentication use HTTP localhost during development or HTTPS hosting.
Do not use `file://` for OAuth.

## Project layout

```text
site/                       Publish only this folder
  assets/config.js          Public branding, links, authentication configuration
  assets/content.js         Approved public directory and media entries
  assets/styles.css         Responsive layout and component foundations
  assets/brand.css          Isolated v3 brand layer
  assets/cosmic-brand-reference.jpg  Untouched provisional reference board
  assets/auth.js            Discord OAuth and session handling
  assets/portal.js           Member and staff portal application
  assets/preview.js          Fictional preview data, not an auth mechanism
  setup.html                Public configuration file generator, not an admin tool
backend/001_cosmic_portal.sql  Database migration
backend/test_permissions.sql  Staging permission test script
backend/owner-operations.sql  Reviewed owner-side operations and examples
.github/workflows/pages.yml  Publish site/ through GitHub Pages
tools/                      Build and validation helpers
```

## Editing

Use `site/setup.html` to generate a replacement `site/assets/config.js`. The
editor cannot change database roles or intake settings. Its key field accepts
only public `sb_publishable_...` keys. Secret credentials belong exclusively in
hosted service dashboards, never in this file or a GitHub repository.

Logo, tagline, accent, and cover artwork can be replaced independently of the
page structure. The reference-board logo and imagery are temporary, not finalized
brand deliverables. Standalone logo and cover paths take priority over the board.
Clear the reference-sheet path to remove board-derived imagery. The favicon is
also temporary. Check color contrast again after changing accents.

Edit approved businesses, organizations, and media in `site/assets/content.js`.
Edit public page copy in `tools/build.py`, then run `python tools/build.py` to
regenerate public HTML. The build preserves your configuration and content file.
Auth, portal, setup, and CSS source files are maintained separately. Do not place
private resources in public source. Private resource publishing currently uses
the Supabase dashboard or SQL, not a visual content-management system.

## Intentional boundaries

- No invented active businesses, organizations, player counts, or launch dates.
- Current rules and news copy are visibly marked as drafts.
- Core Hub is provisionally treated as a guides and resources area.
- Roles are applicant, member, staff, and admin, plus account suspension. All
  authorized staff share the review queue. LSPD notices and roster use separate
  Discord department and command roles. An owner management dashboard is not included.
- No direct evidence/media uploads, automatic deletion, payments, applicant notifications,
  automatic Discord role assignment, or FiveM whitelist bridge. Department
  access does check current Discord roles on every request.
- The portal shows up to the latest 200 personal applications and 200 published
  resources. Profile export paginates through all personal applications. The
  staff queue has 20-record pagination.
- A saved draft is not a submitted application. Decisions are database checked;
  no browser setting can open intake or promote a member.

See `docs/LAUNCH.md`, `docs/SECURITY.md`, and `docs/ACCESS-MODEL.md` before launch.
