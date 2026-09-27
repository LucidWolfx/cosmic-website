"""In-memory UI tests. Does NOT test hosted OAuth, CDN, CSP, or database RLS."""
from pathlib import Path
import sys,json,os,shutil
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from browser_helpers import render_in_memory,SITE,ROOT
from playwright.sync_api import sync_playwright
OUTPUT=Path(os.environ.get('COSMIC_PREVIEW_DIR',ROOT/'previews'));OUTPUT.mkdir(parents=True,exist_ok=True)
checks=[];issues=[];errors=[]
def check(name,condition):
 checks.append({'name':name,'passed':bool(condition)})
 if not condition:issues.append(name)
with sync_playwright() as p:
 executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
 b=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
 def new(file,width=1440,override=None,extra=''):
  page=b.new_page(viewport={'width':width,'height':1000},device_scale_factor=1)
  page.on('pageerror',lambda error:errors.append(str(error)))
  render_in_memory(page,file,override,extra)
  page.locator('img[loading="lazy"]').evaluate_all('(images)=>images.forEach(i=>i.loading="eager")')
  page.wait_for_function('Array.from(document.images).filter(i=>i.getAttribute("src")).every(i=>i.complete)',timeout=10000)
  return page
 # Layout checks on every HTML document, at four widths.
 for file in sorted(SITE.glob('*.html')):
  print('Checking',file.name,flush=True)
  for width in [1440,1024,390,320]:
   page=new(file.name,width)
   overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
   check(f'{file.name} {width}px no horizontal overflow',not overflow)
   broken=page.locator('img[src]').evaluate_all('(images)=>images.filter(i=>!i.complete || i.naturalWidth===0).length')
   check(f'{file.name} {width}px images render',broken==0)
   page.close()
 page=new('index.html');check('12 public navigation items',page.locator('.primary-nav a,.secondary-nav a').count()==12)
 page.locator('[data-open-search]').click();page.locator('#site-search').fill('organization');check('Global search finds public content',page.locator('#search-results a').count()>0);page.locator('#search-dialog [data-close-dialog]').click();page.close()
 page=new('community.html');page.locator('.button[data-link="discord"]').click();check('Missing destination opens honest notice',page.locator('#message-dialog').is_visible() and 'not been added' in page.locator('#message-copy').inner_text());page.close()
 page=new('index.html',390);page.locator('#menu-toggle').click();check('Mobile menu opens all 12 pages plus login',page.locator('#mobile-nav').is_visible() and page.locator('#mobile-nav a').count()==13);page.keyboard.press('Escape');check('Mobile menu closes with Escape',not page.locator('#mobile-nav').is_visible());page.close()
 page=new('core-hub.html');page.locator('#guide-search').fill('building a character');check('Guide search filters cards',page.locator('[data-guide-card]:visible').count()==1);page.locator('#guide-search').fill('nothingmatchesxyz');check('Guide empty state',page.locator('#guide-empty').is_visible());page.close()
 page=new('rules.html');page.locator('[data-rule-filter="fairplay"]').click();check('Rules category filter',page.locator('[data-rule-category]:visible').count()==2);page.close()
 page=new('login.html');check('Unconfigured login disabled',page.locator('#discord-login').is_disabled());check('Unconfigured login does not claim success','not connected' in page.locator('#auth-notice').inner_text());page.close()
 page=new('portal.html');check('Unconfigured portal has no private shell',page.locator('.portal-shell').count()==0);check('Live portal has no preview role control',page.locator('#preview-role').count()==0);page.close()
 page=new('status.html');check('Unconfigured status unavailable',page.locator('#server-status').inner_text()=='Status unavailable');page.close()
 page=new('status.html',extra="window.fetch=async()=>({ok:true,json:async()=>({online:true,players:7,maxPlayers:48,updatedAt:new Date().toISOString()})});",override={'status':{'endpoint':'https://monitor.example.test/status','maxAgeSeconds':180}});page.wait_for_timeout(30);check('Fresh monitor response shown',page.locator('#server-status').inner_text()=='Online' and '7 / 48' in page.locator('#status-detail').inner_text());page.close()
 page=new('status.html',extra="window.fetch=async()=>({ok:true,json:async()=>({online:true,players:7,maxPlayers:48,updatedAt:'2000-01-01T00:00:00Z'})});",override={'status':{'endpoint':'https://monitor.example.test/status','maxAgeSeconds':180}});page.wait_for_timeout(30);check('Stale monitor response rejected',page.locator('#server-status').inner_text()=='Status unavailable');page.close()
 page=new('portal-preview.html');check('Preview explicitly labeled fictional','Fictional sample account' in page.locator('.preview-banner').inner_text());check('Member has no staff navigation',page.locator('[data-view="review"]').count()==0);page.locator('[data-view="resources"]').click();page.wait_for_timeout(20);check('Member preview resources appear',page.locator('[data-resource]').count()==3);page.locator('[data-resource]').first.click();check('Resource opens as text','DESIGN PREVIEW ONLY' in page.locator('#view-content').inner_text());page.locator('#view-content a[href="#resources"]').click();check('Same-hash resource back navigation',page.locator('[data-resource]').count()==3)
 page.locator('[data-view="requests"]').click();page.wait_for_timeout(20);page.locator('[data-new-kind="business"]').click();page.locator('#save-draft').click();check('Preview does not claim to save draft','No draft was saved' in page.locator('#portal-message').inner_text())
 page.locator('#preview-role').select_option('applicant');page.locator('[data-view="resources"]').click();page.wait_for_timeout(20);check('Applicant resource lock','unlocks after approval' in page.locator('#view-content').inner_text());page.locator('[data-view="requests"]').click();page.wait_for_timeout(20);check('Applicant has support request only',page.locator('[data-new-kind]').count()==1 and page.locator('[data-new-kind="support"]').count()==1)
 page.evaluate("location.hash='review'");page.wait_for_timeout(20);check('Applicant manual staff-route denial','Staff access is required' in page.locator('#view-content').inner_text());page.locator('#preview-role').select_option('staff');check('Staff preview queue appears',page.locator('[data-review]').count()==2);page.locator('[data-review]').first.click();page.locator('#review-form input[type="checkbox"]').check();page.locator('#review-form button[type="submit"]').click();check('Preview staff cannot record decision','No decision has been recorded' in page.locator('#portal-message').inner_text());page.close()
 # Brand direction and safe replacement behavior.
 page=new('index.html');check('Provisional reference logo active',page.evaluate('document.documentElement.dataset.brandMode')=='reference');check('Ice-blue accent applied',page.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()')=='#8ac7f3');check('Reference panorama is present',page.locator('.cinema-reference').is_visible());check('Final logo not invented',page.locator('[data-brand-logo]:visible').count()==0)
 check('Relative image URLs accepted',page.evaluate("CosmicUI.safeUrl('assets/cosmic-brand-reference.jpg')")=='assets/cosmic-brand-reference.jpg')
 for bad in ['javascript:alert(1)','data:text/html,test','//example.test/image.png','https://user:pass@example.test/image.png','../outside.html']:
  check('Unsafe URL rejected '+bad,page.evaluate('(v)=>CosmicUI.safeUrl(v)',bad)=='')
 page.close()
 page=new('index.html',override={'brand':{'name':'Cosmic','tagline':'SAN ANDREAS','accent':'#8ac7f3','referenceSheet':'','logo':''}});check('Reference artwork can be disabled',page.locator('.reference-brand:visible').count()==0 and page.locator('[data-wordmark]:visible').count()==2);page.close()
 page=new('index.html',override={'brand':{'name':'Cosmic','tagline':'SAN ANDREAS','accent':'#8ac7f3','referenceSheet':'assets/cosmic-brand-reference.jpg','logo':'assets/favicon.svg'},'heroImage':'assets/city.svg'});check('Standalone logo takes priority',page.evaluate('document.documentElement.dataset.brandMode')=='custom');check('Standalone cover takes priority',page.evaluate('document.documentElement.dataset.coverMode')=='custom' and page.locator('.cinema-custom').is_visible());page.close()
 page=new('departments.html');check('Six provisional department concepts',page.locator('.department-card').count()==6 and 'Proposed identities, not an active roster' in page.locator('.notice').first.inner_text());page.screenshot(path=str(OUTPUT/'Cosmic-v3-Departments.png'),full_page=True);page.close()
 page=new('setup.html');check('Reference sheet configuration editable',page.locator('[name="referenceSheet"]').input_value()=='assets/cosmic-brand-reference.jpg');page.locator('[name="tagline"]').fill('A NEW CHAPTER');
 with page.expect_download() as d:page.locator('button[type="submit"]').click()
 downloaded=Path(d.value.path()).read_text();check('Config export preserves reference board and changed tagline','cosmic-brand-reference.jpg' in downloaded and 'A NEW CHAPTER' in downloaded);page.close()
 # Regenerate final screen captures after tests.
 page=new('index.html');page.screenshot(path=str(OUTPUT/'Cosmic-v3-Home.png'),full_page=True);page.screenshot(path=str(OUTPUT/'Cosmic-v3-Home-Preview.png'),full_page=False);page.close()
 page=new('portal-preview.html');page.screenshot(path=str(OUTPUT/'Cosmic-v3-Portal.png'),full_page=True);page.locator('#preview-role').select_option('staff');page.locator('[data-view="review"]').click();page.wait_for_timeout(20);page.screenshot(path=str(OUTPUT/'Cosmic-v3-Staff.png'),full_page=True);page.close()
 page=new('portal-preview.html',390);page.screenshot(path=str(OUTPUT/'Cosmic-v3-Mobile-Portal.png'),full_page=True);page.close()
 page=new('index.html',390);page.screenshot(path=str(OUTPUT/'Cosmic-v3-Mobile-Home.png'),full_page=True);page.screenshot(path=str(OUTPUT/'Cosmic-v3-Mobile-Preview.png'),full_page=False);page.close()
 b.close()
check('No JavaScript runtime errors',not errors)
report={'method':'In-memory Chromium rendering; inline asset test transform; no live backend or OAuth; CSP not exercised','checks':checks,'failures':issues,'javascriptErrors':errors}
(ROOT/'tests/ui-results.json').write_text(json.dumps(report,indent=2))
print(f'{sum(c["passed"] for c in checks)} / {len(checks)} checks passed')
print('Failures:',issues)
print('JS errors:',errors)
if issues:sys.exit(1)
