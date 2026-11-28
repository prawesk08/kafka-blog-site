#!/usr/bin/env python3
"""Rewrite description / social / keywords front matter of every item page (album, song, book, movie, show)
from the facts already on the page. Distinct, specific, <=158 chars. Idempotent. Usage: seo_items.py [--dry]"""
import re,glob,json,html,sys,os,difflib
P=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','content','pages')
dry='--dry' in sys.argv
T=lambda s:html.unescape(re.sub(r'<[^>]+>','',s)).strip()
def li(cls,b):
    m=re.search(r'<ul class="%s">(.*?)</ul>'%cls,b,re.S); return [T(x) for x in re.findall(r'<li[^>]*>(.*?)</li>',m.group(1),re.S)] if m else []
def facts(b):
    return {T(k):T(v) for k,v in re.findall(r'<dt>(.*?)</dt><dd>(.*?)</dd>',b,re.S)}
def one(rx,b,d=''):
    m=re.search(rx,b,re.S); return T(m.group(1)) if m else d
def sent(s): s=s.strip(); return s if s[-1:] in '.!?”"' else s+'.'
def fit(head,cands,lim=158):
    hw=set(re.findall(r"\w+",head.lower()))
    cands=[c for c in cands if not c or len([w for w in re.findall(r"\w+",c.lower()) if w in hw])/max(1,len(re.findall(r"\w+",c)))<0.5]
    best=head
    for c in cands:
        c=sent(c)
        if c and len(head)+1+len(c)<=lim: best=head+' '+c; break
    if best!=head:
        used=best[len(head)+1:]
        for c in cands:
            c=sent(c)
            if c and c not in best and len(best)+1+len(c)<=lim and c[:30] not in best and difflib.SequenceMatcher(None,best[len(head):].lower(),c.lower()).ratio()<0.45 and not any(difflib.SequenceMatcher(None,x.lower(),c.lower()).ratio()>0.55 for x in re.split(r'(?<=[.!?]) ',best[len(head)+1:])): best=best+' '+c
    if best==head:
        for c in cands:
            c=sent(c)
            if c and len(head)+1+min(len(c),40)<=lim-0 and len(c)>1:
                cut=c[:lim-len(head)-2].rsplit(' ',1)[0].rstrip(',;:–-')
                if len(cut)>25: best=head+' '+cut+'…'; break
    return best[:lim+1]
def dedupe(xs):
    seen=set(); o=[]
    for x in xs:
        x=x.strip()
        if x and x.lower() not in seen: seen.add(x.lower()); o.append(x)
    return o
