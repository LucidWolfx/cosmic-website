# Security notes and remaining review

This is implementation guidance, not a claim of an independent security audit.
The live backend, OAuth provider, CDN asset, and deployed hosting configuration
have not been exercised in this environment.

- Authentication delegates to Discord and Supabase; there is no website password
  form. The browser uses PKCE and a fixed local callback, with no user-controlled
  return URL. Provider errors are displayed as text. Callback query data is
  removed from the address bar after processing.
- Roles are stored separately from editable profile/identity metadata. Browser
  credentials can SELECT only rows permitted by RLS. Table INSERT, UPDATE,
  DELETE, and TRUNCATE are not granted to the browser.
- Write RPC functions use fixed empty search paths, fully qualified tables,
  authenticated user checks, role checks, ownership checks, workflow validation,
  row locks, payload limits, and per-user creation limits. Public function
  EXECUTE grants are revoked before authenticated grants are added.
- Application answers and feedback render as escaped text, never trusted HTML.
  Textarea values and input attributes are escaped. Private resources are plain
  text. No file uploads or user-supplied executable embeds are accepted.
- Private resource data never ships in static HTML, search indexes, or preview
  scripts. Preview data is explicitly fictional. No preview flag changes RLS.
- Auth tokens are browser session data managed by the provider SDK. This is a
  client-rendered application, not an HttpOnly-cookie SSR design. Preventing XSS
  and protecting the hosting/repository accounts remain critical. Do not place
  this portal on an origin running untrusted third-party scripts.
- A CSP is supplied in public page metadata. Authentication can load the pinned
  SDK from jsDelivr and contact HTTPS services. Confirm the final CSP against
  real OAuth/network behavior. Tighten connect-src and img-src to known origins
  after configuration. For a host supporting response headers, add appropriate
  frame-ancestors, HSTS, and Permissions-Policy response headers. Meta CSP cannot
  provide every HTTP response security control.
- The database limits NEW applications to 12 per user per 24 hours and one active
  application per kind. This is not a comprehensive anti-abuse service. Add
  service-side request throttling, monitoring, provider rate limits, and any
  supported bot controls appropriate for production traffic.
- Never use a service_role/secret key in this site, repository, or a client-side
  FiveM resource. Do not commit Discord secrets, bot tokens, webhook URLs, or
  database passwords. The public setup editor does not accept secret keys.
- Changing client JavaScript to show a staff button must not grant any database
  access. Verify this with a normal account and direct API calls in staging.
- Maintain a clear privacy notice, data retention/deletion process, backups,
  audit practices, and a staff access review process. Owner role changes should
  be performed through the controlled privileged dashboard with its audit logs.
- Long-lived pages may retain data already authorized and rendered before a
  suspension. Subsequent backend operations are rechecked. A production session
  revocation/refresh policy should be configured and tested; JavaScript hiding
  alone cannot retract data already received by an authorized browser.
