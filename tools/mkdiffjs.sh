#!/bin/sh
# usage: tools/mkdiffjs.sh dist/file.html /live/path  -> prints JS to run in the browser on www.kafka.blog
B64=$(node tools/sig-local.cjs "$1" | gzip -9 | base64 -w0)
FN=$(sed '/if (typeof module/d' tools/sig.js)
cat <<JS
$FN
const mine=await new Response(new Blob([Uint8Array.from(atob('$B64'),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
const live=SIG(new DOMParser().parseFromString(await fetch('$2').then(r=>r.text()),'text/html'));
const a=live.split('\n'),b=mine.split('\n');const n=a.length,m=b.length;const L=Array.from({length:n+1},()=>new Uint16Array(m+1));
for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=a[i]===b[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
const d=[];let i=0,j=0;while(i<n&&j<m){if(a[i]===b[j]){i++;j++}else if(L[i+1][j]>=L[i][j+1])d.push('- '+a[i++]);else d.push('+ '+b[j++])}
while(i<n)d.push('- '+a[i++]);while(j<m)d.push('+ '+b[j++]);
'live '+n+' mine '+m+' diff '+d.length+'\n'+d.join('\n')
JS
