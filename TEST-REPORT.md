# Cosmic v3 verification report

## Continuous banner and compact spacing - 28 September 2026

- Removed the pause button and hover pause at the owner's request. Both rows
  continue moving when the pointer is over the banner.
- The bottom row uses fixed 24 px gaps around its separators instead of
  distributing excess screen width between phrases. Extra phrase copies fill
  wide screens; equal groups retain a continuous loop and resize with the page.
- Repeated phrases remain hidden from assistive technology. Reduced-motion
  preferences still show static original text without duplicate phrases.
- Build/static checks passed for 31 pages; JavaScript and Python syntax passed.
  CUA verified a hovered banner with both animations running, no pause control,
  24 px spacing, equal loop widths, and no overflow at 2560, 390 and 320 px.
- Updated existing legacy UI expectations; that browser suite was not executed.
  The corrected hero image framing and private systems are unchanged.

## Homepage artwork scaling - 28 September 2026

- The hero image now uses contain sizing at its original proportions with no
  oversized width or negative horizontal offset. The full composition fits
  inside the banner instead of cropping characters' heads on wide screens.
- The hero layout is centered and capped at 1680 px to keep its text and artwork
  together on wide displays. The scrolling strip retains its full width.
- Browser previews at 2560, 1440, 390 and 320 px confirmed contain sizing and no
  horizontal overflow. Desktop and phone screenshots showed all three heads.
- Build/static validation passed for 31 pages. Existing artwork bytes, links,
  scrolling behavior, and private systems are unchanged.

## Homepage opposing text rows - 28 September 2026

- Replaced the three hero scene selectors with a full-width black text strip:
  bold uppercase text moves left, and smaller community text moves right.
  Crimson separators and edge fades follow the supplied visual reference.
- The hero keeps its original artwork, copy, and application link. New styling
  loads on the homepage only; private systems and other page layouts are unchanged.
- Matching repeated groups create continuous loops. Repeated text is hidden
  from assistive technology. A keyboard/touch pause control stops both rows,
  hover pauses the text, and reduced motion displays a static wrapped layout.
- Build/static validation passed for 31 pages; JavaScript syntax passed.
  CUA browser checks verified both animation names, equal loop-group widths,
  pause/resume, desktop appearance, and no horizontal overflow at 390 and 320 px.
- Temporary previews of the reduced-motion rules and script-free markup at
  320 px showed all labels without clipping. The OS motion preference was not changed.
- Updated the legacy UI suite's scene-selector assertions for the new strip;
  Python syntax passed. That legacy browser suite was not executed in this run.

## Staff card badge and order refinement - 28 September 2026

- Cards omit the role already named by their section. Only additional staff
  roles and approved extra labels appear as badges; empty badge rows are hidden.
- Wolf is pinned first within Owners using his verified Discord identity.
  His public name and Lead Developer badge are retained. Other owners keep
  their existing relative order.
- Build/static validation passed for 31 pages and JavaScript syntax passed.
  The existing directory rendering expectation was updated for extra roles only.
  Discord synchronization and access permissions are unchanged.

## Automatic Discord staff directory - 28 September 2026

- Five approved Discord roles populate Owners, Cosmic Management,
  Administrators, Moderators and Trial Staff. Each person appears once under
  their highest role, with badges for other matching staff roles.
- Wolf retains his public name and Lead Developer badge. Server avatars take
  precedence over global/default avatars. Bots and pending members are excluded.
- Deployed and anonymously verified the dedicated staff-directory function:
  HTTP 200, five-minute cache, six staff profiles with the expected role grouping.
  The public projection contains only approved display fields; private portal
  records and unrelated Discord roles are not returned.
- All 93 automated tests passed, including 16 directory backend checks and 11
  client contract/mount checks for duplicates, role ordering, unsafe input,
  role changes, departures, expiry, outages, retry limits and avatar fallback.
  No real member's roles were changed to perform these tests.
- Build/static validation passed for 31 pages. Browser checks using the live
  response verified six loaded Discord pictures, highest-role counts, secondary
  badges, empty sections, and no horizontal overflow at desktop, 390 and 320 px.
- Visible pages refresh about every five minutes. Failed refreshes remove
  expired cards and show unavailable counts instead of retaining a stale roster.
