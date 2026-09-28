"""Render the published rulebook and its matching portable text from one source."""
from pathlib import Path
from html import escape as E
import json

ROOT = Path(__file__).resolve().parents[1]

def render_rules(hero, section):
    book = json.loads((ROOT / 'content/rules.json').read_text(encoding='utf-8'))
    title = f"Cosmic Community Rules v{book['version']}"
    meta = f"Effective {book['effective_date']} | Version {book['version']}"
    text = [title, meta, '', book['intro'], '', 'COSMIC DEFAULTS']
    text += [f'{value}: {label}' for value, label in book['defaults']]
    markdown = [f'# {title}', '', meta, '', book['intro'], '', '## Cosmic defaults', '']
    markdown += [f'- **{value}:** {label}' for value, label in book['defaults']]
    rules = []
    for number, rule in enumerate(book['rules'], 1):
        heading = f"{number:02d}. {rule['title']}"
        text += ['', heading, *['\n' + p for p in rule['paragraphs']]]
        markdown += ['', f'## {heading}', '', '\n\n'.join(rule['paragraphs'])]
        rules.append(f'<details class="accordion" id="{E(rule["id"])}" data-rule-category="{E(rule["category"])}">'
            f'<summary>{E(heading)}</summary><div class="rule-body">'
            + ''.join(f'<p>{E(p)}</p>' for p in rule['paragraphs'])
            + f'<a class="text-link rule-permalink" href="#{E(rule["id"])}" aria-label="Link to rule {number}">Link to this rule ↗</a></div></details>')
    (ROOT / f'site/rules-v{book["version"]}.txt').write_text('\n'.join(text) + '\n', encoding='utf-8')
    (ROOT / 'docs/COMMUNITY-RULES.md').write_text('\n'.join(markdown) + '\n', encoding='utf-8')
    summary = '<div class="rules-summary">' + ''.join(f'<div><strong>{E(value)}</strong><span>{E(label)}</span></div>' for value, label in book['defaults']) + '</div>'
    filters = '<div class="filters" aria-label="Rule categories"><button type="button" class="filter" data-rules-category="all" aria-pressed="true">All rules</button>'
    filters += ''.join(f'<button type="button" class="filter" data-rules-category="{E(key)}" aria-pressed="false">{E(label)}</button>' for key, label in book['categories'].items()) + '</div>'
    tools = '<div class="rules-tools" hidden id="rules-tools"><label for="rule-search">Find a rule<input type="search" id="rule-search" placeholder="Search NLR, hostages, reports..." autocomplete="off"></label><div class="button-row"><button type="button" class="button small" id="rules-expand">Expand shown rules</button><button type="button" class="button small" id="rules-collapse">Collapse shown rules</button></div></div>'
    return hero('THE RULEBOOK.', 'Serious roleplay. Shared standards. Room for everyone’s story.', 'Cosmic community rules') + section(
        f'<div class="rules-intro"><span class="pill">{E(meta)}</span><p>{E(book["intro"])}</p>'
        '<p>These are Cosmic’s community rules. The limits below are our server settings; read the full sections for their scope and exceptions. Applications are currently closed. Check the <a href="join.html">Join page</a> for recruitment information.</p>'
        f'<a class="button small" href="rules-v{E(book["version"])}.txt" download>Download the full rulebook ↗</a></div>'
        + summary + tools + '<div id="rules-filters" hidden>' + filters + '</div>'
        f'<p id="rules-count" class="muted-text" aria-live="polite">{len(rules)} rules</p>'
        + '<div class="rules-list">' + ''.join(rules) + '</div>'
        + '<div class="notice" id="rules-empty" hidden>No matching rules. Clear the search or choose All rules.</div>'
        + '<div class="notice rules-help"><b>Need help with a rule?</b> Contact the team privately through the support area in the Cosmic Discord server. If your access is restricted, use the appeal contact supplied in your moderation notice. Do not post a public accusation or argue the case during a scene.</div>', 'rules-section')
