# Cosmic v3 verification report

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
