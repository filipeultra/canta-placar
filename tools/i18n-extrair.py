import re, json, html, sys
from html.parser import HTMLParser
import os
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'
PT=re.compile(r'[A-Za-zÀ-ÿ]')
CODE=re.compile(r'(^M[\d.]|^[A-Z][a-z]+[A-Z]\w+$|^[a-z_]+:$|^[\w-]+/[\w.+-]+$|^[\w-]+\[|\]$|^[#.\[@:]|=>|\{|\}|;\s*$|^[^ ]*;[^ ]*$|\bpx\b|rgba?\(|var\(--|data-|https?:|^[a-z0-9_-]+$|^[a-z]+[A-Z]\w*$|\\u|^\s*[<>]|^[\w.-]+\.(js|css|png|svg|webp|json|mp4|webm|woff2)$|^i-[a-z-]+$|^s-[a-z-]+$|[a-z]+\([^)]*\)$|^#[0-9a-fA-F]{3,8}$)')
out={}
def add(s, src):
    s=html.unescape(s).replace('\u00a0',' ')
    t=s.strip()
    if len(t)<2 or not PT.search(t): return
    # palavra solta com espaço em volta (" converteu ", " seguidas") é texto, não identificador
    spaced = s != t and re.fullmatch(r'[a-zà-ÿ]+', t) is not None
    if (CODE.search(t) and not spaced) or t.startswith(('"]', '&', '?')) or 'width=' in t: return
    # sem nenhuma letra minúscula e curta: siglas (ok traduzir maiúsculas? manter)
    out.setdefault(s if s==t else s, set()).add(src)
class P(HTMLParser):
    def __init__(s): super().__init__(); s.skip=0; s.stack=[]
    def handle_starttag(s, tag, attrs):
        if tag in ('script','style','svg','code'): s.skip+=1
        for k,v in attrs:
            if k in ('title','aria-label','placeholder','alt','content') and v:
                if k=='content' and not any(a==('name','description') or a[0]=='property' for a in attrs): continue
                add(v,'html-attr')
    def handle_endtag(s, tag):
        if tag in ('script','style','svg','code') and s.skip: s.skip-=1
    def handle_data(s, d):
        if s.skip: return
        if d.strip(): add(d,'html')
for f in ['index.html']:
    P().feed(open(ROOT+f).read())
# literais de JS
STR=re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`")
TAG=re.compile(r'<[^>]*>')
for f in ['app.js','social.js','share.js','motion.js','stats.js','engine.js','help.js','video.js','relay.js','voice.js','demo.js']:
    src=open(ROOT+f).read()
    # tira comentários de linha e de bloco
    src=re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src=re.sub(r'(^|[^:\'"\\])//[^\n]*', r'\1', src)
    for m in STR.finditer(src):
        lit=m.group(1) if m.group(1) is not None else m.group(2) if m.group(2) is not None else m.group(3)
        if lit is None: continue
        lit=lit.replace("\\'", "'").replace('\\"','"').replace('\\n','\n')
        for a in re.findall(r'(?:title|aria-label|placeholder|alt)="([^"]{2,})"', lit): add(a, f+'-attr')
        if '="' in lit or '<' in lit or '>' in lit:
            lit2 = re.sub(r'\s[\w-]+="[^"]*"', ' ', lit)  # tira atributos
            for part in TAG.split(lit2):
                part = re.sub(r'^[^<]*?">', '', part) if '">' in part else part
                if part.strip() and '="' not in part and not part.strip().startswith('"'): add(part, f)
        else: add(lit, f)
res=[{'pt':k,'src':sorted(v)} for k,v in out.items()]
res.sort(key=lambda x:(x['src'][0], x['pt']))
json.dump(res, open(sys.argv[1],'w'), ensure_ascii=False, indent=0)
print(len(res), sum(len(x['pt']) for x in res))
from collections import Counter
print(Counter(x['src'][0] for x in res))
