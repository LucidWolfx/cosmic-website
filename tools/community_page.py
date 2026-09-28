"""Public, owner-maintained staff directory. Never reads private portal profiles."""
from pathlib import Path
from html import escape
import json
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def render_community(icon):
    directory = json.loads((ROOT / 'site/assets/team.json').read_text(encoding='utf-8'))
    groups, members = directory['groups'], directory['members']
    group_ids = [group['id'] for group in groups]
    member_ids = [member['id'] for member in members]
    if len(group_ids) != len(set(group_ids)) or len(member_ids) != len(set(member_ids)):
        raise ValueError('Public team group and member IDs must be unique.')
    for group in groups:
        if not re.fullmatch(r'[a-z][a-z0-9-]*', group['id']) or group['id'] in {'main', 'leadership', 'staff', 'get-in-touch'}:
            raise ValueError('Team group IDs must be unique, unreserved URL slugs.')
        if group.get('accent') not in {'crimson', 'cyan'}:
            raise ValueError('Team role accents must use the Cosmic palette.')
    for member in members:
        if not member.get('name') or not member.get('role') or not member.get('roles'):
            raise ValueError('Public team members require a name, title, and confirmed roles.')
        if set(member['roles']) - set(group_ids) or not all(member['roles'].values()):
            raise ValueError('Member roles must refer to a configured team group with a title.')
        if member.get('avatarUrl'):
            avatar = urlsplit(member['avatarUrl'])
            if avatar.scheme != 'https' or not avatar.netloc or avatar.username or avatar.password:
                raise ValueError('Public team avatars require an HTTPS image URL without credentials.')

    panels = []
    for group in groups:
        key = group['id']
        assigned = [member for member in members if key in member['roles']]
        cards = []
        for member in assigned:
            name = escape(member['name'])
            role = escape(member['roles'][key])
            initials = escape(member.get('initials') or ''.join(word[0] for word in member['name'].split())[:2].upper())
            bio = escape(member.get('roleBios', {}).get(key, member.get('bio', '')))
            avatar = f'<img class="team-profile-photo" data-team-avatar src="{escape(member["avatarUrl"])}" alt="{name}’s Discord profile picture" width="256" height="256" decoding="async" hidden>' if member.get('avatarUrl') else ''
            cards.append(f'''<article class="team-member-card" data-team-member="{escape(member['id'])}">
              <div class="team-profile-frame" data-team-avatar-frame><span class="team-profile-mark" data-team-avatar-fallback aria-hidden="true">{initials}</span>{avatar}</div>
              <div class="team-card-body"><div class="team-member-heading"><h4>{name}</h4><span class="team-role">{role}</span></div><p class="team-bio">{bio}</p><div class="team-member-links"><a class="team-member-link" href="portal.html#requests" aria-label="Contact the team about {escape(group['title'])}">{icon('help')}<span>Contact the team</span></a></div></div>
            </article>''')
        count = f'<strong>{len(assigned)}</strong><span>{"member" if len(assigned) == 1 else "members"}</span>' if assigned else '<span>To be announced</span>'
        content = ''.join(cards) if assigned else '<p class="team-bio">Profiles will appear here as the team is confirmed.</p>'
        panels.append(f'''<section class="team-role-panel" data-team-role="{key}" data-accent="{group['accent']}" id="{key}" aria-labelledby="team-{key}-title">
          <div class="team-role-header"><span class="team-role-icon" aria-hidden="true">{icon(group.get('icon', 'people'))}</span><div class="team-role-copy"><h3 id="team-{key}-title">{escape(group['title'])}</h3><p>{escape(group['description'])}</p></div><span class="team-member-count">{count}</span></div>
          <div class="team-member-list">{content}</div>
        </section>''')

    jumps = ''.join(f'<a href="#{group["id"]}">{escape(group["title"])}</a>' for group in groups)
    return '''<section class="team-hero"><div class="wrap">
      <div class="team-hero-copy"><span class="eyebrow">The Cosmic team</span><h1>THE PEOPLE<br>BEHIND COSMIC.</h1><p class="lead">Meet the people building the city, guiding the community, and helping your stories happen.</p><div class="button-row"><a class="button primary" href="#leadership">Meet the team <span aria-hidden="true">↗</span></a><a class="button" href="#get-in-touch">Get in touch <span aria-hidden="true">↗</span></a></div></div>
      <div class="team-hero-mark" aria-hidden="true"><img src="assets/cosmic-mascot.webp" alt="" width="1200" height="1310"></div>
    </div></section>
    <div class="wrap"><nav class="team-page-jump" aria-label="Team sections">''' + jumps + '''<a href="#staff">Staff team</a><a href="#get-in-touch">Get in touch</a></nav></div>
    <section class="section team-section" id="leadership" aria-labelledby="team-directory-title"><div class="wrap"><div class="section-head"><div><span class="eyebrow">The people behind the roles</span><h2 id="team-directory-title">Our team.</h2></div><p>A closer look at who does what at Cosmic.</p></div><div class="team-role-grid">''' + ''.join(panels) + '''</div></div></section>
    <section class="section team-section" id="staff" aria-labelledby="team-staff-title"><div class="wrap"><div class="team-unannounced">''' + icon('people') + '''<div><h2 id="team-staff-title">More of the team, soon.</h2><p>Additional staff roles and profiles will appear here as the directory is confirmed.</p></div></div></div></section>
    <section class="section team-section" id="get-in-touch" aria-labelledby="team-contact-title"><div class="wrap">
      <div class="section-head"><div><span class="eyebrow">A place to turn</span><h2 id="team-contact-title">Let’s get you to the right place.</h2></div></div>
      <div class="team-help-grid">
        <article class="team-help"><h3>Questions &amp; support</h3><p>Need help with your account or a community issue? Send a private request through the portal for the team to review.</p><a class="button" href="portal.html#requests">Contact the team <span aria-hidden="true">↗</span></a></article>
        <article class="team-help"><h3>Applications &amp; feedback</h3><p>Follow your application, read feedback, and see the next step in your portal.</p><a class="button" href="portal.html#applications">My applications <span aria-hidden="true">↗</span></a></article>
      </div><p class="team-contact-note">Looking for department leadership? Visit <a href="department-lspd.html#leadership">LSPD’s department page</a> for its command structure.</p>
    </div></section>'''
