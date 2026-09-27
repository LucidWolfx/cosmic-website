# Launch checklist

## 1. Agree on the content and access model

The public navigation matches the requested twelve sections. Core Hub currently
means public guides plus protected member/staff resources. Confirm that meaning.
Approve the rulebook, application questions, any eligibility criteria, reviewer
permissions, retention policy, and operator/contact information. Current copy is
not an adopted policy. Never announce that intake is open from this template alone.

## 2. Publish the static front end

Keep the code in GitHub. The included Pages workflow uploads only `site/`.
Create a repository, upload the package contents including `.github`, and set
Settings > Pages > Source to GitHub Actions. The workflow expects a `main` branch.
Alternatively publish `site/` through another suitable HTTPS static host.
No Node build step is required for the public site.

A repository site such as `/cosmic/` is supported because asset and page links are
relative. Do not remove the repository path from OAuth redirect URLs.

Remove `site/portal-preview.html` and `site/assets/preview.js` for production, and
set `enableDesignPreview: false`. The validator allows these files to be removed.
`site/setup.html` is only a public configuration helper. It can also be removed
from production; it is not an authenticated admin panel.

GitHub stores source code and Pages hosts static front-end files. Supabase
provides the separate authentication/database backend. Do not publish passwords,
payment collection flows, private documents, or service credentials in Pages.

## 3. Configure Supabase in staging

Create a staging Supabase project and run `backend/001_cosmic_portal.sql` once in
the SQL editor. The migration uses prefixed `cosmic_` names, enables RLS, revokes
browser table writes, and grants only checked RPC operations. Run the supplied
permission tests in that staging project and inspect all results.

Expose the public schema to the Data API as appropriate for your project. Do not
expose auth.users. Do not disable row-level security to fix an error. Anonymous
sign-in and other unneeded providers should remain disabled.

Copy the project URL and the new-format publishable key into
`site/assets/config.js`. Only `sb_publishable_...` keys are accepted by this
front end. No secret or legacy service_role key belongs in the browser.

## 4. Configure Discord OAuth

Create a Discord application in the Discord developer dashboard. Use the exact
callback URL supplied by Supabase, normally:

    https://YOUR_PROJECT.supabase.co/auth/v1/callback

Enter the Discord client ID and client secret in Supabase's Discord provider
settings, not in the website. Enable that provider. The website uses identify
and email scopes only, not bot or server-administration permissions.

Set the Supabase Site URL and exact redirect allowlist entries, including:

    https://YOUR_ACCOUNT.github.io/YOUR_REPOSITORY/auth-callback.html
    http://localhost:8080/auth-callback.html

Use your own final domain when applicable. These website callback URLs are not
the same as the Discord application's Supabase callback URL. Avoid wildcard
production redirects. PKCE exchanges are completed by `auth-callback.html`.

Check sign-in, returning sessions, sign-out, canceled authorization, and expired
sessions with real staging accounts. The SDK is loaded from an exact pinned
jsDelivr version only when an auth backend is configured. Review and update that
pin periodically. This package could not fetch or execute the live SDK in its
restricted test environment.

## 5. Bootstrap reviewers

Sign in with the future owner's account once. It starts as an applicant. Find
its verified Supabase user UUID. Review `backend/owner-operations.sql` and grant
admin only to that verified account from the privileged SQL dashboard.

Never derive a staff role from a display name, browser flag, or user-editable
Discord metadata. Do not let staff approve their own applications.

## 6. Connect approved resources and destinations

Add real Discord/support links and approved business/organization/media entries.
Publish protected resource text through `cosmic_resources`. The SQL examples
show member and staff audience tiers. Raw HTML is not rendered from resource
text. External documents need their own access controls and are not protected
merely by placing a link in the portal.

A status endpoint must use HTTPS, allow your site's origin with CORS, and return:

```json
{"online":true,"players":12,"maxPlayers":48,"updatedAt":"2026-09-27T19:00:00Z"}
```

These numbers are an example contract, not actual Cosmic status. Supply a fresh
UTC timestamp from your monitor. Stale, invalid, missing, or failed results
become `Status unavailable`, not a guessed online count. Do not expose player
identifiers, admin APIs, or credentials.

## 7. Open intake only after verification

Complete the tests in `TEST-REPORT.md` and `backend/test_permissions.sql`, approve
and publish the final rules, update their version, and deliberately enable
whitelist intake in `cosmic_settings`. Requests have a separate intake switch.
The browser cannot enable either one. Both are initially closed.

Test real applicant A, applicant B, member, suspended member, and staff accounts.
Verify applicant A cannot query B's records directly through the Data API, cannot
promote itself, cannot review applications, and cannot read protected resources.

## 8. Treat game access as a separate project

A website approval does not authorize the FiveM server. Initially use a reviewed
manual process for server activation. A later bridge must run server-side, check
verified player identifiers, verify approvals on connection, revoke access on
suspension, authenticate any service-to-service request, and keep bot/service
keys out of both browser code and client-side FiveM resources.

No launch has been performed by this package. Hosting, billing, monitoring,
backups, content ownership, and final security review remain operator tasks.
