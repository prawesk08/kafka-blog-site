#!/usr/bin/env python3
"""Compile the Blogger theme XML (the live Kafkaintherun theme) into src/layouts/Theme.astro.

Everything outside the Blogger widgets (head, header, nav, hero, sidebar boxes, footer, every inline
script and style, the per-URL titles/descriptions/hreflang blocks) is carried over as-is; Blogger's
<b:if> conditions become Astro expressions over a `view` object with the same fields as Blogger's
data:view. The widgets (Blog1, PopularPosts1, Text1, BlogArchive1, Label1, Attribution1) are rendered
by src/components/Widget.astro from the post data.

Usage: python3 scripts/compile-theme.py theme.xml src/layouts/Theme.astro
"""
import re, sys, json, html
from lxml import etree

B = '{http://www.google.com/2005/gml/b}'
DATA = '{http://www.google.com/2005/gml/data}'
EXPR = '{http://www.google.com/2005/gml/expr}'
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr'}

STR = re.compile(r'"(?:[^"\\]|\\.)*"')

def expr(e):
    """Blogger expression -> JS expression."""
    out = []; pos = 0
    for m in STR.finditer(e):
        out.append(conv(e[pos:m.start()])); out.append(json.dumps(json.loads(m.group(0)))); pos = m.end()
    out.append(conv(e[pos:]))
    return ''.join(out).strip()

def dpath(p):
    if p.endswith('.jsonEscaped'): return 'J(D.' + p[:-12] + ')'
    if p.endswith('.escaped'): return 'D.' + p[:-8]
    return 'D.' + p

def conv(t):
    t = re.sub(r'\bdata:([A-Za-z_][\w.]*)', lambda m: dpath(m.group(1)), t)
    t = re.sub(r'\band\b', '&&', t); t = re.sub(r'\bor\b', '||', t)
    t = re.sub(r'\bnot\b\s*', '!', t)
    t = re.sub(r'(?<![=!<>])==(?!=)', '===', t); t = re.sub(r'!=(?!=)', '!==', t)
    return t

def text(s):
    if not s: return ''
    s = html.escape(s, quote=False)
    return s.replace('{', "{'{'}").replace('}', "{'}'}")

def attrs(el):
    parts = []
    for k, v in el.attrib.items():
        if k.startswith(B): continue
        if k.startswith(EXPR):
            parts.append(f'{k[len(EXPR):]}={{{expr(v)}}}')
        elif k.startswith('{'):
            continue
        elif '{' in v or '}' in v or '"' in v:
            parts.append(f'{k}={{{json.dumps(v, ensure_ascii=False)}}}')
        else:
            parts.append(f'{k}="{html.escape(v, quote=True)}"')
    return (' ' + ' '.join(parts)) if parts else ''