- Existing sign-in, application intake, department permissions and private
  records are unchanged. This update adds no new dependencies.

## Community role panels - 28 September 2026

- Combined the supplied role-panel grid reference with compact individual cards:
  hexagonal Discord pictures, names, role badges, bios, and actual support links.
- Ownership and Development each list Wolf with the appropriate confirmed title.
  Each panel counts its published members; both cards refer to one unique person.
  Additional staff remain unpublished rather than borrowing reference-site names.
- Build/static validation passed for 31 pages. Browser checks covered live avatar
  loading, counts, role jump links, support destinations, and layout at 1440,
  1024, 390 and 320 pixels without horizontal overflow.
- Existing avatar code, authentication, department access, intake configuration,
  and private records are unchanged. This update adds no new dependencies.

## Wolf's Discord profile picture - 28 September 2026

- The public leadership card displays Wolf's Cosmic server avatar, falling back
  to his global Discord avatar. Name and title remain Wolf / Owner & Lead Developer.
- Deployed the dedicated staff-avatar function and verified anonymous image/png
  delivery (HTTP 200, five-minute cache) using the existing bot configuration.
- All 66 backend tests passed, including 12 new avatar checks for fixed identity,
  image validation, credential isolation, caching, rate limits and departure.
- Build/static checks passed for 31 pages. Browser checks verified the live image,
  unavailable-image fallback, and no horizontal overflow at desktop, 390 and 320 px.
  The displayed photo is 200 px on desktop and 130 px on phones.
- Only the owner-approved profile picture is public. No private profiles, role
  lists, application records, credentials, or messages are exposed by this endpoint.

## Community team page - 28 September 2026

- Replaced the events/creator overview with public leadership and staff profiles,
  support links, application tracking, and a link to LSPD command information.
- The owner profile now uses the requested public name Wolf and title Owner &
  Lead Developer. Other staff names remain unpublished until provided. Public directory data is separate from
  the authenticated portal and private department roster.
- Build/static validation passed for 31 pages. Browser checks confirmed section
  links, the owner card, contact destinations, and no horizontal overflow at
  320, 390, 800, and 1440 pixels. The mascot and mobile menu remain in the shared theme.
- This is a public content/layout update. No authentication, intake, application,
  department permissions or live records were changed.

## Mascot / After Dark rollout - 28 September 2026

- Applied the approved mascot, true black, crimson controls, and green open-intake
  indicator to the homepage, public pages, login, portal and staff tools.
- Local build/static validation passed for all 31 HTML pages. JavaScript syntax
  checks passed, and all 54 existing Discord/department tests passed.
- Browser verification covered desktop homepage scenes and links, site search,
  rule filtering, LSPD, login, and member/staff preview screens.
- At 320 px, homepage, rules, department directory, LSPD, login, join, setup and
  portal preview had no horizontal document overflow or broken eager images.
  The 390 px homepage and menu were visually checked; the staff review form and
  fictional department roster/editing controls fit at 320 px.
- Existing department controls were checked through a local fixture with fictional
  records. No real application was submitted, no review decision was recorded,
  and no Discord message or permission change was made for this visual release.
- Updated the offline browser helper and visual expectations to match the new
  theme and versioned asset URLs. Python syntax passed; that legacy automated
  browser suite was not executed in this run. Earlier assertion counts below are
  historical, not a count of the current browser verification.
- These are selected browser checks, not a complete accessibility/device audit.
  Backend configuration, credentials, rules content and role mappings are unchanged.

## Black portal theme - 28 September 2026

- Changed portal and design preview to neutral black/charcoal surfaces, white text,
  silver controls, and restrained colored approval/warning/error indicators.
- Covered shared forms, notices, helper text, dialogs, department tabs and roster
  styles; public website colors and all JavaScript/backend behavior are unchanged.
- Browser checks confirmed desktop dashboard appearance, application table status
  readability, mobile navigation at 390 px, and form fit at 320 px without overflow.
- Main text contrast is 18.37:1; muted panel text 8.69:1; dim text on the lighter
  panel 5.48:1; primary button text 16.13:1. Input borders are 3.16:1 against fields.
  These sampled checks are not a complete accessibility audit.
