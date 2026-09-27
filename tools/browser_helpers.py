"""Test-only, in-memory fixtures for a browser environment without URL navigation."""
from pathlib import Path
from bs4 import BeautifulSoup
import base64,json,mimetypes
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
def render_in_memory(page,filename,config_override=None,extra_script=''):
    """Inline exact assets and remap dynamic local images to equivalent data fixtures.

    CSP is removed solely from test markup to permit inlining. Network, deployed CSP,
    OAuth, database policies, and real service integrations are NOT tested here.
    Production files are not altered. Public config and URL validation still execute.
    """
    assets={}
    for path in (SITE/'assets').iterdir():
        if path.suffix.lower() in ('.svg','.jpg','.jpeg','.png','.webp'):
            mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
            assets[path.relative_to(SITE).as_posix()]='data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
    fixture='''(() => {
      const assets=ASSETS;
      const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
      Object.defineProperty(HTMLImageElement.prototype,'src',{
        configurable:descriptor.configurable,enumerable:descriptor.enumerable,
        get:descriptor.get,
        set(value){descriptor.set.call(this,assets[value]||value);}
      });
      const original=CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty=function(name,value,priority){
        if(name==='--brand-sheet'){
          for(const [path,data] of Object.entries(assets))value=String(value).replace(JSON.stringify(path),JSON.stringify(data));
        }
        return original.call(this,name,value,priority);
      };
    })();'''.replace('ASSETS',json.dumps(assets))
    soup=BeautifulSoup((SITE/filename).read_text(),'html.parser')
    for node in list(soup.select('meta[http-equiv="Content-Security-Policy"],link[rel="icon"]')):node.decompose()
    for link in list(soup.select('link[rel="stylesheet"]')):
        style=soup.new_tag('style');style.string=(SITE/link['href']).read_text();link.replace_with(style)
    scripts=[]
    for script in list(soup.select('script[src]')):
        text=(SITE/script['src']).read_text()
        if script['src']=='assets/config.js' and config_override:
            text+='\nObject.assign(window.COSMIC,'+json.dumps(config_override)+');'
        scripts.append(text);script.decompose()
    for img in soup.select('img[src]'):
        if img['src'] in assets:img['src']=assets[img['src']]
    for text in [fixture]+([extra_script] if extra_script else [])+scripts:
        tag=soup.new_tag('script');tag.string=text;soup.body.append(tag)
    page.set_content(str(soup),wait_until='load')
