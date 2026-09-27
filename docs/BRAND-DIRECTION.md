# Cosmic brand direction: provisional v3

This revision responds to the concept board supplied on 27 September 2026.
The name remains Cosmic. The identity is not yet final.

## Visual direction

The interface now uses charcoal and blue-black surfaces, silver-white text,
ice-blue highlights, and the warm sunset city panorama from the supplied board.
The previous orbit-style header and monochrome hero illustration are no longer
used by default. The public website and portal share the same visual system.
The favicon is a temporary letter C, not a finalized logo.

## Reference artwork, not a finished brand asset pack

`site/assets/cosmic-brand-reference.jpg` is the supplied 1536 by 768 image,
copied without altering its bytes. CSS viewports display its primary mark,
top panorama, and department concepts. No separately drawn or upscaled logos
are represented as final artwork. Its resolution limits are visible at large
sizes; replace it with the original high-resolution logo and cover files before
launch. The department display is deliberately labelled provisional.

The six proposed identities shown are LSPD, BCSO, SASP, FMA, DOJ, and ICO.
Names, responsibilities, recruitment status, and permission requirements have
not been confirmed merely because a name appears in the reference board.
No Discord invite or operational claims printed within the board have been
adopted as configured links or factual site copy.

The owner must confirm permission to publish the supplied artwork. No unrelated
community's artwork, roster, application data, or brand copy was downloaded.

## Replacing the provisional artwork

Open `site/setup.html` and enter the final full-width transparent logo path,
cover image path, accent, and tagline. Download the configuration and replace
`site/assets/config.js`.

The final logo takes priority over the board's primary mark. A standalone cover
takes priority over the board panorama. Clear the reference-sheet field to remove
all board-derived graphics, including the department samples and background
imagery. The text wordmark and department initials provide fallbacks.

The reference-sheet field assumes exactly this board layout. A new differently
arranged board is not a drop-in replacement. Use standalone final assets instead.

`site/assets/brand.css` is the isolated visual layer. `tools/build.py` builds the
public markup and the CSS viewports. Functionality and backend permissions do not
depend on an accent color or on a logo being present.

## Remaining content decisions

Core Hub is still provisionally a knowledge and resources center. Department
subgroups, private departmental roles, public business/organization listings,
media, approved rules, the Discord destination, and launch dates need the team's
confirmation. Nothing in this brand revision opens whitelist intake.
