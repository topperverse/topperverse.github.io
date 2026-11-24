// Shared crossword check animations. Puzzle state stays owned by each page adapter.
(() => {
 const desktop={matches:true};let effectContext={};
 let frame=0,canvas=null,running=false,flaps=[],lockedMain=null,previousInert=false;
 const faces=[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[4,5,1,0],[3,2,6,7]];
 const shades=[1,.64,.78,.87,1.12,.58];
 function clearFlaps(){for(const tile of flaps){tile.layer.remove();tile.input.style.visibility=tile.visibility;}flaps=[];}
 function stop(){cancelAnimationFrame(frame);frame=0;canvas?.remove();canvas=null;clearFlaps();effectContext.cleanup?.();if(lockedMain)lockedMain.inert=previousInert;lockedMain=null;running=false;}
 let flapStyle=null;
 function ensureFlapStyle(){
  if(!flapStyle){
   flapStyle=document.createElement('style');
   flapStyle.textContent=`.cof-flap{position:absolute;inset:0;z-index:2;pointer-events:none;perspective:420px;isolation:isolate}
    .cof-flap-half{position:absolute;left:0;width:100%;overflow:hidden;backface-visibility:hidden;transform-style:preserve-3d}
    .cof-flap-glyph{position:absolute;left:0;width:100%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;white-space:nowrap}
    .cof-flap-seam{position:absolute;left:0;right:0;height:1px;background:rgba(5,5,5,.14);z-index:5;pointer-events:none}`;
   document.head.appendChild(flapStyle);
  }
 }
 function flipLettersThenBurst(){
  ensureFlapStyle();
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letterInputs=effectContext.letterInputs||[...document.querySelectorAll('#grid input')];
  const order=letterInputs.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const ranks=new Map(order.map((index,rank)=>[index,rank])),tail=Math.min(4,Math.max(2,Math.ceil(letterInputs.length*.04)));
  flaps=letterInputs.map((input,index)=>{
   const rect=input.getBoundingClientRect(),style=getComputedStyle(input),cellStyle=getComputedStyle(input.parentElement);
   const h=rect.height,axis=(h+parseFloat(style.paddingTop)-parseFloat(style.paddingBottom))/2;
   const layer=document.createElement('div');layer.className='cof-flap';layer.setAttribute('aria-hidden','true');
   function half(top){
    const panel=document.createElement('div');panel.className='cof-flap-half';
    Object.assign(panel.style,{top:top?'0px':axis+'px',height:(top?axis:h-axis)+'px',background:cellStyle.backgroundColor,transformOrigin:top?'50% 100%':'50% 0%'});
    const glyph=document.createElement('span');glyph.className='cof-flap-glyph';
    Object.assign(glyph.style,{height:h+'px',top:top?'0px':-axis+'px',font:style.font,color:style.color,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,paddingLeft:style.paddingLeft,paddingRight:style.paddingRight});
    panel.appendChild(glyph);layer.appendChild(panel);return {panel,glyph};
   }
   const top=half(true),bottom=half(false),turnTop=half(true),turnBottom=half(false);
   const seam=document.createElement('span');seam.className='cof-flap-seam';seam.style.top=axis+'px';layer.appendChild(seam);
   input.parentElement.appendChild(layer);
   const visibility=input.style.visibility;input.style.visibility='hidden';
   // Most settle gradually; a few scattered holdouts keep flipping on their own.
   const rank=ranks.get(index),regular=letterInputs.length-tail;
   const settleAt=rank<regular?2600+3000*rank/Math.max(1,regular-1)+Math.random()*120:6400+1900*(rank-regular)/Math.max(1,tail-1);
   const original=input.value,letters=[original],steps=Math.max(10,Math.round(settleAt/(155+Math.random()*65)));
   for(let i=0;i<steps;i++){let letter;do{letter=alphabet[Math.floor(Math.random()*26)];}while(letter===letters.at(-1)||letter===original);letters.push(letter);}
   letters.push(original);
   let time=Math.random()*250;const transitions=[];
   const beats=letters.slice(1).map(()=>({duration:90+Math.random()*70,pause:15+Math.random()*85}));
   const factor=(settleAt-time)/beats.reduce((sum,b)=>sum+b.duration+b.pause,0);
   for(let i=0;i<beats.length;i++){const duration=beats[i].duration*factor;transitions.push({start:time,duration,from:letters[i],to:letters[i+1]});time+=duration+beats[i].pause*factor;}
   return {input,visibility,layer,top,bottom,turnTop,turnBottom,letters,transitions,end:settleAt,settled:false};
  });
  const finish=Math.max(...flaps.map(tile=>tile.end))+650;let start=null;
  function flick(now){
   if(!desktop.matches){stop();return;}
   if(start===null)start=now;const elapsed=now-start;
   for(const tile of flaps){
    if(tile.settled)continue;
    if(elapsed>=tile.end){tile.layer.remove();tile.input.style.visibility=tile.visibility;tile.settled=true;continue;}
    const step=tile.transitions.find(s=>elapsed<s.start+s.duration);
    const from=step?.from||tile.letters.at(-1),to=step?.to||from;
    const p=step?Math.max(0,Math.min(1,(elapsed-step.start)/step.duration)):1;
    tile.top.glyph.textContent=to;tile.bottom.glyph.textContent=from;
    tile.turnTop.glyph.textContent=from;tile.turnBottom.glyph.textContent=to;
    tile.turnTop.panel.style.visibility=p<.5?'visible':'hidden';
    tile.turnBottom.panel.style.visibility=p>=.5?'visible':'hidden';
    // A fast hinge snap: the old upper flap falls away, then the new lower flap lands.
    tile.turnTop.panel.style.transform='rotateX('+(-90*Math.min(1,p*2))+'deg)';
    tile.turnBottom.panel.style.transform='rotateX('+(90*(1-Math.max(0,(p-.5)*2)))+'deg)';
    tile.turnTop.panel.style.filter='brightness('+(1-.32*Math.min(1,p*2))+')';
    tile.turnBottom.panel.style.filter='brightness('+(.68+.32*Math.max(0,(p-.5)*2))+')';
   }
   if(elapsed>=finish){clearFlaps();startCubeBurst();return;}
   frame=requestAnimationFrame(flick);
  }
  frame=requestAnimationFrame(flick);
 }
 window.checkLettersWithFlaps=function(items,onSettle,onDone){
  if(!desktop.matches||!items.length)return false;
  if(running)return true;
  ensureFlapStyle();running=true;lockedMain=document.body;
  if(lockedMain){previousInert=lockedMain.inert;lockedMain.inert=true;}
  let timeline=0;
  flaps=items.map(item=>{
   const input=item.input,rect=input.getBoundingClientRect(),style=getComputedStyle(input),cellStyle=getComputedStyle(input.parentElement);
   const h=rect.height,axis=(h+parseFloat(style.paddingTop)-parseFloat(style.paddingBottom))/2;
   const layer=document.createElement('div');layer.className='cof-flap';layer.setAttribute('aria-hidden','true');
   function half(top,letter){
    const panel=document.createElement('div');panel.className='cof-flap-half';
    Object.assign(panel.style,{top:top?'0px':axis+'px',height:(top?axis:h-axis)+'px',background:cellStyle.backgroundColor,transformOrigin:top?'50% 100%':'50% 0%'});
    // Render with the same native input as the grid, rather than a flex span:
    // input and span baselines differ, especially between mobile and desktop fonts.
    const glyph=input.cloneNode(false);glyph.removeAttribute('id');glyph.removeAttribute('name');
    glyph.className='cof-check-glyph';glyph.value=letter;glyph.readOnly=true;glyph.tabIndex=-1;glyph.setAttribute('aria-hidden','true');
    Object.assign(glyph.style,{position:'absolute',left:'0px',width:'100%',height:h+'px',top:top?'0px':-axis+'px',boxSizing:'border-box',margin:'0',border:'0',borderRadius:'0',background:'transparent',outline:'none',boxShadow:'none',visibility:'inherit',pointerEvents:'none',font:style.font,lineHeight:style.lineHeight,textAlign:style.textAlign,letterSpacing:style.letterSpacing,color:style.color,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,paddingLeft:style.paddingLeft,paddingRight:style.paddingRight});
    panel.appendChild(glyph);layer.appendChild(panel);return {panel,glyph};
   }
   const top=half(true,item.to),bottom=half(false,item.from),turnTop=half(true,item.from),turnBottom=half(false,item.to);
   turnBottom.panel.style.visibility='hidden';
   const seam=document.createElement('span');seam.className='cof-flap-seam';seam.style.top=axis+'px';layer.appendChild(seam);
   layer.style.display='none';input.parentElement.appendChild(layer);const visibility=input.style.visibility;
   const slot=item.checkOffset??timeline,start=slot+222,duration=111;timeline=Math.max(timeline,slot+333);
   seam.style.background='transparent';
   return {...item,visibility,layer,top,bottom,turnTop,turnBottom,seam,baseColour:cellStyle.backgroundColor,slot,start,duration,settled:false};
  });
  let began=null;
  function tick(now){
   if(!desktop.matches){stop();onDone();return;}
   if(began===null)began=now;const elapsed=now-began;
   for(const tile of flaps){
    if(tile.settled)continue;
    const p=Math.max(0,Math.min(1,(elapsed-tile.start)/tile.duration));
    const active=elapsed>=tile.slot;
    // Leave every waiting square completely untouched until its own check begins.
    tile.layer.style.display=active?'block':'none';tile.input.style.visibility=active?'hidden':tile.visibility;
    for(const half of [tile.top,tile.bottom,tile.turnTop,tile.turnBottom])half.panel.style.background=active?'#fff':tile.baseColour;
    tile.seam.style.background=active?'rgba(5,5,5,.85)':'transparent';
    tile.seam.style.height=active?'2px':'1px';
    tile.seam.style.boxShadow=active?'0 1px 2px rgba(5,5,5,.35)':'none';
    // Keep the total 111ms flip, with a brief edge-on beat between the two snaps.
    const lift=Math.min(1,p/.38),land=Math.max(0,Math.min(1,(p-.62)/.38));
    tile.turnTop.panel.style.visibility=p<.5?'visible':'hidden';tile.turnBottom.panel.style.visibility=p>=.5?'visible':'hidden';
    tile.turnTop.panel.style.transform='rotateX('+(-90*lift)+'deg)';
    tile.turnBottom.panel.style.transform='rotateX('+(90*(1-land))+'deg)';
    tile.turnTop.panel.style.filter='brightness('+(1-.55*lift)+')';
    tile.turnBottom.panel.style.filter='brightness('+(.45+.55*land)+')';
    tile.turnTop.panel.style.boxShadow=p>0?'0 3px 4px rgba(5,5,5,.45)':'none';
    tile.turnBottom.panel.style.boxShadow=p>0&&p<1?'0 -3px 4px rgba(5,5,5,.45)':'none';
    if(p===1){tile.input.value=tile.to;tile.layer.remove();tile.input.style.visibility=tile.visibility;tile.settled=true;onSettle(tile);}
   }
   if(elapsed>=timeline){stop();onDone();return;}
   frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);return true;
 };
 let solvedDialog=null;
 function showSolvedDialog(){
  if(!desktop.matches)return;
  if(!solvedDialog){
   const style=document.createElement('style');
   style.textContent=`.cof-solved{width:min(560px,calc(100vw - 28px));max-height:calc(100dvh - 36px);overflow:auto;padding:26px;border:4px solid var(--ink);border-radius:0;background:var(--paper);color:var(--ink);box-shadow:8px 8px 0 var(--ink)}
    .cof-solved::backdrop{background:rgba(5,5,5,.28)}
    .cof-solved h2{font:700 34px/1.1 var(--mono);margin:0 0 14px}
    .cof-solved p{font:400 17px/1.5 var(--sans);margin:0 0 26px}
    .cof-solved .solved-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:2px solid var(--ink);padding-top:20px}
    .cof-solved .solved-actions>*{display:flex;align-items:center;justify-content:center;min-height:54px;padding:10px;border:2px solid var(--ink);font:700 14px/1.35 var(--mono);text-align:center;text-decoration:none;white-space:normal;cursor:pointer}
    .cof-solved .solved-admire{background:var(--yellow);color:var(--ink)}
    .cof-solved .solved-archive{background:var(--ink);color:var(--paper)}
    .cof-solved .solved-next{grid-column:1/-1;background:var(--yellow);color:var(--ink)}
    @media(max-width:600px){.cof-solved{padding:22px}.cof-solved h2{font-size:28px}.cof-solved .solved-actions{grid-template-columns:1fr}.cof-solved .solved-actions>*{min-height:46px}}
    .cof-solved .solved-actions>*:focus-visible{outline:3px solid var(--blue);outline-offset:3px}`;
   document.head.appendChild(style);
   solvedDialog=document.createElement('dialog');solvedDialog.className='cof-solved';
   solvedDialog.setAttribute('aria-labelledby','cofSolvedTitle');solvedDialog.setAttribute('aria-describedby','cofSolvedMessage');
   solvedDialog.innerHTML='<h2 id="cofSolvedTitle">Puzzle solved!</h2><p id="cofSolvedMessage">Congratulations — every answer is correct.</p><div class="solved-actions"><button type="button" class="solved-admire" autofocus>Admire your achievement</button><a class="solved-archive" href="https://topperverse.github.io/cryptic/">Return to archive</a></div>';
   solvedDialog.querySelector('.solved-admire').addEventListener('click',()=>solvedDialog.close());
   document.body.appendChild(solvedDialog);
  }
  solvedDialog.querySelector('.solved-admire').style.background=effectContext.isCube?'#fff':'var(--yellow)';
  solvedDialog.querySelector('#cofSolvedTitle').textContent=effectContext.isCube?'Side solved!':'Puzzle solved!';
  solvedDialog.querySelector('#cofSolvedMessage').textContent=effectContext.isCube?'Congratulations — every answer on this side is correct.':'Congratulations — every answer is correct.';
  let next=solvedDialog.querySelector('.solved-next');
  if(effectContext.nextSide&&!next){next=document.createElement('button');next.type='button';next.className='solved-next';next.textContent='Go to next side';next.addEventListener('click',()=>{solvedDialog.close();effectContext.nextSide?.();});solvedDialog.querySelector('.solved-actions').appendChild(next);}
  if(next)next.hidden=!effectContext.nextSide;
  if(!solvedDialog.open)solvedDialog.showModal();
 }
 function shade(rgb,factor){return 'rgb('+rgb.map(c=>Math.max(0,Math.min(255,Math.round(c*factor)))).join(',')+')';}
 function rotate([x,y,z],a,b,c){
  let v=y*Math.cos(a)-z*Math.sin(a);z=y*Math.sin(a)+z*Math.cos(a);y=v;
  v=x*Math.cos(b)+z*Math.sin(b);z=-x*Math.sin(b)+z*Math.cos(b);x=v;
  return [x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c),z];
 }
 window.celebrateCorrectPuzzle14=function(){
  if(!desktop.matches||running)return;
  running=true;lockedMain=document.body;if(lockedMain){previousInert=lockedMain.inert;lockedMain.inert=true;}
  flipLettersThenBurst();
 };
 function startCubeBurst(){
  const cells=effectContext.blocks?effectContext.blocks():[...document.querySelectorAll('#grid .block-red,#grid .block-blue,#grid .block-yellow')];
  if(!cells.length){stop();return;}
  const width=innerWidth,height=innerHeight,dpr=Math.min(devicePixelRatio||1,2),grid=effectContext.gridRect?effectContext.gridRect():document.getElementById('grid').getBoundingClientRect();
  canvas=document.createElement('canvas');canvas.className='completion-cube-burst';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:width+'px',height:height+'px',pointerEvents:'none',zIndex:'10000',opacity:'1'});
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  const cubes=cells.map((cell,index)=>{
   const r=cell.rect||cell.getBoundingClientRect(),outward=(r.x+r.width/2-(grid.x+grid.width/2))/grid.width;
   const rgb=(cell.colour||getComputedStyle(cell).backgroundColor).match(/[\d.]+/g).slice(0,3).map(Number);
   const direction=index%2?-1:1;
   return {x:r.x+r.width/2,y:r.y+r.height/2,size:r.width,rgb,
    vx:outward*400+(Math.random()-.5)*380,vy:-720-Math.random()*400,vz:80+Math.random()*140,
    spin:[direction*(1.4+Math.random()*2.3),(Math.random()-.5)*6,(Math.random()-.5)*5],delay:Math.random()*.09};
  });
  let start=null;
  function draw(now){
   if(!desktop.matches){stop();return;}
   if(start===null)start=now;
   const elapsed=(now-start)/1000;
   ctx.clearRect(0,0,width,height);const polygons=[];let visible=false;
   for(const cube of cubes){
    const t=Math.max(0,elapsed-cube.delay),x=cube.x+cube.vx*t,y=cube.y+cube.vy*t+610*t*t,z=cube.vz*t;
    if(y-cube.size*3<height)visible=true;
    const s=cube.size/2,depth=cube.size,angles=cube.spin.map(v=>v*t);
    const points=[[-s,-s,0],[s,-s,0],[s,s,0],[-s,s,0],[-s,-s,-depth],[s,-s,-depth],[s,s,-depth],[-s,s,-depth]].map(v=>{
     const [rx,ry,rz]=rotate(v,...angles);
     // Orthographic projection: rotation adds depth without enlarging the cubes.
     return {x:x+rx,y:y+ry,z:z+rz};
    });
    faces.forEach((face,i)=>polygons.push({points:face.map(k=>points[k]),depth:face.reduce((a,k)=>a+points[k].z,0)/4,colour:shade(cube.rgb,shades[i])}));
   }
   polygons.sort((a,b)=>a.depth-b.depth);
   ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.strokeStyle='#050505';
   for(const face of polygons){ctx.beginPath();face.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=face.colour;ctx.fill();ctx.stroke();}
   if(elapsed>1.3&&!visible||elapsed>4.8){stop();showSolvedDialog();return;}
   frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
 }
 window.crosswordCheckEffects={
  busy:()=>running,
  check(items,onSettle,onDone,context={}){if(running)return false;effectContext=context;return window.checkLettersWithFlaps(items,onSettle,onDone);},
  celebrate(context={}){if(running)return;effectContext=context;window.celebrateCorrectPuzzle14();}
 };
 window.addEventListener('resize',stop);
})();
