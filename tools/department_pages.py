"""Public department pages. No private rosters or application data are compiled."""
from html import escape


def build_lspd(page, icon, btn):
    units = [
        ('01', 'shield', 'Patrol Operations', 'The people behind the first response.', 'From a conversation on the sidewalk to a call across the city, patrol creates the everyday encounters that make Los Santos feel alive.'),
        ('02', 'pulse', 'Traffic Enforcement', 'Keep the city moving.', 'Road safety, collision scenes, and vehicle-related investigations offer a focused path for officers who enjoy detail and coordination.'),
        ('03', 'search', 'Investigations', 'Follow the story further.', 'Build longer investigations through interviews, evidence, and collaboration. Give everyone involved room to shape how a case unfolds.'),
        ('04', 'people', 'Field Training', 'Experience worth passing on.', 'A proposed home for guided patrols, practical feedback, and helping new officers find their confidence within the department.'),
    ]
    unit_cards = ''.join(f'''<article class="lspd-unit">
      <div class="lspd-unit-top"><span class="lspd-unit-icon">{icon(ico)}</span><span>{number} / LSPD</span></div>
      <h3>{escape(title)}</h3><strong>{escape(subtitle)}</strong><p>{escape(copy)}</p>
    </article>''' for number, ico, title, subtitle, copy in units)
    values = [
        ('Respect the player.', 'Treat the person behind every character with patience and respect, even when the scene gets tense.'),
        ('Communicate clearly.', 'Listen, keep your radio traffic useful, and give the people around you time to respond.'),
        ('Put the story first.', 'Create believable encounters and room for consequences. A good scene matters more than winning.'),
        ('Keep learning.', 'Take feedback well, support your team, and be willing to improve after every shift.'),
    ]
    value_rows = ''.join(f'<li><span>{n:02d}</span><div><h3>{escape(title)}</h3><p>{escape(copy)}</p></div></li>' for n, (title, copy) in enumerate(values, 1))
    commands = ''.join(f'<li><span class="lspd-rank-mark" aria-hidden="true">{mark}</span><div><h3>{title}</h3><p>To be announced</p></div></li>' for mark, title in [('★★★', 'Chief of Police'), ('★★', 'Assistant Chief'), ('★', 'Deputy Chief')])
    ranks = ''.join(f'<li><b>{name}</b><span>{ranks}</span></li>' for name, ranks in [
        ('Command', 'Chief · Assistant Chief · Deputy Chief'),
        ('Supervision', 'Captain · Lieutenant · Sergeant'),
        ('Patrol', 'Senior Officer · Officer · Cadet'),
    ])
    body = f'''<div class="wrap lspd-page">
      <nav class="lspd-breadcrumbs" aria-label="Breadcrumb"><a href="departments.html">Departments</a><span aria-hidden="true">/</span><span aria-current="page">Los Santos Police Department</span></nav>
      <section class="lspd-hero" aria-labelledby="lspd-title">
        <img class="lspd-hero-image" src="assets/lspd-patrol-screenshot.webp" width="1919" height="1079" alt="Los Santos Police SUV parked above the city at sunset" fetchpriority="high">
        <div class="lspd-hero-copy">
          <span class="lspd-kicker">COSMIC ROLEPLAY <span aria-hidden="true">/</span> LSPD</span>
          <div class="lspd-insignia" aria-hidden="true">{icon('shield')}<span>LOS SANTOS<br><b>POLICE DEPARTMENT</b></span></div>
          <h1 id="lspd-title">LOS SANTOS.<br><span>OUR CITY. OUR DUTY.</span></h1>
          <p>Behind the badge is a person.<br>Beyond the call is a story.</p>
          <div class="button-row">{btn('Discover the department', '#about', True)}{btn('Joining LSPD', '#joining')}</div>
        </div>
      </section>
      <nav class="lspd-section-nav" aria-label="LSPD sections">
        <a href="#about">The department</a><a href="#joining">Joining LSPD</a><a href="#divisions">Divisions</a><a href="#leadership">Leadership</a><a href="#media">Media</a>
      </nav>
      <div class="lspd-layout">
        <div class="lspd-main">
          <section class="lspd-panel lspd-about" id="about" aria-labelledby="lspd-mission">
            <span class="lspd-kicker">01 / OUR MISSION</span>
            <h2 id="lspd-mission">A BADGE IS A<br><span>RESPONSIBILITY.</span></h2>
            <p class="lspd-lead">Serve the city. Earn its trust. Make every interaction matter.</p>
            <p>Los Santos Police Department is Cosmic’s home for city policing roleplay. Our vision is a department built around thoughtful decisions, teamwork, and the people on both sides of a call.</p>
            <p>From a quiet neighborhood patrol to a complex investigation, the goal is to create believable stories together. Professionalism and a willingness to listen belong in every scene.</p>
            <div class="lspd-principles"><span>{icon('shield')} Integrity</span><span>{icon('people')} Respect</span><span>{icon('book')} Accountability</span></div>
          </section>
          <section class="lspd-panel" aria-labelledby="lspd-expectations">
            <span class="lspd-kicker">THE PERSON BEHIND THE BADGE</span>
            <h2 id="lspd-expectations">WHAT WE VALUE.</h2>
            <ol class="lspd-values">{value_rows}</ol>
          </section>
          <section class="lspd-panel" id="joining" aria-labelledby="lspd-joining">
            <div class="lspd-heading"><div><span class="lspd-kicker">02 / YOUR NEXT CHAPTER</span><h2 id="lspd-joining">FIND YOUR PLACE.</h2></div><span class="lspd-status">Intake closed</span></div>
            <p>The planned route into LSPD begins with Cosmic membership. Department requirements and training details will be published before recruitment opens.</p>
            <ol class="lspd-pathway">
              <li><span>01</span><div><h3>Get to know Cosmic</h3><p>Explore the community and review the rulebook. Its current wording is still under review.</p><a href="rules.html">Read the draft rules {icon('arrow')}</a></div></li>
              <li><span>02</span><div><h3>Become a community member</h3><p>Connect your Discord account and prepare your community application. Submissions are currently closed.</p><a href="portal.html#apply">Open your portal {icon('arrow')}</a></div></li>
              <li><span>03</span><div><h3>Start your department journey</h3><p>When LSPD recruitment opens, follow the published application and training process. Community membership alone does not grant an LSPD position.</p></div></li>
            </ol>
          </section>
          <section class="lspd-divisions" id="divisions" aria-labelledby="lspd-divisions">
            <div class="lspd-heading"><div><span class="lspd-kicker">03 / ROOM TO GROW</span><h2 id="lspd-divisions">MORE THAN PATROL.</h2></div></div>
            <p class="lspd-section-intro">Proposed areas of service. The final unit structure and availability are being confirmed.</p>
            <div class="lspd-unit-grid">{unit_cards}</div>
          </section>
          <section class="lspd-panel lspd-media" id="media" aria-labelledby="lspd-media">
            <span class="lspd-kicker">04 / LIFE IN THE DEPARTMENT</span>
            <h2 id="lspd-media">STORIES FROM THE CITY.</h2>
            <figure><img src="assets/lspd-patrol-screenshot.webp" width="1919" height="1079" alt="Los Santos Police SUV beneath an American flag, with city lights and a sunset in the background" loading="lazy"><figcaption>Los Santos Police Department. A quiet moment above the city.</figcaption></figure>
            <a class="text-link" href="media.html">Explore Cosmic media {icon('arrow')}</a>
          </section>
        </div>
        <aside class="lspd-sidebar" aria-label="Recruitment and department information">
          <section class="lspd-panel lspd-recruitment" aria-labelledby="lspd-recruit-title">
            <span class="lspd-kicker">YOUR NEXT SHIFT STARTS HERE</span>
            <h2 id="lspd-recruit-title">ANSWER<br>THE CALL.</h2>
            <p>A place for people who enjoy service, teamwork, and a story worth returning to.</p>
            <dl class="lspd-intakes"><div><dt>Recruit</dt><dd>Closed</dd></div><div><dt>Reserve</dt><dd>Closed</dd></div><div><dt>Transfer</dt><dd>Closed</dd></div></dl>
            <p class="lspd-small">Recruitment is paused while the rules and department requirements are finalized.</p>
            {btn('How to prepare', '#joining', True)}
          </section>
          <section class="lspd-panel" id="leadership" aria-labelledby="lspd-command">
            <span class="lspd-kicker">THE PEOPLE WHO LEAD</span><h2 id="lspd-command">COMMAND.</h2>
            <p class="lspd-small">Proposed leadership structure. Confirmed appointments will be listed here.</p>
            <ul class="lspd-command">{commands}</ul>
            <details class="lspd-ranks"><summary>Proposed rank structure</summary><ul>{ranks}</ul></details>
          </section>
          <section class="lspd-panel lspd-resources" aria-labelledby="lspd-resources">
            {icon('lock')}<h2 id="lspd-resources">ALREADY A MEMBER?</h2><p>Visit the Core Hub for the resources available to your account.</p><a class="text-link" href="portal.html#resources">Open member resources {icon('arrow')}</a>
          </section>
          <section class="lspd-panel lspd-events" aria-labelledby="lspd-events">
            <span class="lspd-kicker">ON THE CALENDAR</span><h2 id="lspd-events">UPCOMING EVENTS.</h2><p>No department events have been announced.</p>
          </section>
        </aside>
      </div>
      <div class="lspd-bottom"><p>One department. Part of something bigger.</p><a class="text-link" href="departments.html">Explore all departments {icon('arrow')}</a></div>
    </div>'''
    page('department-lspd.html', 'Los Santos Police Department', 'Discover Cosmic’s Los Santos Police Department (LSPD): its mission, proposed divisions, leadership, and recruitment pathway. Applications are currently closed.', body, extra_css='assets/departments.css')