- Build and static validation passed for all 31 HTML files. Existing backend tests
  remain in the GitHub publishing workflow; no new behavior tests were added for
  this color-only change.

## Portal dashboard layout - 28 September 2026

- Adopted the approved sidebar/dashboard layout while retaining the current
  Supabase authentication, application records, Discord notifications and role checks.
  No third-party administration panel or replacement backend was installed.
- Added role-aware overview cards, searchable application/review tables, and
  department notice/employee tabs with a searchable roster.
- All 54 backend checks passed. Static validation passed for 31 HTML pages.
  Updated JavaScript syntax checks passed.
- Browser checks covered applicant/member/staff previews, role-denied review access,
  application search and combined status filters, empty results, dashboard review
  shortcuts, department approval fields, and returning to the queue on the same route.
- Fixed a review form name collision discovered during browser testing, and kept
  the review route consistent when entering from a dashboard shortcut.
- A local-only fixture loaded the actual department module with fictional records.
  Verified roster search, Discord identity display, editor persistence between tabs,
  saving employee edits, removal of command actions after role loss, and clearing
  private content after a role verification failure. Fixture files are not published.
- Desktop and 390/320 px portal layouts were checked; the department workspace also
  fit at 320 px without horizontal overflow. This is browser viewport testing, not
  a physical-device or full accessibility audit.
- No live application decisions, Discord messages, permission changes, credentials
  or database migrations were made for this presentation update. Applications stay open.

## Application intake opened - 28 September 2026

- The owner authorized opening applications after publication of rules v1.0.
- The live database returned `whitelist_open=true`, `requests_open=true`,
  `rules_approved=true` and `rules_version=cosmic-rules-1.0-2026-09-28`.
  The guarded owner operation changes only the two intake switches.
- The signed-in live portal displayed "Intake is open" on the LSPD department
  request form with an enabled Submit for review button and the Discord
  notification explanation. No test application was submitted in this check.
- Existing sign-in, membership, rules acknowledgement, reviewer and department
  role requirements remain in force. This does not assign roles or FiveM access.
- Prior closed-intake verification below is historical; this opening supersedes it.

## Community rules version 1.0 - 28 September 2026

- The owner confirmed 18+ and story-focused serious RP. The 25-section rulebook
  is original Cosmic policy, with numeric limits identified as Cosmic defaults.
- The website, downloadable text and Markdown copy are generated from one
  source. The portal acknowledgement includes minimum age and current rules.
- All 54 automated backend checks pass. Static checks pass for 31 HTML pages;
  JavaScript syntax checks pass for the new rule controls and portal update.
- Local browser checks verified NLR search, category filtering, combined empty
  results, expand/collapse, and direct links that reveal the requested section.
  Desktop and 390/320 px layouts were inspected without horizontal overflow.
- A separate content review found no publication blockers. The publication SQL
  aborts if intake is open and updates only rule approval and version.
- Opening applications remains a separate owner decision. No Discord
  announcement or new application was sent as part of this rules update.
- These checks do not constitute a full accessibility or physical-device audit.

## Department notification routing - 28 September 2026

- All 54 automated checks pass. Department requests use the specified channel
  and role mention, contain no answers or review buttons, and link to Staff review.
- PostgreSQL tests verify service-only access, revision tracking, stale leases,
  status updates, resubmissions, and rejection of legacy Discord department decisions.
- Static checks pass for 31 HTML pages. The migration and delivery/interaction
  updates have been deployed. Both intake settings were verified closed.
- Channel access for Cosmic Server#2118 and LSPD Command was approved by the
  owner. Bot sending, embed and role-mention permissions are scoped to #department-apps.
- The live scheduled worker sent exactly one labeled setup alert to
  #department-apps, mentioning LSPD Command with one embed and a Staff review
  link. Message ID: `1554025123164463166`. No answers, attachments or decision
  buttons were included. The fictional request is retained as test evidence.
- Permission and delivery verification does not confirm every recipient's push
  notification preferences. Website staff/admin access is still required for review.

## Department enrollment and Discord departures - 28 September 2026

