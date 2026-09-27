# Primary technical references

Reviewed 2026-09-27. No community website artwork or brand identity was copied.

- GitHub Pages static hosting:
  https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub Pages limits:
  https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Supabase Discord OAuth and callback configuration:
  https://supabase.com/docs/guides/auth/social-login/auth-discord
- Supabase signInWithOAuth:
  https://supabase.com/docs/reference/javascript/auth-signinwithoauth
- Supabase RLS, least-privilege grants, and database test guidance:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase JavaScript CDN installation:
  https://supabase.com/docs/reference/javascript/installing
- SDK version pin, 2.117.2 release listed 2026-09-25:
  https://github.com/supabase/supabase-js/releases

The SDK release and documented installation method were reviewed via official
sources. The network-restricted runtime could not download or execute the CDN
bundle. Actual OAuth and database behavior therefore require staging validation.
