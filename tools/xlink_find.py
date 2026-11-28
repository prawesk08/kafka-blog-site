import re,glob,json,html,os,collections
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','content')
T=lambda s:html.unescape(re.sub(r'<[^>]+>',' ',s))
posts={}
for f in glob.glob(R+'/posts/**/*.html',recursive=True):
    s=open(f).read(); fm,b=s.split('\n---\n',1); path='/'+os.path.relpath(f,R+'/posts')
    title=re.search(r'^title: (.*)$',fm,re.M).group(1).strip('\'"'); posts[path]=(title,re.sub(r'\s+',' ',T(b)),fm)
items={}
for f in glob.glob(R+'/pages/*.html'):
    n=os.path.basename(f)[:-5]
    if not re.match(r'(album|song|book|movie|show)-',n): continue
    s=open(f).read(); fm,b=s.split('\n---\n',1); title=json.loads(re.search(r'^title: (.*)$',fm,re.M).group(1)); name=title.split(' — ')[0]
    sub=re.search(r'<p class="kpg-sub">(.*?)</p>',b); who=T(sub.group(1)).split(' · ')[0].strip() if sub else ''
    items[n]=(name,who)
GENERIC={'heat','life','time','one','the end','rome','genius','jane','blue','low','heroes','coda','presence','cosmos','emma','murphy','walden','low','blue','the office','the crown','vikings','rumours','the wall','the doors','jaws','psycho','vertigo','alikhit','gauri','rehab','shakuntal','sharanarthi','naso','kasoor','aagya','woodstock','echoes','meddle','siddhartha','sapiens','love','howl','vikings','civilisations'}
out=collections.defaultdict(list)
for n,(name,who) in items.items():
    terms=[]
    base=re.split(r' \(| · ',name)[0].strip(); lat=re.search(r'\(([A-Za-z][^)]*)\)',name)
    if re.search('[ऀ-ॿ]',base): terms.append(('title-ne',base))
    if lat: terms.append(('title',lat.group(1)))
    if base.isascii() and (base.lower() not in GENERIC or len(base)>9 and False): terms.append(('title',base))
    for p,(pt,txt,fm) in posts.items():
        sc=0;why=[]
        for k,t in terms:
            m=re.search(r'(?<![\w])'+re.escape(t)+r'(?![\w])',txt)
            if m: sc+=2;why.append(t+': …'+txt[max(0,m.start()-50):m.end()+50]+'…')
        if who and len(who.split())>1 and who not in GENERIC:
            c=len(re.findall(re.escape(who),txt))
            if c>=2: sc+=1;why.append(f'creator {who} x{c}')
        if sc>=2: out[n].append((sc,p,pt,why))
for n,v in sorted(out.items()):
    print(n, items[n])
    for sc,p,pt,why in v: print('   ',sc,p,'|',pt[:50],'|',' ; '.join(why)[:230])
print(len(out),'items with matches')