- All 48 automated checks pass, including signed Discord approval modals,
  verified applicant identity, command permissions, atomic roster creation,
  duplicate prevention, stale decisions, immutable identity links, and departure
  archiving. Permission failures, outages and rate limits never remove employees.
- Migration 004 and all three Edge Function updates deployed successfully.
- A live database transaction verified linked approval, departure archival and
  audit history, then rolled back every fictional record. This simulated service
  inputs at the database boundary; no real Discord departure was staged.
- The existing scheduled worker returned HTTP 200 with zero roster errors at
  00:06, 00:07 and 00:08 UTC. The live roster is empty, so these were idle checks.
- Local browser checks verified approval field collection, conditional required
  fields, non-approval submission, and 390/320 px layouts without overflow.
- End-to-end approval from a real Discord reviewer still awaits an account with
  the configured review and department command roles and a submitted application.
  Intake remains closed, and this update did not change any Discord roles.
- Departures are periodically detected, not instantaneous. Confirmed departures
  leave a private archived record; rejoining requires a new approval. Open
  department pages refresh content every minute when no edit form is open.

## Internal LSPD workspace - 28 September 2026

- All 35 automated checks pass: 20 existing Discord/application checks and 15
  department checks, including database permissions and the HTTP handler.
- Department checks cover direct-access denial, verified identity, live role
  checks, missing/pending membership, Discord outages, viewer/editor separation,
  draft privacy, scoped records, stale edits, validation, archive/restore,
  audit records, suspension, and role removal.
- JavaScript syntax checks and static validation pass for 31 HTML pages.
- Migration 003 was applied successfully and the department-hub service deployed
  to the Cosmic Roleplay Supabase project. GitHub Pages build and deployment passed.
- The live API rejects unauthenticated requests with HTTP 401. The signed-in
  owner account correctly receives an empty department list without its required
  Discord role, despite being a website admin. No browser errors were observed.
- Fictional local UI checks exercised command and member layouts, notice and
  roster editors, and hiding command controls and drafts in the member preview.
  Desktop and phone visuals were reviewed; 390/320 px layouts had no horizontal
  overflow. These fixtures do not substitute for a live authorized write test.
- Live notices/roster writes await an account with both supplied Discord roles.
  No live test notices or roster entries were created. The role assignment
  question is pending; no Discord roles have been changed for this feature.
- Portal asset URLs use content hashes to prevent old cached scripts hiding the
  new department navigation after publication.
- Website admin does not bypass LSPD membership. Applications remain closed.

## Owner-supplied LSPD screenshot — 28 September 2026

The owner-supplied LSPD SUV screenshot replaces the generated concept in both
the department banner and media panel. The full image remains visible in the
media panel; responsive banner framing keeps the vehicle visible. Desktop
(1440 px) and phone (390 px) layouts were visually reviewed, and 390/320 px
checks found no horizontal overflow. The original 1919 × 1079 content is
preserved in a 239 KB WebP; no retouching was applied. The concept-art label
was removed. Intake and account access were not changed.

## LSPD department page — 28 September 2026

- Added the dedicated LSPD page, Departments directory link, and search entry.
- Static validation passes for 31 HTML pages. All nine local section/skip links
  resolve; the search data passes JavaScript syntax validation.
- Live local-browser checks passed at 1440, 1024, 390, and 320 pixel widths with
  no horizontal overflow. Desktop and phone screenshots were visually reviewed.
- Directory navigation, LSPD search, section links, and the rank disclosure work.
- The banner loads correctly and the checked page produced no browser warnings
  or errors. The 190 KB WebP is labeled as concept artwork, not server photography.
- Recruit, reserve, and transfer recruitment remain visibly closed. No intake,
  account permission, authentication, or backend application behavior was changed.
- Command appointments remain unfilled, and divisions and ranks are explicitly
  proposed pending the owner's confirmed structure.

## GitHub and Discord integration update — 28 September 2026

The public site is deployed at https://lucidwolfx.github.io/cosmic-website/ in
the separate `LucidWolfx/cosmic-website` repository. The earlier local-only
report below describes the supplied ZIP and is retained as historical evidence.

