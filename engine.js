/* ---------- théorie ---------- */
const SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT =['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const LATIN={C:'Do',D:'Ré',E:'Mi',F:'Fa',G:'Sol',A:'La',B:'Si'};
const LETTER_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const MAJOR=[0,2,4,5,7,9,11], MINOR=[0,2,3,5,7,8,10];
const MAJ_T=['M','m','m','M','M','m','d'], MIN_T=['m','d','M','m','m','M','M'];
const NUM=['I','II','III','IV','V','VI','VII'];
const mod=(n,m=12)=>((n%m)+m)%m;
const accPc=a=>a==='#'||a==='♯'?1:a==='b'||a==='♭'?-1:0;
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const keyUsesFlats=(tonic,minor)=>minor?[2,7,0,5,10,3].includes(tonic):[5,10,3,8,1].includes(tonic);
const keyName=(tonic,minor)=>(keyUsesFlats(tonic,minor)?FLAT:SHARP)[tonic]+(minor?'m':'');

function parseQuality(raw){
  let s=raw.replace(/[()]/g,'').replace(/♭/g,'b').replace(/♯/g,'#');
  let third=4,fifth=7,sev=null,sus=null,m;
  const add=new Set();
  const eat=re=>{const r=s.match(re);if(r){s=s.slice(r[0].length);return r}return null};
  const extend=n=>{if(n>=9)add.add(2);if(n>=11)add.add(5);if(n>=13)add.add(9)};
  if(s==='5')return finish([0,7],'5');
  if(eat(/^(m7b5|min7b5|mi7b5|-7b5|ø7?|Ø7?)/)){third=3;fifth=6;sev=10}
  else if(m=eat(/^(dim|°|o)(7)?/)){third=3;fifth=6;if(m[2])sev=9}
  else if(eat(/^(aug|\+)/)){fifth=8}
  else if(m=eat(/^(maj|Maj|MAJ|ma|Ma|M|Δ|△|j)(7|9|11|13)?/)){if(m[2]){sev=11;extend(+m[2])}else if(/^[Δ△j]$/.test(m[1]))sev=11}
  else if(eat(/^(min|mi|m|-)/)){third=3}
  let guard=0;
  while(s.length&&guard++<12){
    if(m=eat(/^(maj|Maj|MAJ|ma|M|Δ|△)(7|9|11|13)?/)){sev=11;if(m[2])extend(+m[2]);continue}
    if(eat(/^6\/?9/)){add.add(9);add.add(2);continue}
    if(eat(/^6/)){add.add(9);continue}
    if(m=eat(/^(7|9|11|13)/)){if(sev==null)sev=10;extend(+m[1]);continue}
    if(m=eat(/^sus(2|4)?/)){sus=m[1]==='2'?2:5;continue}
    if(m=eat(/^add(2|4|9|11|13)/)){add.add({2:2,9:2,4:5,11:5,13:9}[m[1]]);continue}
    if(m=eat(/^([b#])(5|9|11|13)/)){const v=m[1]==='b'?-1:1;if(m[2]==='5')fifth=7+v;else add.add(mod({9:2,11:5,13:9}[m[2]]+v));continue}
    if(eat(/^(aug|\+)/)){fifth=8;continue}
    if(eat(/^(no3|omit3)/)){third=null;continue}
    if(eat(/^(no5|omit5)/)){fifth=null;continue}
    if(eat(/^[,\s]/))continue;
    return null;
  }
  if(sus!=null)third=sus;
  const set=new Set([0]);
  [third,fifth,sev].forEach(x=>x!=null&&set.add(x));
  add.forEach(a=>set.add(a));
  const type=third===4&&fifth===7?'M':third===3&&fifth===7?'m':third===3&&fifth===6?'d':third===4&&fifth===8?'+':'x';
  return finish([...set].sort((a,b)=>a-b),type,[0,third,sev].filter(x=>x!=null));
  function finish(ints,type,core){
    const ess=ints.length<=3?ints:ints.filter(i=>i!==7);
    return {ints,ess,core:core||ints,type};
  }
}

const CHORD_RE=/^([A-G])([#b♯♭]?)(.*?)(?:\/([A-G])([#b♯♭]?))?$/;
function parseChord(tok){
  const m=tok.match(CHORD_RE);if(!m)return null;
  const q=parseQuality(m[3]);if(!q)return null;
  return {rootPc:mod(LETTER_PC[m[1]]+accPc(m[2])),suffix:m[3],bassPc:m[4]?mod(LETTER_PC[m[4]]+accPc(m[5])):null,...q};
}

/* ---------- parsing de la grille ---------- */
const SYMBOL=/^(\|+:?|:?\|+|-+|–|\/+|%|\(?x\d+\)?|\(?\d+x\)?|N\.?C\.?|\.{2,}|\*+|>|→|\(|\))$/i;
const SECTION=/^\s*(\[[^\]]+\]|\{[^}]+\}|(intro|outro|verse|couplet|refrain|chorus|bridge|pont|pre-?chorus|pré-?refrain|solo|interlude|coda|instrumental)\b[^:]*:?)\s*$/i;
function tokenize(line){
  const toks=[],re=/\S+/g;let m;
  while(m=re.exec(line)){
    const p=m[0].match(/^([|(\[{]*)(.*?)([|)\]},.;]*)$/);
    toks.push({text:m[0],idx:m.index,pre:p[1],core:p[2],post:p[3],chord:p[2]?parseChord(p[2]):null});
  }
  return toks;
}
function isChordLine(toks){
  let n=0;
  for(let i=0;i<toks.length;i++){
    const t=toks[i];
    if(t.chord){n++;continue}
    if(SYMBOL.test(t.text)||(t.core&&SYMBOL.test(t.core))||t.core==='')continue;
    if(i===0&&/:$/.test(t.text))continue;
    return false;
  }
  return n>0;
}
function collectChords(text){
  const out=[];
  for(const line of text.split(/\r?\n/)){
    const toks=tokenize(line);
    if(isChordLine(toks))toks.forEach(t=>t.chord&&out.push(t.chord));
    else line.replace(/\[([^\]\s]+)\]/g,(_,c)=>{const ch=parseChord(c);if(ch)out.push(ch)});
  }
  return out;
}

function detectKey(chords){
  if(!chords.length)return {tonic:0,minor:false};
  const isMin=c=>c.ints.includes(3)&&!c.ints.includes(4);
  let best={score:-1};
  for(let t=0;t<12;t++)for(const minor of [false,true]){
    const sc=minor?MINOR:MAJOR,ty=minor?MIN_T:MAJ_T;let score=0;
    for(const c of chords){
      const k=sc.indexOf(mod(c.rootPc-t));
      if(k>=0){score+=(c.type===ty[k]||c.type==='x'||c.type==='5')?1:.3;if(minor&&k===4&&c.type==='M')score+=.9}
      if(c.rootPc===t&&isMin(c)===minor)score+=.3;
    }
    const f=chords[0],l=chords[chords.length-1];
    if(f.rootPc===t&&isMin(f)===minor)score+=1.5;
    if(l.rootPc===t&&isMin(l)===minor)score+=1;
    if(score>best.score)best={score,tonic:t,minor};
  }
  return {tonic:best.tonic,minor:best.minor};
}

/* transpose (et convertit le mode si besoin) vers la tonalité cible, en hauteur réelle */
function retype(suffix,from,to,k){
  let rest=suffix;
  if(from==='m')rest=rest.replace(/^(min|mi|m|-)(?!aj)/,'');
  if(from==='d')rest=rest.replace(/^(dim|°|o)/,'').replace(/^(m7b5|ø7?)/,'7');
  if(to==='m'&&/^(maj|M|Δ)7/.test(rest))rest=rest.replace(/^(maj|M|Δ)7/,'7');
  if(from==='m'&&to==='M'&&/^7/.test(rest)&&k!==4)rest='maj'+rest;
  if(from==='M'&&to!=='M'&&/^(maj|M|Δ)7/.test(rest))rest=rest.replace(/^(maj|M|Δ)7/,'7');
  if(to==='d')return /^7/.test(rest)?'m7b5'+rest.slice(1):'dim'+rest;
  return (to==='m'?'m':'')+rest;
}
function transform(ch){
  const rel=mod(ch.rootPc-ORIG.tonic);
  let rootPc=mod(TARGET.tonic+rel),suffix=ch.suffix;
  let bassPc=ch.bassPc==null?null:mod(TARGET.tonic+ch.bassPc-ORIG.tonic);
  if(ORIG.minor!==TARGET.minor){
    const src=ORIG.minor?MINOR:MAJOR,dst=TARGET.minor?MINOR:MAJOR,st=ORIG.minor?MIN_T:MAJ_T,dt=TARGET.minor?MIN_T:MAJ_T;
    const k=src.indexOf(rel);
    if(k>=0){rootPc=mod(TARGET.tonic+dst[k]);if(ch.type===st[k]&&st[k]!==dt[k])suffix=retype(suffix,st[k],dt[k],k)}
    if(ch.bassPc!=null){const kb=src.indexOf(mod(ch.bassPc-ORIG.tonic));if(kb>=0)bassPc=mod(TARGET.tonic+dst[kb])}
  }
  const q=parseQuality(suffix)||ch;
  return {rootPc,bassPc,suffix,ints:q.ints,ess:q.ess,core:q.core,type:q.type};
}
/* sonnant -> affiché (capo, orthographe, notation) */
/* hors gamme : orthographe selon le degré (bVI = Eb en G, pas D#) */
const CHROM_ACC={false:{1:'b',3:'b',6:'#',8:'b',10:'b'},true:{1:'b',4:'#',6:'b',9:'#',11:'#'}};
function spell(pc){
  if(S.acc==='auto'){
    const a=CHROM_ACC[DISP_KEY.minor][mod(pc-DISP_KEY.tonic)];
    if(a)return (a==='b'?FLAT:SHARP)[pc];
  }
  return (useFlats?FLAT:SHARP)[pc];
}
function noteName(pc){
  const n=spell(pc);
  return S.notation==='latin'?LATIN[n[0]]+n.slice(1):n;
}
function roman(pc,type){
  const deg=mod(pc-DISP_KEY.tonic),sc=DISP_KEY.minor?MINOR:MAJOR;
  let k=sc.indexOf(deg),acc='';
  if(k<0){
    const up=sc.indexOf(mod(deg-1)),dn=sc.indexOf(mod(deg+1));
    if(dn>=0){k=dn;acc='b'}else{k=up;acc='#'}
  }
  const n=NUM[k];
  return acc+((type==='m'||type==='d')?n.toLowerCase():n);
}
function display(snd){
  const rootPc=mod(snd.rootPc-S.capo),bassPc=snd.bassPc==null?null:mod(snd.bassPc-S.capo);
  let text;
  if(S.notation==='deg'){
    let suf=snd.suffix;
    if(snd.type==='m'||snd.type==='d')suf=suf.replace(/^(min|mi|m|-)(?!aj)/,'');
    if(snd.type==='d')suf=suf.replace(/^(dim|o)/,'°');
    text=roman(rootPc,snd.type)+suf+(bassPc!=null?'/'+roman(bassPc,'M'):'');
  }else{
    text=noteName(rootPc)+snd.suffix+(bassPc!=null?'/'+noteName(bassPc):'');
  }
  const name=spell(rootPc)+snd.suffix+(bassPc!=null?'/'+spell(bassPc):'');
  const sc=TARGET.minor?MINOR:MAJOR;
  return {text,name,rootPc,bassPc,ints:snd.ints,ess:snd.ess,core:snd.core,type:snd.type,inKey:sc.includes(mod(snd.rootPc-TARGET.tonic))};
}
/* ---------- diagrammes ---------- */
const TUNINGS={guitar:[40,45,50,55,59,64],ukulele:[67,60,64,69]};
const DICT={
  guitar:{C:'x32010',C7:'x32310',Cmaj7:'x32000',Cadd9:'x32030',Csus2:'x30013',Csus4:'x33011',
    D:'xx0232',Dm:'xx0231',D7:'xx0212',Dm7:'xx0211',Dmaj7:'xx0222',Dsus2:'xx0230',Dsus4:'xx0233',
    E:'022100',Em:'022000',E7:'020100',Em7:'022030',Emaj7:'021100',Esus4:'022200',
    F:'133211',Fm:'133111',F7:'131211',Fmaj7:'xx3210',
    G:'320003',G7:'320001',Gmaj7:'320002',
    A:'x02220',Am:'x02210',A7:'x02020',Am7:'x02010',Amaj7:'x02120',Asus2:'x02200',Asus4:'x02230',
    B:'x24442',Bm:'x24432',B7:'x21202'},
  ukulele:{C:'0003',C7:'0001',Cmaj7:'0002',Am:'2000',Am7:'0000',A:'2100',A7:'0100',F:'2010',Fmaj7:'2413',
    G:'0232',G7:'0212',D:'2220',Dm:'2210',D7:'2223',Em:'0432',E7:'1202',Bb:'3211',Bm:'4222'}
};
const sig=c=>c.rootPc+'|'+c.ints.join(',')+'|'+(c.bassPc??'');
const DICT_SIG={};
for(const inst in DICT){DICT_SIG[inst]={};for(const n in DICT[inst]){const c=parseChord(n);DICT_SIG[inst][sig(c)]=DICT[inst][n].split('').map(x=>x==='x'?-1:+x)}}

function analyse(fr){
  const fretted=fr.filter(f=>f>0);
  if(!fretted.length)return {fingers:0,minF:0,maxF:0,barre:null};
  const minF=Math.min(...fretted),maxF=Math.max(...fretted);
  const on=fr.map((f,i)=>f===minF?i:-1).filter(i=>i>=0);
  let barre=null,fingers=fretted.length;
  if(on.length>=2){
    const a=on[0],b=on[on.length-1];
    let ok=true;for(let i=a;i<=b;i++)if(fr[i]<minF)ok=false;
    if(ok){barre={from:a,to:b,fret:minF};fingers=1+fretted.filter(f=>f>minF).length}
  }
  return {fingers,minF,maxF,barre};
}
const vCache=new Map();
function voicings(c,inst){
  const key=inst+sig(c);
  if(vCache.has(key))return vCache.get(key);
  const tuning=TUNINGS[inst],n=tuning.length,isGtr=inst==='guitar';
  const pcs=new Set(c.ints.map(i=>mod(c.rootPc+i)));
  const bass=c.bassPc??c.rootPc;
  if(c.bassPc!=null)pcs.add(c.bassPc);
  const found=new Map();
  const run=need=>{
    for(let lo=1;lo<=12;lo++){
      const opts=tuning.map(t=>{const o=isGtr?[-1]:[];if(pcs.has(t%12))o.push(0);for(let f=lo;f<lo+4;f++)if(pcs.has((t+f)%12))o.push(f);return o});
      const cur=[];
      (function rec(i){
        if(i===n)return evalV(cur.slice(),need);
        for(const f of opts[i]){cur[i]=f;rec(i+1)}
      })(0);
    }
  };
  function evalV(fr,need){
    const k=fr.join(',');if(found.has(k))return;
    const snd=fr.map((f,i)=>f>=0?i:-1).filter(i=>i>=0);
    if(snd.length<(isGtr?4:n))return;
    const first=snd[0],last=snd[snd.length-1];
    let holes=0;for(let i=first;i<=last;i++)if(fr[i]<0)holes++;
    if(holes>1)return;
    if(isGtr&&last<n-2)return;
    const cov=new Set(snd.map(i=>(tuning[i]+fr[i])%12));
    for(const e of need)if(!cov.has(e))return;
    if(isGtr&&(tuning[first]+fr[first])%12!==bass)return;
    const a=analyse(fr);
    if(a.maxF-a.minF>3||a.fingers>4)return;
    const opens=fr.filter(f=>f===0).length;
    let score=a.minF*.9+a.fingers*.7+(n-snd.length)*.9+(pcs.size-cov.size)*2+(a.barre?1.2:0)+(a.maxF-a.minF)*.3-opens*.15;
    if(opens&&a.minF>4)score+=4;
    score+=holes*1.3;
    found.set(k,{fr,score});
  }
  const essAbs=c.ess.map(i=>mod(c.rootPc+i));
  run(essAbs);
  if(!found.size)run(c.core.map(i=>mod(c.rootPc+i)));
  if(!found.size&&!isGtr)run([c.rootPc]);
  let list=[...found.values()].sort((a,b)=>a.score-b.score).map(v=>v.fr);
  const d=DICT_SIG[inst]&&DICT_SIG[inst][sig(c)];
  if(d){const k=d.join(',');list=[d,...list.filter(v=>v.join(',')!==k)]}
  list=list.slice(0,8);
  vCache.set(key,list);
  return list;
}

function fretSVG(fr,inst,c){
  const tuning=TUNINGS[inst],n=tuning.length,a=analyse(fr);
  const base=a.maxF<=5?1:a.minF,rows=5,sx=22,fy=24,L=30,T=30;
  const W=L+(n-1)*sx+22,H=T+rows*fy+24;
  const fg='var(--fg)',bg='var(--bg)',dim='var(--dim)';
  let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,sans-serif">`;
  for(let r=0;r<=rows;r++){const y=T+r*fy;s+=`<line x1="${L}" x2="${L+(n-1)*sx}" y1="${y}" y2="${y}" stroke="${r===0&&base===1?fg:dim}" stroke-width="${r===0&&base===1?4:1}"/>`}
  for(let i=0;i<n;i++){const x=L+i*sx;s+=`<line x1="${x}" x2="${x}" y1="${T}" y2="${T+rows*fy}" stroke="${dim}" stroke-width="1"/>`}
  if(base>1)s+=`<text x="${L-10}" y="${T+fy*.5+4}" font-size="10" fill="${fg}" text-anchor="end">${base}</text>`;
  if(a.barre&&a.barre.to>a.barre.from){
    const y=T+(a.barre.fret-base+.5)*fy;
    s+=`<rect x="${L+a.barre.from*sx-8}" y="${y-8}" width="${(a.barre.to-a.barre.from)*sx+16}" height="16" rx="8" fill="${fg}"/>`;
  }
  fr.forEach((f,i)=>{
    const x=L+i*sx,pc=f>=0?(tuning[i]+f)%12:null,root=pc===c.rootPc;
    if(f<0)s+=`<text x="${x}" y="${T-11}" font-size="11" fill="${dim}" text-anchor="middle">×</text>`;
    else if(f===0)s+=root?`<rect x="${x-4}" y="${T-19}" width="8" height="8" fill="none" stroke="${fg}" stroke-width="1.5"/>`:`<circle cx="${x}" cy="${T-15}" r="4" fill="none" stroke="${fg}" stroke-width="1.5"/>`;
    else{
      const y=T+(f-base+.5)*fy;
      s+=root?`<rect x="${x-7}" y="${y-7}" width="14" height="14" fill="${fg}"/><rect x="${x-3}" y="${y-3}" width="6" height="6" fill="${bg}"/>`:`<circle cx="${x}" cy="${y}" r="7" fill="${fg}"/>`;
    }
    if(pc!=null)s+=`<text x="${x}" y="${H-6}" font-size="10" fill="${dim}" text-anchor="middle">${esc(noteName(pc).replace('Ré','Re'))}</text>`;
  });
  return s+'</svg>';
}
function pianoSVG(c){
  const notes=[];
  let base=c.bassPc!=null?c.bassPc:c.rootPc;
  if(c.bassPc!=null)notes.push(base);
  const r0=c.bassPc!=null?base+mod(c.rootPc-base):c.rootPc;
  c.ints.forEach(i=>notes.push(r0+i));
  const top=Math.max(...notes),oct=top>=24?3:2;
  const ww=16,wh=72,bw=10,bh=44,W=oct*7*ww+1,H=wh+2;
  const on=new Set(notes),whites=[0,2,4,5,7,9,11];
  let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  for(let o=0;o<oct;o++)whites.forEach((p,k)=>{const x=(o*7+k)*ww,m=o*12+p;s+=`<rect x="${x+.5}" y=".5" width="${ww}" height="${wh}" fill="${on.has(m)?'var(--fg)':'var(--bg)'}" stroke="var(--dim)"/>`;if(m===r0)s+=`<rect x="${x+5}" y="${wh-14}" width="6" height="6" fill="var(--bg)"/>`});
  for(let o=0;o<oct;o++)[1,3,6,8,10].forEach(p=>{const k=whites.indexOf(p-1),x=(o*7+k+1)*ww-bw/2,m=o*12+p;s+=`<rect x="${x+.5}" y=".5" width="${bw}" height="${bh}" fill="${on.has(m)?'var(--fg)':'var(--dim)'}" stroke="var(--dim)"/>`;if(on.has(m))s+=`<rect x="${x+2.5}" y="${bh-9}" width="6" height="6" fill="${m===r0?'var(--bg)':'var(--fg)'}"/>`});
  return s+'</svg>';
}
function intervalLabel(i,ints){
  const has=x=>ints.includes(x),sev=has(10)||has(11)||(has(9)&&has(6)&&has(3));
  return ({0:'1',1:'♭9',2:sev?'9':'2',3:has(4)?'♯9':'♭3',4:'3',5:sev&&has(4)?'11':'4',6:has(7)?'♯11':'♭5',7:'5',8:has(7)?'♭13':'♯5',9:sev&&!(has(6)&&has(3)&&!has(7))?'13':(has(6)&&has(3)?'°7':'6'),10:'♭7',11:'7'})[i];
}