rows=[]
for f in sorted(glob.glob(P+'/*.html')):
    n=os.path.basename(f)[:-5]
    m=re.match(r'(album|song|book|movie|show)-',n)
    if not m: continue
    kind=m.group(1); s=open(f).read(); fm,body=s.split('\n---\n',1)
    title=json.loads(re.search(r'^title: (.*)$',fm,re.M).group(1)); name=title.split(' — ')[0]
    sub=one(r'<p class="kpg-sub">(.*?)</p>',body); who,_,yr=sub.partition(' · ')
    pills=li('kpg-pills',body); bits=li('kpg-bits',body); lead=one(r'<p class="kpg-lead">(.*?)</p>',body)
    like=one(r'<aside class="kpg-like">.*?<p>(.*?)</p>',body); F=facts(body); stats=li('kpg-stats',body)
    if not stats:
        stats=[T(x) for x in re.findall(r'<span>(.*?)</span>',one(r'(<p class="kpg-stats">.*?</p>)',body) and re.search(r'<p class="kpg-stats">(.*?)</p>',body,re.S).group(1) or '')]
    latin=re.search(r'\(([A-Za-z][^)]*)\)',name); lat=latin.group(1) if latin else ''
    cast=[c.strip() for c in (F.get('Starring','')).split(',') if c.strip()]
    if kind=='album':
        ntr=next((x for x in stats if 'track' in x),''); dur=next((x for x in stats if 'min' in x),'')
        head=f"{name} ({yr}) by {who}"+(f": {ntr}, {dur}." if ntr and dur else ".")
        cands=bits+[lead,F.get('Recorded','') and 'Recorded at '+F['Recorded']+'.' or '',like]
        kw=[name,who,f"{name} {yr}",f"{name} tracklist",f"{who} albums",f"{name} album",(F.get('Label') and f"{who} {F['Label']}") or '',*[p for p in pills if not re.match(r'\d{4}s$',p)][:3],*(f"{p} albums" for p in pills if re.match(r'\d{4}s$',p))]
    elif kind=='song':
        alb=F.get('From',''); ln=F.get('Length','')
        head=f"{name} by {who}"+(f", from {alb}" if alb and alb!=name and not alb.lower().startswith('single') else "")+(f" ({yr})" if yr else "")+(f", {ln}." if ln else ".")
        cands=bits+[lead,like]
        kw=[name,who,f"{name} {who}",f"{name} meaning" if False else f"{name} story",alb,f"{who} songs",F.get('Written by') and f"{name} written by {F['Written by'].split(',')[0]}" or '',*pills[1:]]
    elif kind=='book':
        head=f"{name} by {who}"+(f" ({yr})" if yr else "")+"."
        cands=[lead]+[b for b in bits if not re.search(r'\bpublished\b',b,re.I) or not re.search(r'\d{4}',b)]+[like]
        words=[w for w in n[5:].split('-') if w]
        kw=[name.split(' (')[0],lat,' '.join(words) if lat=='' and not name.isascii() else '',who,f"{who} books",f"{name.split(' (')[0]} book",f"{lat or name.split(' (')[0]} quotes",*pills[:3]]
        if not name.isascii() and not lat: kw.append(' '.join(w.capitalize() for w in words))
    elif kind=='movie':
        d=F.get('Directed by',who); c2=', '.join(cast[:2])
        head=f"{name} ({F.get('Year',yr)}), directed by {d}"+(f", with {c2}." if c2 else ".")
        cands=bits+[lead,like]
        kw=[name,f"{name} {F.get('Year',yr)}",f"{name} movie",d,f"{d} films",*cast[:3],*[p for p in pills if not re.match(r'\d{4}s$',p)][:2],*(f"{p} films" for p in pills if re.match(r'\d{4}s$',p))]
    else:
        cr=F.get('Created by',''); c2=', '.join(cast[:2]); net=F.get('Network','')
        head=f"{name} ({F.get('Years',yr)})"+(f", created by {cr}" if cr else "")+(f", with {c2}." if c2 else ".")
        cands=bits+[lead,like]
        kw=[name,f"{name} {F.get('Years',yr)}",f"{name} TV series",cr,net,*cast[:3],*[p for p in pills if not re.match(r'\d{4}s$',p)][:2],f"{name} cast"]
    desc=fit(head,cands)
    kw=dedupe(kw)[:12]
    rows.append((f,n,fm,body,desc,kw))
# uniqueness of descriptions
from collections import Counter
cnt=Counter(r[4] for r in rows); dup=[d for d,c in cnt.items() if c>1]
print('items',len(rows),'dup desc',len(dup),'len min/avg/max',min(len(r[4]) for r in rows),sum(len(r[4]) for r in rows)//len(rows),max(len(r[4]) for r in rows),'>160',sum(len(r[4])>160 for r in rows))
for f,n,fm,body,desc,kw in rows:
    new=re.sub(r'^description: .*$','description: '+json.dumps(desc,ensure_ascii=False),fm,flags=re.M)
    new=re.sub(r'^social: .*$','social: '+json.dumps(desc,ensure_ascii=False),new,flags=re.M)
    new=re.sub(r'^keywords: .*$','keywords: '+json.dumps(kw,ensure_ascii=False),new,flags=re.M)
    if not dry: open(f,'w').write(new+'\n---\n'+body)
if '--show' in sys.argv:
    import random; random.seed(3)
    for r in random.sample(rows,14): print(r[1],'\n  ',r[4],'\n  ',r[5])