- All 20 Discord handler and PostgreSQL lifecycle/permission checks pass.
- Both database migrations ran successfully in the Cosmic Roleplay Supabase project.
- Discord accepted the deployed interaction endpoint's signed validation ping.
- Both Edge Functions are deployed; automatic delivery is scheduled every minute.
- Discord OAuth is enabled and the exact GitHub Pages callback is allowlisted.
- Public files pass the 30-page static validator and JavaScript syntax checks.
- Live Discord sign-in succeeded and loaded the signed-in applicant portal.
- One clearly labeled fictional support application reached the private Discord
  review channel with its full-answer attachment and review buttons.
- Request changes, resubmission, and approval succeeded on that same test record.
  Feedback persisted, the same message updated, and approval removed its buttons.
- The delivery worker's final message formatting was verified in Discord.
- The website now uses the owner's existing Cosmic Roleplay Discord application
  (`1399288433595252777`) for sign-in and reviews. Sign-in succeeded after the
  switch; submission 3 of the same fictional fixture was delivered and approved
  through that app. The database and Discord both show Approved, the review
  buttons are removed, and delivery version 7 is fully synchronized without an
  outstanding delivery error.
- Submissions remain closed by explicit owner choice while the rules are reviewed.
  Both whitelist and member-request intake are disabled; rules remain draft.

### Current verification limits

The live test used a synthetic database fixture with no real applicant data;
it did not open intake or submit through an open public form. The synthetic
record remains as setup audit evidence. Denial, authorization failures, stale
buttons, retries, and whitelist-to-portal membership promotion are covered by
automated tests rather than additional live applications. Approval does not
assign Discord roles or grant FiveM admission. No physical-device, independent
security, or full accessibility audit is claimed.

## Original supplied-package verification

Build: 27 September 2026. Provisional rebrand, not a live deployment.

## Completed

- Static validation passed for all 30 HTML documents, including all twelve public
  sections and account/portal routes. Local file references and unique IDs passed.
- Every public JavaScript file passed `node --check`.
- 283 of 283 automated UI/layout assertions passed. All 30 HTML files were
  exercised at 1440, 1024, 390, and 320 pixels. No horizontal overflow or broken
  test-fixture images was detected at those widths.
- No JavaScript runtime errors were recorded in the UI suite.
- Public navigation, search, mobile menu, guide filters, rule filters, unknown
  destinations, unavailable live login, unavailable/stale status, and fictional
  applicant/member/staff interfaces were checked.
- Brand checks covered the supplied reference, standalone logo and cover override,
  text fallback, public configuration export, six provisional department concepts,
  and rejection of unsafe URL examples.
- Five local HTTP smoke checks returned 200 with correct content types and exact
  source-file bytes: home, portal preview, brand CSS, reference image, and app JS.
- The supplied reference JPG is byte-identical to the user's upload. Auth JS and
  all three backend SQL files are byte-identical to the supplied v2 package.

## Test method and limits

The browser environment blocked URL navigation. Browser tests therefore used
in-memory HTML with exact local assets inlined. A test-only fixture mapped dynamic
local image requests to equivalent data URLs. CSP was removed from that test
markup to allow inlining. Production files were not relaxed for these tests.
Local HTTP delivery was checked independently using Python.

These results validate local rendering and UI behavior, not real hosting, a
complete accessibility audit, a security audit, or performance on physical phones.
No live Discord OAuth, CDN loading, production CSP, database migration, database
row-level security, account recovery, staff decision persistence, or FiveM/Discord
role integration was exercised. Those require staging setup and explicit testing.

## GitHub and service state

The older LucidWolfx/Cosmic-fbi repository was inspected only. No repository,
branch, file, account role, or deployed site was modified. This ZIP is a local
handoff, not a pushed commit or a live website.

Real accounts and server monitoring remain unconfigured. Fictional preview roles
are not authentication. Website approval is not automatic FiveM whitelisting.

## Reproduce

Run `python tools/check_site.py` for static checks. Run `python tests/test_ui.py`
with Python, Playwright, BeautifulSoup4, and Chromium installed for fixture-based
UI checks. Set CHROMIUM_PATH when the executable cannot be auto-discovered.
See `tests/ui-results.json` and `tests/http-smoke-results.json` for observed results.
See `backend/test_permissions.sql` for the separate, unexecuted staging DB tests.
