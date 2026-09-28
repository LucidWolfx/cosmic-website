# Cosmic brand direction: mascot / After Dark

Approved by the owner on 28 September 2026 for the public website and portal.
The identity uses the supplied Cosmic red panda mascot, true black (#000000),
charcoal panels, white text, crimson (#df2846), and a brighter accent (#ff6480).
The open-applications status dot is green (#36d879).

## Assets

- `site/assets/cosmic-mascot.webp`: the supplied 1200 by 1310 mascot, converted
  to WebP at its original dimensions with transparency preserved.
- `site/assets/cosmic-after-dark.jpg`: generated promotional artwork approved
  in the homepage mockup. It is labelled promotional artwork, not server footage.
- `site/assets/lspd-city-patrol.webp`: the owner's existing LSPD image.
- `site/assets/cosmic-brand-reference.jpg`: retained only for the existing
  provisional department badge concepts. Those departments and identities are
  not newly confirmed by this visual release.

## Editing

`tools/homepage.html` and `site/assets/homepage.js` control the homepage scenes.
`tools/site_shell.py` builds the shared public navigation and footer.
`site/assets/brand.css` provides the black background, mascot styling, public
navigation and homepage presentation. `after-dark-components.css` styles the
inner public pages; `portal-dashboard.css` styles portal screens and tools.

The logo, hero image, and public accent remain configurable in
`site/assets/config.js`. `site/setup.html` can generate a replacement public
configuration. The reference-sheet option applies only to the original board's
layout; do not use another sheet as a drop-in replacement.

Run `python tools/build.py` after edits. The builder generates the public pages,
login, portal, and configuration editor and versions CSS/JavaScript asset links
so returning visitors receive the current appearance.

## Scope

This release changes presentation. It retains the existing 18+ serious RP rules,
open whitelist/member requests, Discord authentication, review routing and
 department permissions. Reserve and transfer routes remain closed.

No staff names, department assignments, Discord invites, service statistics or
community media were invented as part of the redesign.
