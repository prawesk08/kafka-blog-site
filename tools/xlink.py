#!/usr/bin/env python3
"""Cross-links between item pages and the posts that genuinely mention them. Curated pairs, idempotent (<!--xl--> markers).
Item page gets a 'From my own pages' card per post; post gets an 'On my shelf' list at the end (and its translation twin too)."""
import re,json,os,html,sys
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
C=ROOT+'/content'; dry='--dry' in sys.argv
PAIRS=json.load(open('/home/claude/v180/pairs.json'))
H='/2025/04/hippies.html'; HR='/2025/04/how-many-roads-a-life-with-dylans-songs.html'; M='/2026/06/marginalia.html'; DY='/2025/10/dear-you-i-hope-you.html'; HB='/2026/02/happy-birthday.html'
PB='/2025/04/pale-blue-dot-and-its-fragments-on-this-tiny-dot-why-such-deep-divides.html'; BL='/2025/04/blue-ode-to-you_3.html'
KU='/2026/11/kushim-sukkalgir-first-names.html'; UL='/2025/08/ur-and-lagash-a-new-age-of-trade-and-warfare.html'; BA='/2025/03/booksandauthors.html'
# (post, item, note shown on the item page)
L=[(H,'album-sgt-peppers-lonely-hearts-club-band','The 1967 album appears in my essay on the hippies, from Haight-Ashbury to Kathmandu.'),
 (H,'song-the-times-they-are-a-changin','Dylan\'s song gave the hippie generation its anthem, in my essay on their road to Kathmandu.'),
 (H,'song-white-rabbit','Jefferson Airplane\'s song, in my essay on the Summer of Love and the road to Kathmandu.'),
 (H,'book-walden','Where I trace the roots of the hippie movement, from Thoreau to the Beats.'),
 (H,'book-siddhartha','Hesse was on the reading lists of the hippies camping above Kathmandu.'),
 (HR,'song-blowin-in-the-wind','The song at the start of my own Dylan story.'),
 (HR,'song-like-a-rolling-stone','On growing up with Dylan\'s songs.'),
 (HR,'song-the-times-they-are-a-changin','My uncle explained this song to me; the essay tells how.'),
 (HR,'song-visions-of-johanna','One of the Dylan songs I write about in this essay.'),
 (M,'book-the-metamorphosis','Kafka is one of the voices that speak in this poem.'),
 (M,'book-the-bell-jar','Plath is one of the voices that speak in this poem.'),
 (M,'book-letters-to-a-young-poet','Rilke is one of the voices that speak in this poem.'),
 (M,'book-mrs-dalloway','Woolf is one of the voices that speak in this poem.'),
 (DY,'book-the-metamorphosis','Kafka whispers in this letter-poem.'),
 (DY,'book-the-bell-jar','Plath whispers in this letter-poem.'),
 (DY,'book-letters-to-a-young-poet','Rilke kneels in this letter-poem.'),
 (HB,'book-the-metamorphosis','Kafka sits in his chair in this poem.'),
 (HB,'book-the-bell-jar','Sylvia and her bell jar are in this poem.'),
 (PB,'book-cosmos','More Carl Sagan: the book behind the idea of the Pale Blue Dot.'),
 (PB,'book-the-demon-haunted-world','More Carl Sagan, on thinking clearly.'),
 (BL,'album-blue','The album behind the poem.'),
 (KU,'book-sapiens-a-brief-history-of-humankind','Harari reads Kushim\'s receipt in Sapiens; my essay follows the first written names.'),
 (UL,'show-fall-of-civilizations','The podcast that inspired my Sumer series.'),
 (BA,'book-dhupi-salla','A book from my reading memoir.'),(BA,'book-naso','A book from my reading memoir.'),
 (BA,'book-masan-aamako-sapana','A book from my reading memoir.'),(BA,'book-ghanchakkar','A book from my reading memoir.')]
for p in ('/2026/11/ur-ra-lagash-vyapar-ra-yuddhako-naya-yug.html',): L.append((p,'show-fall-of-civilizations',''))
esc=lambda s:html.escape(s,quote=True); T=lambda s:html.unescape(re.sub(r'<[^>]+>','',s)).strip()
def pf(path): return C+'/posts'+path
def split(f):
    s=open(f).read(); fm,b=s.split('\n---\n',1); return fm,b
def strip_xl(b): return re.sub(r'\n?<!--xl-->.*?<!--/xl-->','',b,flags=re.S)
posts={}; items={}
for post,item,note in L:
    assert os.path.exists(pf(post)),post; assert os.path.exists(C+'/pages/%s.html'%item),item
    fm,b=split(pf(post)); posts[post]=(re.search(r'^title: (.*)$',fm,re.M).group(1).strip('\'"'),fm)
    ff,bb=split(C+'/pages/%s.html'%item); sub=T(re.search(r'<p class="kpg-sub">(.*?)</p>',bb).group(1))
    items[item]=(json.loads(re.search(r'^title: (.*)$',ff,re.M).group(1)).split(' — ')[0],sub)
KIND=lambda post,fm:'My poem' if re.search(r'Poems?|Letters|Stories',fm) else ('My memoir' if 'booksandauthors' in post else 'My essay')
# item pages
byitem={}; bypost={}
for post,item,note in L:
    byitem.setdefault(item,[]).append((post,note)); 
    for pp in {post,PAIRS.get(post)}:
        if pp and os.path.exists(pf(pp)): bypost.setdefault(pp,[]).append(item)
for item,ps in byitem.items():
    f=C+'/pages/%s.html'%item; fm,b=split(f); b=strip_xl(b); cards=''
    for post,note in ps:
        if 'href="%s"'%post in b: continue
        title,pfm=posts[post]; k=KIND(post,pfm)
        cards+='<a class="kpg-feat" href="%s"><span class="kf-k">%s</span><span class="kf-t">%s</span><span class="kf-d">%s</span><span class="kf-b">Read it ›</span></a>'%(post,k,esc(title),esc(note or 'The same piece, in Nepali.'))
    if not cards: continue
    blk='<!--xl-->'+('' if 'From my own pages' in b else '<h2>From my own pages</h2>')+cards+'<!--/xl-->\n'
    for anchor in ('<aside class="kpg-like">','<nav class="kpg-next">','<script type="application/ld+json">'):
        i=b.find(anchor)
        if i>=0: b=b[:i]+blk+b[i:]; break
    else: b=b.rstrip('\n')+'\n'+blk
    if not dry: open(f,'w').write(fm+'\n---\n'+b)
# posts
STY='margin:2.2rem 0 0;padding:.9rem 1.1rem;border:1px solid rgba(154,80,71,.28);border-radius:14px;background:rgba(154,80,71,.05)'
for post,its in bypost.items():
    f=pf(post); fm,b=split(f); b=strip_xl(b); its=list(dict.fromkeys(its))
    li=''.join('<li><a href="/p/%s.html">%s</a> <span style="opacity:.7">· %s</span></li>'%(i,esc(items[i][0]),esc(items[i][1])) for i in its)
    blk='\n<!--xl--><aside class="kx-shelf" style="%s"><p style="margin:0 0 .4rem;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;opacity:.75">On my shelf</p><ul style="margin:0;padding-left:1.1rem">%s</ul></aside><!--/xl-->'%(STY,li)
    if not dry: open(f,'w').write(fm+'\n---\n'+b.rstrip('\n')+blk+'\n')
print('items linked',len(byitem),'posts getting a shelf',len(bypost)); print(sorted(bypost))
