/* ---------- état ---------- */
const DEFAULTS={text:null,origKey:'auto',shift:0,mode:'orig',acc:'auto',capo:0,notation:'abc',inst:'guitar',font:17,view:null,hintSeen:false};
let S={...DEFAULTS};
try{Object.assign(S,JSON.parse(localStorage.getItem('detune.v2')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('detune.v2',JSON.stringify(S))}catch(e){}};

let ORIG,TARGET,DISP_KEY,useFlats,registry=[],plainOut='';

function computeKeys(chords){
  ORIG=S.origKey==='auto'?detectKey(chords):{tonic:+S.origKey.split(':')[0],minor:S.origKey.endsWith(':m')};
  TARGET={tonic:mod(ORIG.tonic+S.shift),minor:S.mode==='orig'?ORIG.minor:S.mode==='min'};
  DISP_KEY={tonic:mod(TARGET.tonic-S.capo),minor:TARGET.minor};
  useFlats=S.acc==='flat'?true:S.acc==='sharp'?false:keyUsesFlats(DISP_KEY.tonic,DISP_KEY.minor);
}

function chordSpan(d){
  registry.push(d);
  return `<span class="c${d.inKey?'':' out'}" data-i="${registry.length-1}">${esc(d.text)}</span>`;
}

/* ---------- rendu ---------- */
/* police proportionnelle : chaque accord est ancré au mot qu'il surmonte, plutôt qu'à une colonne */
const words=s=>s.match(/\s*\S+\s*|\s+/g)||[];
const cell=(label,w)=>`<span class="k"><span class="kc">${label}</span><span class="kl">${esc(w)}</span></span>`;
function anchorsHTML(pre,anchors){
  let h='<div class="pl">';
  for(const w of words(pre))h+=cell('',w);
  for(const a of anchors){
    const ws=words(a.seg);
    if(!ws.length)h+=cell(a.label,'');
    else ws.forEach((w,i)=>h+=cell(i?'':a.label,w));
  }
  return h+'</div>';
}
function tokenLabel(it){
  if(!it.d)return `<span class="sym">${esc(it.t.text)}</span>`;
  const pre=it.t.pre?`<span class="sym">${esc(it.t.pre)}</span>`:'';
  const post=it.t.post?`<span class="sym">${esc(it.t.post)}</span>`:'';
  return pre+chordSpan(it.d)+post;
}
/* version texte (copier) : on garde l'alignement en colonnes */
function chordLineText(items){
  let text='';
  for(const {t,d} of items){
    if(text.length<t.idx)text+=' '.repeat(t.idx-text.length);
    else if(text.length)text+=' ';
    text+=d?t.pre+d.text+t.post:t.text;
  }
  return text;
}

function renderSheet(src){
  const lines=src.split(/\r?\n/);
  let html='';const text=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(!line.trim()){html+='<div class="gap"></div>';text.push('');continue}
    const toks=tokenize(line);
    if(isChordLine(toks)){
      const items=toks.map(t=>({t,d:t.chord?display(transform(t.chord)):null}));
      text.push(chordLineText(items));
      const next=lines[i+1];
      if(next!=null&&next.trim()&&!isChordLine(tokenize(next))&&!SECTION.test(next)&&!/\[[^\]\s]+\]/.test(next)){
        // l'indentation des paroles sous un accord en début de ligne n'a pas de sens en proportionnel
        const lead=next.match(/^\s*/)[0].length;
        const ly=next.slice(lead),at=it=>Math.max(0,it.t.idx-lead);
        html+=anchorsHTML(ly.slice(0,at(items[0])),items.map((it,j)=>({label:tokenLabel(it),seg:ly.slice(at(it),j+1<items.length?at(items[j+1]):undefined)})));
        text.push(next);i++;
      }else html+=`<div class="bars">${items.map(tokenLabel).join('')}</div>`;
      continue;
    }
    if(SECTION.test(line)){
      html+=`<div class="sec">${esc(line.trim().replace(/^[\[{]\s*|\s*[\]}]$/g,''))}</div>`;text.push(line);continue;
    }
    const re=/\[([^\]\s]+)\]/g;let m,last=0,pre=null,t='';const anchors=[];
    while(m=re.exec(line)){
      const ch=parseChord(m[1]);if(!ch)continue;
      const chunk=line.slice(last,m.index);
      if(pre==null)pre=chunk;else anchors[anchors.length-1].seg+=chunk;
      const d=display(transform(ch));
      anchors.push({label:chordSpan(d),seg:''});
      t+=chunk+'['+d.text+']';last=m.index+m[0].length;
    }
    if(anchors.length){
      anchors[anchors.length-1].seg+=line.slice(last);
      html+=anchorsHTML(pre,anchors);text.push(t+line.slice(last));
    }else{html+=`<div class="ly">${esc(line)}</div>`;text.push(line)}
  }
  return {html,text:text.join('\n')};
}