def raw_inner(el):
    """Raw text of script/style; data: children become ${...} pieces of a template literal."""
    if len(el) == 0:
        return None, el.text or ''
    pieces = [el.text or '']
    for c in el:
        if c.tag.startswith(DATA):
            pieces.append('${' + dpath(c.tag[len(DATA):]) + '}')
        else:
            raise ValueError('unexpected element in script: ' + c.tag)
        pieces.append(c.tail or '')
    js = ''.join(p if p.startswith('${') else p.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${') for p in pieces)
    return '`' + js + '`', None

def node(el, out):
    tag = el.tag
    if not isinstance(tag, str):   # comment / PI
        return
    if tag == B + 'if':
        branches = [[el.get('cond'), []]]
        cur = branches[0][1]
        if el.text: cur.append(('t', el.text))
        for c in el:
            if c.tag == B + 'elseif':
                branches.append([c.get('cond'), []]); cur = branches[-1][1]
            elif c.tag == B + 'else':
                branches.append([None, []]); cur = branches[-1][1]
            else:
                cur.append(('e', c))
            if c.tail: cur.append(('t', c.tail))
        s = '{'
        for cond, items in branches:
            body = []
            for kind, x in items:
                if kind == 't': body.append(text(x))
                else: node(x, body)
            frag = '<Fragment>' + ''.join(body) + '</Fragment>'
            if cond is None: s += f'({frag})'
            else: s += f'({expr(cond)}) ? ({frag}) : '
        if branches[-1][0] is not None: s += 'null'
        s += '}'
        out.append(s); return
    if tag == B + 'section':
        wid = [w for w in el if isinstance(w.tag, str) and w.tag == B + 'widget' and w.get('visible') != 'false']
        cls = (el.get('class') or '') + (' no-items' if not wid else '') + ' section'
        out.append(f'<div class="{cls.strip()}" id="{el.get("id")}">')
        for w in wid:
            out.append(f'<Widget type="{w.get("type")}" id="{w.get("id")}" title={{{json.dumps(w.get("title") or "", ensure_ascii=False)}}} D={{D}} />')
        out.append('</div>'); return
    if tag.startswith(B):
        if tag in (B + 'skin', B + 'template-skin'): return
        raise ValueError('unhandled ' + tag)
    if tag.startswith(DATA):
        out.append('{' + dpath(tag[len(DATA):]) + '}'); return
    name = tag.split('}')[-1]
    if name in ('script', 'style'):
        tmpl, raw = raw_inner(el)
        a = attrs(el)
        if tmpl is not None:
            out.append(f'<{name} is:inline{a} set:html={{{tmpl}}}></{name}>')
        else:
            out.append(f'<{name} is:inline{a}>{raw}</{name}>')
        return
    if name == 'title':   # RCDATA in Astro: build the title as one string expression
        out.append(f'<title>{{{jsstr_children(el)}}}</title>'); return
    out.append(f'<{name}{attrs(el)}>')
    if name in VOID and not len(el) and not el.text:
        return
    out.append(text(el.text))
    for c in el:
        node(c, out)
        out.append(text(c.tail))
    out.append(f'</{name}>')

def jsstr_children(el):
    parts = [json.dumps(el.text or '', ensure_ascii=False)]
    for c in el:
        parts.append(jsstr(c)); parts.append(json.dumps(c.tail or '', ensure_ascii=False))
    return '(' + ' + '.join(parts) + ')'

def jsstr(el):
    tag = el.tag
    if not isinstance(tag, str): return '""'
    if tag.startswith(DATA): return 'String(' + dpath(tag[len(DATA):]) + ')'
    if tag == B + 'if':
        branches = [[el.get('cond'), [json.dumps(el.text or '', ensure_ascii=False)]]]
        for c in el:
            if c.tag == B + 'elseif': branches.append([c.get('cond'), []])
            elif c.tag == B + 'else': branches.append([None, []])
            else: branches[-1][1].append(jsstr(c))
            branches[-1][1].append(json.dumps(c.tail or '', ensure_ascii=False))
        s = ''
        for cond, items in branches:
            body = '(' + ' + '.join(items or ['""']) + ')'
            s += body if cond is None else f'({expr(cond)}) ? {body} : '
        if branches[-1][0] is not None: s += '""'
        return '(' + s + ')'
    raise ValueError('unexpected in title: ' + tag)

def main(src, dst):
    parser = etree.XMLParser(strip_cdata=True, remove_comments=True, resolve_entities=False, huge_tree=True)
    root = etree.parse(src, parser).getroot()
    head = root.find('{http://www.w3.org/1999/xhtml}head')
    body = root.find('{http://www.w3.org/1999/xhtml}body')
    # strip the xhtml namespace from every tag
    for e in root.iter():
        if isinstance(e.tag, str) and e.tag.startswith('{http://www.w3.org/1999/xhtml}'):
            e.tag = e.tag.split('}')[1]
    out = []
    for part in (head, body):
        sub = []
        node(part, sub)
        out.append(''.join(sub))
    # Blogger added the AdSense auto-ads loader itself; on our own host the page loads it directly.
    ADS = '<script is:inline async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9227280103943233" crossorigin="anonymous"></script>'
    out[0] = out[0][:out[0].rindex('</head>')] + ADS + '</head>'
    lang = root.get('lang', 'en')
    fm = ('---\n// GENERATED by scripts/compile-theme.py from the Blogger theme. Do not edit by hand;\n'
          '// edit the theme XML (or the widgets in src/components) and re-run the script.\n'
          "import Widget from '../components/Widget.astro';\n"
          'const { D } = Astro.props;\n'
          'const J = (s) => JSON.stringify(String(s ?? \'\')).slice(1, -1);\n---\n')
    page = fm + f'<!DOCTYPE html>\n<html lang="{lang}">' + out[0] + out[1] + '</html>\n'
    open(dst, 'w').write(page)
    print('wrote', dst, len(page))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

# ---- static fragments of the Blog widget, used by src/components/Widget.astro ----
def fragments(src, dst):
    parser = etree.XMLParser(strip_cdata=True, remove_comments=True, huge_tree=True)
    root = etree.parse(src, parser).getroot()
    for e in root.iter():
        if isinstance(e.tag, str) and e.tag.startswith('{http://www.w3.org/1999/xhtml}'):
            e.tag = e.tag.split('}')[1]
    inc = root.xpath("//b:widget[@id='Blog1']/b:includable[@id='kafkaPost']", namespaces={'b': B[1:-1]})[0]
    out = {}
    for div in inc.iter('div'):
        c = div.get('class') or ''
        if c == 'share kshare top': out['shareTop'] = etree.tostring(div, method='html', encoding='unicode', with_tail=False)
        if c == 'share kshare end': out['shareEnd'] = etree.tostring(div, method='html', encoding='unicode', with_tail=False)
    scripts = [s for s in inc.iter('script') if not s.get('type')]
    out['afterArticleScript'] = scripts[0].text if scripts else ''
    for k in ('shareTop', 'shareEnd'):
        out[k] = re.sub(r' xmlns(:\w+)?="[^"]*"', '', out[k])
    json.dump(out, open(dst, 'w'), ensure_ascii=False, indent=1)
    print('wrote', dst)

if __name__ == '__main__' and len(sys.argv) > 3:
    fragments(sys.argv[1], sys.argv[3])
