"""Shared public navigation for the approved Cosmic mascot identity."""
from html import escape

GROUPS = [
    ('Discover', [('index.html','Discover','grid'),('about.html','About Cosmic','people'),('community.html','Community','people'),('join.html','How to join','user')]),
    ('The city', [('departments.html','Departments','shield'),('businesses.html','Businesses','briefcase'),('organizations.html','Organizations','people')]),
    ('Explore', [('rules.html','Rulebook','book'),('core-hub.html','Core Hub','grid'),('media.html','Media','camera'),('news.html','News','file'),('status.html','Status','pulse')])
]

def render_header(active, brand, navlinks, icon):
    if active.startswith('guide-'): active='core-hub.html'
    if active.startswith('news-'): active='news.html'
    items=''
    for label, links in GROUPS:
        items+=f'<div class="nav-group"><span class="nav-group-label">{label}</span>'
        items+=''.join(f'<a href="{url}"'+(' aria-current="page"' if url==active else '')+f'>{icon(symbol)}<span>{text}</span></a>' for url,text,symbol in links)
        items+='</div>'
    return f'''<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
 <div class="site-brand-row">{brand()}<button class="menu-button" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu" id="menu-toggle">{icon('menu')}</button></div>
 <nav class="public-navigation" id="mobile-nav" aria-label="Main navigation" hidden>{items}<div class="nav-tools"><button class="search-button" type="button" data-open-search>{icon('search')}<span>Search the site</span></button><a href="portal.html" data-account-link class="nav-portal">Member portal {icon('arrow')}</a></div></nav>
 <div class="nav-foot"><a href="join.html" class="intake-status" data-launch-label>Whitelist applications open</a><span>18+ / Serious roleplay</span></div>
</header>'''

def render_footer(brand, navlinks, icon):
    return '''<footer class="site-footer"><div class="wrap"><div class="footer-links"><a href="community.html">Community</a><a href="rules.html">Rulebook</a><a href="core-hub.html">Core Hub</a><a href="privacy.html">Privacy &amp; data</a><a href="portal.html#requests">Support &amp; requests</a><a href="portal.html">Member portal ↗</a></div><div class="footer-bottom"><p>© <span data-year>2026</span> Cosmic Roleplay. Independent community. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive.</p><span>Character first. Story always.</span></div></div></footer>'''