const $=id=>document.getElementById(id);
const input=$('input'),out=$('out');

function render(){
  hideTip(true);
  const chords=collectChords(input.value);
  computeKeys(chords);
  registry=[];
  const editing=S.view==='edit'||!input.value.trim();
  $('editor').hidden=!editing;
  $('sheet').hidden=editing;
  $('dock').hidden=editing;
  $('editBtn').hidden=editing;
  if(editing)closePops();
  else{
    const r=renderSheet(input.value);
    out.innerHTML=r.html;plainOut=r.text;
  }
  renderControls(chords);
  renderScale();
  save();
}

function renderControls(chords){
  document.documentElement.style.setProperty('--fs',S.font+'px');
  const tk=keyName(TARGET.tonic,TARGET.minor);
  $('keyLbl').textContent=tk;
  $('shiftLbl').textContent=S.shift?(S.shift>0?'+':'−')+Math.abs(S.shift):'';
  $('origLbl').textContent=keyName(ORIG.tonic,ORIG.minor);
  let meta=`Tonalité <b>${tk}</b>`;
  if(S.shift||TARGET.minor!==ORIG.minor)meta+=` · originale ${keyName(ORIG.tonic,ORIG.minor)}`;
  if(S.capo)meta+=` · capo ${S.capo}, formes de <b>${keyName(DISP_KEY.tonic,DISP_KEY.minor)}</b>`;
  $('meta').innerHTML=meta;

  let g='';
  for(let t=0;t<12;t++){
    const p=mod(ORIG.tonic+t);
    g+=`<button data-k="${p}" aria-pressed="${p===TARGET.tonic}" class="${p===ORIG.tonic?'orig':''}">${keyName(p,TARGET.minor)}</button>`;
  }
  $('keyGrid').innerHTML=g;

  const o=$('origKey');
  let h=`<option value="auto">Auto · ${keyName(ORIG.tonic,ORIG.minor)}</option>`;
  for(const minor of [false,true])for(let t=0;t<12;t++)h+=`<option value="${t}:${minor?'m':'M'}">${keyName(t,minor)}</option>`;
  o.innerHTML=h;o.value=S.origKey;

  $('capoVal').textContent=S.capo;
  $('capoLbl').textContent=S.capo?'Capo '+S.capo:'Capo';
  $('fontVal').textContent=S.font;
  document.querySelectorAll('.seg').forEach(seg=>seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',S[seg.dataset.key]===b.dataset.v)));

  // suggestion de capo : maximise les accords jouables en position ouverte
  let best=0;
  if(S.inst==='guitar'&&chords.length){
    const snd=chords.map(transform);
    const easy=c=>{const p=mod(c.rootPc);return c.bassPc==null&&(c.type==='M'&&[0,2,4,7,9].includes(p)||c.type==='m'&&[2,4,9].includes(p))};
    const rate=cap=>snd.filter(c=>easy({...c,rootPc:c.rootPc-cap})).length/snd.length;
    let bestR=rate(0);
    for(let c=1;c<=7;c++){const r=rate(c);if(r>bestR+.15){best=c;bestR=r}}
  }
  const show=best&&best!==S.capo;
  $('capoDot').hidden=!show;
  $('suggest').hidden=!show;
  if(show){$('suggestTxt').textContent=`Capo ${best}, formes de ${keyName(mod(TARGET.tonic-best),TARGET.minor)}`;$('suggestBtn').dataset.capo=best}

  $('hint').classList.toggle('gone',S.hintSeen);
}

function renderScale(){
  const sc=TARGET.minor?MINOR:MAJOR,ty=TARGET.minor?MIN_T:MAJ_T;
  $('scaleTitle').innerHTML=`Accords de la gamme de <b>${keyName(DISP_KEY.tonic,DISP_KEY.minor)} ${DISP_KEY.minor?'mineur':'majeur'}</b>`;
  let h='';
  sc.forEach((iv,k)=>{
    const suf=ty[k]==='m'?'m':ty[k]==='d'?'dim':'';
    const d=display({rootPc:mod(TARGET.tonic+iv),bassPc:null,suffix:suf,...parseQuality(suf)});
    registry.push(d);
    const n=ty[k]==='M'?NUM[k]:NUM[k].toLowerCase()+(ty[k]==='d'?'°':'');
    h+=`<div class="deg" data-i="${registry.length-1}"><span class="n">${n}</span><span class="t">${esc(S.notation==='deg'?noteName(mod(DISP_KEY.tonic+iv))+suf:d.text)}</span></div>`;
  });
  $('degs').innerHTML=h;
}

/* ---------- popovers ---------- */
function closePops(){
  document.querySelectorAll('.pop').forEach(p=>p.hidden=true);
  document.querySelectorAll('[data-pop]').forEach(b=>b.setAttribute('aria-expanded','false'));
}
document.querySelectorAll('[data-pop]').forEach(b=>b.onclick=()=>{
  const p=$('pop-'+b.dataset.pop),wasOpen=!p.hidden;
  closePops();hideTip(true);
  if(!wasOpen){p.hidden=false;b.setAttribute('aria-expanded','true')}
});

/* ---------- diagramme au survol ---------- */
const tip=$('tip');let tipIdx=null,pinned=false,anchor=null;
const variant=new Map();
function tipHTML(d){
  const inst=S.inst;let body,meta='';
  if(inst==='piano')body=pianoSVG(d);
  else{
    const list=voicings(d,inst);
    if(!list.length)body=`<div class="tt-foot">Aucun doigté trouvé</div>`;
    else{
      const v=mod(variant.get(inst+d.name)||0,list.length);
      body=fretSVG(list[v],inst,d);
      if(list.length>1)meta=`${v+1} / ${list.length}  ← →`;
    }
  }
  const notes=d.ints.map(i=>noteName(mod(d.rootPc+i)));
  if(d.bassPc!=null&&!d.ints.map(i=>mod(d.rootPc+i)).includes(d.bassPc))notes.unshift(noteName(d.bassPc));
  return `<div class="tt-h"><span class="tt-name">${esc(S.notation==='deg'?d.text+' · '+d.name:d.text)}</span><span class="tt-meta">${meta}</span></div>${body}
  <div class="tt-foot"><b>${esc(notes.join(' '))}</b><br>${d.ints.map(i=>intervalLabel(i,d.ints)).join(' ')}${d.bassPc!=null?' · basse '+esc(noteName(d.bassPc)):''}</div>`;
}
function showTip(el){
  const i=+el.dataset.i,d=registry[i];if(!d)return;
  if(anchor&&anchor!==el)anchor.classList.remove('on');
  tipIdx=i;anchor=el;
  tip.innerHTML=tipHTML(d);
  const r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
  let x=r.left+r.width/2-tw/2,y=r.bottom+10;
  if(y+th>innerHeight-8)y=r.top-th-10;
  x=Math.max(8,Math.min(x,innerWidth-tw-8));y=Math.max(8,y);
  tip.style.left=x+'px';tip.style.top=y+'px';
  tip.classList.add('show');
  if(!S.hintSeen){S.hintSeen=true;$('hint').classList.add('gone');save()}
}
function hideTip(force){
  if(pinned&&!force)return;
  pinned=false;tip.classList.remove('show','pin');
  if(anchor)anchor.classList.remove('on');
  anchor=null;tipIdx=null;
}
function cycle(dir){
  if(tipIdx==null||S.inst==='piano')return;
  const k=S.inst+registry[tipIdx].name;
  variant.set(k,(variant.get(k)||0)+dir);
  showTip(anchor);
}
document.addEventListener('mouseover',e=>{
  const el=e.target.closest('[data-i]');
  if(el&&!pinned)showTip(el);
});
document.addEventListener('mouseout',e=>{
  const el=e.target.closest('[data-i]');
  if(el&&!pinned&&!el.contains(e.relatedTarget))hideTip();
});
document.addEventListener('click',e=>{
  const path=e.composedPath();
  if(!path.some(n=>n.classList&&(n.classList.contains('pop')||n.classList.contains('bar'))))closePops();
  const el=e.target.closest('[data-i]');
  if(el){
    if(pinned&&anchor===el){hideTip(true);return}
    pinned=false;showTip(el);pinned=true;tip.classList.add('pin');el.classList.add('on');return;
  }
  if(!tip.contains(e.target))hideTip(true);
});
document.addEventListener('keydown',e=>{
  if(document.activeElement===input||e.target.tagName==='SELECT')return;
  if(e.key==='ArrowRight'){cycle(1);e.preventDefault()}
  else if(e.key==='ArrowLeft'){cycle(-1);e.preventDefault()}
  else if(e.key==='Escape'){hideTip(true);closePops()}
  else if((e.key==='+'||e.key==='=')&&S.view!=='edit'){S.shift=norm(S.shift+1);render()}
  else if((e.key==='-'||e.key==='_')&&S.view!=='edit'){S.shift=norm(S.shift-1);render()}
});
addEventListener('scroll',()=>hideTip(true),{passive:true});

/* ---------- contrôles ---------- */
const norm=s=>{s=mod(s);return s>6?s-12:s};
document.querySelectorAll('[data-shift]').forEach(b=>b.onclick=()=>{S.shift=norm(S.shift+ +b.dataset.shift);render()});
document.querySelectorAll('[data-capo]').forEach(b=>b.onclick=()=>{S.capo=Math.max(0,Math.min(11,S.capo+ +b.dataset.capo));render()});
document.querySelectorAll('[data-font]').forEach(b=>b.onclick=()=>{S.font=Math.max(12,Math.min(28,S.font+ +b.dataset.font));render()});
document.querySelectorAll('.seg').forEach(seg=>seg.onclick=e=>{const b=e.target.closest('button');if(!b)return;S[seg.dataset.key]=b.dataset.v;render()});
$('keyGrid').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.shift=norm(+b.dataset.k-ORIG.tonic);render()};
$('origKey').onchange=e=>{S.origKey=e.target.value;render()};
$('suggestBtn').onclick=e=>{S.capo=+e.target.dataset.capo;render()};
$('editBtn').onclick=()=>{S.view='edit';render();input.focus()};
$('done').onclick=()=>{S.text=input.value;S.view='read';render();scrollTo(0,0)};
$('example').onclick=()=>{input.value=EXAMPLE;S.text=EXAMPLE;Object.assign(S,{origKey:'auto',shift:0,view:'read'});render()};
$('reset').onclick=()=>{Object.assign(S,{origKey:'auto',shift:0,mode:'orig',acc:'auto',capo:0,notation:'abc'});render()};
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1400)}
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(plainOut);toast('Grille copiée')}catch(e){toast('Copie impossible')}};
input.addEventListener('input',()=>{S.text=input.value;save()});

const EXAMPLE=`[Intro]
| G   D/F#  | Em   C   |

[Couplet 1]
G               D/F#
  Les néons s'éteignent sur le quai
Em                 C
  Le dernier train s'en va sans bruit
G                D/F#
  Je compte les rails, je compte les jours
Am7         C          D
  Et la ville dort encore

[Refrain]
C        G/B        Am7     G
  Tout recommence à minuit
C         D          Em   D/F#
  Sous la lumière des réverbères
C        G/B      Am7    Bm7
  On transpose nos vies
Cmaj7          Dsus4   D
  Une octave plus haut

[Pont]
[Eb]Une ligne [Bb]au format [G]ChordPro, [D7]inline`;

input.value=S.text||'';
if(S.text==null){input.value=EXAMPLE;S.view='read'}
render();
