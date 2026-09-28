"""Public staff-directory shell. Discord supplies the current public membership."""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parents[1]
STAFF_GROUPS = [
    ('ownership', 'Owners', 'crimson'),
    ('management', 'Cosmic Management', 'violet'),
    ('administrator', 'Administrators', 'cyan'),
    ('moderator', 'Moderators', 'green'),
    ('trial-staff', 'Trial Staff', 'amber'),
]


def render_community(icon):
    groups = json.loads((ROOT / 'site/assets/team.json').read_text(encoding='utf-8'))['groups']
    if [(group['id'], group['title'], group['accent']) for group in groups] != STAFF_GROUPS:
        raise ValueError('The public directory must use the five approved staff groups in order.')

    panels = []
    for group in groups:
        key = group['id']
        panels.append(f'''<section class="team-role-panel" data-team-role="{key}" data-accent="{group['accent']}" id="{key}" aria-labelledby="team-{key}-title">
          <div class="team-role-header"><span class="team-role-icon" aria-hidden="true">{icon(group.get('icon', 'people'))}</span><div class="team-role-copy"><h3 id="team-{key}-title">{escape(group['title'])}</h3><p>{escape(group['description'])}</p></div><span class="team-member-count"><strong data-team-count aria-label="Member count unavailable">-</strong><span data-team-count-label>members</span></span></div>
          <div class="team-member-list" data-team-list><p class="team-state">Loading staff members...</p></div>
        </section>''')

    member_template = f'''<template data-team-member-template><article class="team-member-card">
      <div class="team-profile-frame" data-team-avatar-frame><span class="team-profile-mark" data-team-avatar-fallback aria-hidden="true"></span><img class="team-profile-photo" data-team-avatar alt="" width="256" height="256" decoding="async" referrerpolicy="no-referrer" hidden></div>
      <div class="team-card-body"><div class="team-member-heading"><h4 data-team-name></h4><span class="team-member-badges" data-team-badges></span></div><p class="team-bio" data-team-bio hidden></p><div class="team-member-links"><a class="team-member-link" href="portal.html#requests">{icon('help')}<span>Contact the team</span></a></div></div>
    </article></template>'''
    jumps = ''.join(f'<a href="#{group["id"]}">{escape(group["title"])}</a>' for group in groups)
    return '''<section class="team-hero"><div class="wrap">
      <div class="team-hero-copy"><span class="eyebrow">The Cosmic team</span><h1>THE PEOPLE<br>BEHIND COSMIC.</h1><p class="lead">Meet the people guiding the community and helping your stories happen.</p><div class="button-row"><a class="button primary" href="#leadership">Meet the team <span aria-hidden="true">↗</span></a><a class="button" href="#get-in-touch">Get in touch <span aria-hidden="true">↗</span></a></div></div>
      <div class="team-hero-mark" aria-hidden="true"><img src="assets/cosmic-mascot.webp" alt="" width="1200" height="1310"></div>
    </div></section>
    <div class="wrap"><nav class="team-page-jump" aria-label="Team sections">''' + jumps + '''<a href="#get-in-touch">Get in touch</a></nav></div>
    <section class="section team-section" id="leadership" aria-labelledby="team-directory-title" data-team-directory aria-busy="true"><div class="wrap"><div class="section-head"><div><span class="eyebrow">The people behind the roles</span><h2 id="team-directory-title">Our team.</h2></div><p>Each person appears under their highest role. Badges show their other staff roles.</p></div>
    <div class="team-directory-toolbar"><div class="team-directory-status" role="status" aria-live="polite"><p data-team-directory-status>Loading the staff directory...</p><time data-team-directory-time hidden></time><p class="team-directory-note" data-team-directory-note hidden></p></div><button class="button small" type="button" data-team-directory-refresh disabled>Refresh</button></div>
    <noscript><p class="notice">Enable JavaScript to load the current staff directory.</p></noscript>
    <div class="team-role-grid">''' + ''.join(panels) + '''</div>''' + member_template + '''</div></section>
    <section class="section team-section" id="get-in-touch" aria-labelledby="team-contact-title"><div class="wrap">
      <div class="section-head"><div><span class="eyebrow">A place to turn</span><h2 id="team-contact-title">Let’s get you to the right place.</h2></div></div>
      <div class="team-help-grid">
        <article class="team-help"><h3>Questions &amp; support</h3><p>Need help with your account or a community issue? Send a private request through the portal for the team to review.</p><a class="button" href="portal.html#requests">Contact the team <span aria-hidden="true">↗</span></a></article>
        <article class="team-help"><h3>Applications &amp; feedback</h3><p>Follow your application, read feedback, and see the next step in your portal.</p><a class="button" href="portal.html#applications">My applications <span aria-hidden="true">↗</span></a></article>
      </div><p class="team-contact-note">Looking for department leadership? Visit <a href="department-lspd.html#leadership">LSPD’s department page</a> for its command structure.</p>
    </div></section>'''
