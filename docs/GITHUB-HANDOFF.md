# GitHub publishing

The website has its own public repository:
https://github.com/LucidWolfx/cosmic-website

The older LucidWolfx/Cosmic-fbi project is separate and unchanged.

## Automatic updates

The Publish Cosmic website workflow runs on pushes to main, builds public
pages from tools/build.py, validates all pages and JavaScript, and publishes
only site/ to GitHub Pages. Pull requests run the same build checks without
publishing. The workflow can also be started manually in the Actions tab.

Repository Settings > Pages must use GitHub Actions as its source.
The finished deployment and Pages settings display the actual website address.

Edit generated public page copy in tools/build.py. Edit styling, portal code,
public configuration, and directory content in their respective site/assets/
files. The build preserves config.js and content.js.

## Member backend

Publishing the public website does not connect Discord login or application
storage. Follow LAUNCH.md for Supabase setup, Discord OAuth, owner roles,
official community links, and permission tests. Keep all server secrets out
of this public repository. Portal membership does not grant FiveM access or
Discord roles automatically.

Official reference:
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
