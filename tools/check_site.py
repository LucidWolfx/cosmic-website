#!/usr/bin/env python3
"""Static validation using only the standard library; safe to run in Pages CI."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import re,sys
ROOT=Path(__file__).resolve().parents[1];SITE=ROOT/'site'
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.refs=[];self.ids=[];self.title=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='title':self.title=True
  for key in ('src','href'):
   if a.get(key):self.refs.append(a[key])
errors=[];count=0
for file in SITE.rglob('*.html'):
 p=Parser();p.feed(file.read_text(encoding='utf-8'));count+=1
 if not p.title:errors.append(f'{file.name}: missing title')
 if len(p.ids)!=len(set(p.ids)):errors.append(f'{file.name}: duplicate ID')
 for ref in p.refs:
  u=urlsplit(ref)
  if u.scheme or u.netloc or not u.path:continue
  target=(file.parent/unquote(u.path)).resolve()
  if target.name in ('portal-preview.html','preview.js','setup.html'):continue
  if not target.exists():errors.append(f'{file.name}: missing local file {ref}')
for name in ['index','about','community','join','rules','core-hub','departments','businesses','organizations','media','news','status','login','portal','auth-callback']:
 if not (SITE/(name+'.html')).exists():errors.append(f'Missing required page: {name}')
for file in SITE.rglob('*'):
 if file.is_file() and file.suffix in ('.js','.html','.css'):
  text=file.read_text(encoding='utf-8')
  if '\u2014' in text:errors.append(f'{file.relative_to(ROOT)}: em dash found')
  if re.search(r'sb_secret_[A-Za-z0-9_-]{8,}',text):errors.append(f'{file.name}: probable secret key')
if errors:
 print('\n'.join(errors));sys.exit(1)
print(f'PASS: {count} HTML pages; required routes, local assets, unique IDs, no em dashes or apparent secret keys.')
