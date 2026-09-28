"""Public, owner-maintained staff directory. Never reads private portal profiles."""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parents[1]


def render_community(icon):
    members = json.loads((ROOT / 'site/assets/team.json').read_text(encoding='utf-8'))['members']
    groups = [
        ('leadership', 'Community leadership', 'The people guiding Cosmic and its community.'),
        ('staff', 'The staff team', 'Administration, moderation, and support for the people behind the characters.')
    ]
    for member in members:
        if member.get('group') not in {'leadership', 'staff'}:
            raise ValueError('Public team members must belong to leadership or staff.')
        if not member.get('name') or not member.get('role'):
            raise ValueError('Public team members require a name and role.')

    sections = []
    for group, title, description in groups:
        cards = []
        for member in [m for m in members if m['group'] == group]:
            name, role = escape(member['name']), escape(member['role'])
            initials = escape(member.get('initials') or ''.join(word[0] for word in member['name'].split())[:2].upper())
            handle = f'<p class="team-handle">{escape(member["handle"])}</p>' if member.get('handle') else ''
            bio = f'<p class="team-bio">{escape(member["bio"])}</p>' if member.get('bio') else ''
            if member.get('featured'):
                focus = ''.join(f'<span>{escape(item)}</span>' for item in member.get('focus', []))
                cards.append(f'''<article class="team-card team-card-featured" data-team-group="{group}">
                  <div class="team-profile-art" aria-hidden="true"><span class="team-profile-mark">{initials}</span><span class="team-profile-art-label">COSMIC ROLEPLAY</span></div>
                  <div class="team-card-body"><span class="team-role">{role}</span><h3>{name}</h3>{handle}{bio}<div class="team-profile-focus">{focus}</div><a class="text-link" href="#get-in-touch">Get in touch <span aria-hidden="true">↗</span></a></div>
                </article>''')
            else:
                cards.append(f'''<article class="team-card" data-team-group="{group}">
                  <div class="team-avatar" aria-hidden="true">{initials}</div>
                  <div class="team-card-body"><span class="team-role">{role}</span><h3>{name}</h3>{handle}{bio}</div>
                </article>''')
        content = '<div class="team-grid">' + ''.join(cards) + '</div>' if cards else f'''<div class="team-unannounced">{icon('people')}<div><strong>More of the team, soon.</strong><p>Additional staff profiles will appear here as the directory is confirmed.</p></div></div>'''
        sections.append(f'''<section class="section team-section" id="{group}" aria-labelledby="team-{group}-title"><div class="wrap"><div class="section-head"><div><span class="eyebrow">{'Leading the community' if group == 'leadership' else 'Here for the community'}</span><h2 id="team-{group}-title">{title}</h2></div><p>{description}</p></div>{content}</div></section>''')

    return '''<section class="team-hero"><div class="wrap">
      <div class="team-hero-copy"><span class="eyebrow">The Cosmic team</span><h1>THE PEOPLE<br>BEHIND COSMIC.</h1><p class="lead">A city is only as good as its people. Meet the team helping our community feel like home.</p><div class="button-row"><a class="button primary" href="#leadership">Meet the team <span aria-hidden="true">↗</span></a><a class="button" href="#get-in-touch">Get in touch <span aria-hidden="true">↗</span></a></div></div>
      <div class="team-hero-mark" aria-hidden="true"><img src="assets/cosmic-mascot.webp" alt="" width="1200" height="1310"></div>
    </div></section>
    <div class="wrap"><nav class="team-page-jump" aria-label="Team sections"><a href="#leadership">Leadership</a><a href="#staff">Staff team</a><a href="#get-in-touch">Get in touch</a></nav></div>''' + ''.join(sections) + '''
    <section class="section team-section" id="get-in-touch" aria-labelledby="team-contact-title"><div class="wrap">
      <div class="section-head"><div><span class="eyebrow">A place to turn</span><h2 id="team-contact-title">Let’s get you to the right place.</h2></div></div>
      <div class="team-help-grid">
        <article class="team-help"><h3>Questions &amp; support</h3><p>Need help with your account or a community issue? Send a private request through the portal for the team to review.</p><a class="button" href="portal.html#requests">Contact the team <span aria-hidden="true">↗</span></a></article>
        <article class="team-help"><h3>Applications &amp; feedback</h3><p>Follow your application, read feedback, and see the next step in your portal.</p><a class="button" href="portal.html#applications">My applications <span aria-hidden="true">↗</span></a></article>
      </div><p class="team-contact-note">Looking for department leadership? Visit <a href="department-lspd.html#leadership">LSPD’s department page</a> for its command structure.</p>
    </div></section>'''
