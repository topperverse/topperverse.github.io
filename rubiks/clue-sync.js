// Classic HTML pages are the sole editable clue sources. This reader never runs
// their scripts. The complete cube and its embedded clues still work offline.
const CLASSIC_CLUE_SOURCES=Object.freeze({1:'../cryptic/cryptic_crossword_interactive.html',2:'../cryptic/doms_cryptic_2.html',3:'../cryptic/doms_cryptic_3.html',4:'../cryptic/doms_cryptic_4.html',5:'../cryptic/doms_cryptic_5.html',6:'../cryptic/doms_cryptic_6.html'});
function classicJSONLiteral(html,name){
 const expression=new RegExp('\\b(?:const|let|var)\\s+'+name+'\\s*=\\s*'),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
 for(const [,script]of scripts){const match=expression.exec(script);if(!match)continue;const start=match.index+match[0].length;if(!'[{'.includes(script[start]))throw Error('Expected JSON literal for '+name);let stack=[],quoted=false,escaped=false;
  for(let i=start;i<script.length;i++){const ch=script[i];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue}if(ch==='"'){quoted=true;continue}if(ch==='['||ch==='{')stack.push(ch);else if(ch===']'||ch==='}'){const opening=stack.pop();if(opening!==(ch===']'?'[':'{'))throw Error('Invalid JSON structure');if(!stack.length)return JSON.parse(script.slice(start,i+1).replace(/"(?:\\.|[^"\\])*"|([A-Za-z_$][\w$]*)(\s*:)/g,(token,key,colon)=>key?JSON.stringify(key)+colon:token));}}
  throw Error('Unterminated '+name);
 }throw Error('Missing classic puzzle data: '+name);
}
function classicClueSnapshot(html){return {pattern:classicJSONLiteral(html,'gridPattern'),numbers:classicJSONLiteral(html,'numbers'),answers:classicJSONLiteral(html,'answers'),clues:classicJSONLiteral(html,'clueText')};}
function validClassicClues(snapshot,puzzle){
 const sameObject=(a,b)=>a&&b&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>a[k]===b[k]);
 if(!snapshot||JSON.stringify(snapshot.pattern)!==JSON.stringify(puzzle.pattern)||!sameObject(snapshot.numbers,puzzle.numbers))throw Error('Classic grid differs from cube; rebuild geometry before syncing');
 for(const dir of ['across','down']){
  if(!sameObject(snapshot.answers?.[dir],puzzle.answers[dir]))throw Error('Classic answers differ from cube; rebuild letter links before syncing');
  const rows=snapshot.clues?.[dir],expected=puzzle.clues[dir];if(!Array.isArray(rows)||rows.length!==expected.length)throw Error('Clue count differs');
  for(let i=0;i<rows.length;i++)if(!Array.isArray(rows[i])||rows[i].length!==2||String(rows[i][0])!==String(expected[i][0])||typeof rows[i][1]!=='string'||!rows[i][1].trim())throw Error('Invalid classic clue '+dir+' '+i);
 }
 return snapshot;
}
const classicClueCacheKey='cryptics-cube-classic-clues-v1';
function applyClassicClues(puzzle,snapshot){
 validClassicClues(snapshot,puzzle);let changed=false;
 for(const dir of ['across','down']){const rows=snapshot.clues[dir].map(([number,text])=>[String(number),text]);if(JSON.stringify(puzzle.clues[dir])!==JSON.stringify(rows))changed=true;puzzle.clues[dir]=rows;const fi=model.faces.findIndex(f=>f.puzzle.id===puzzle.id);for(const [number,text]of rows)entries[fi][dir].get(number).text=text;}
 return changed;
}
function restoreClassicClueCache(){let changed=false;try{const cached=JSON.parse(localStorage.getItem(classicClueCacheKey)||'{}');for(const puzzle of DATA.puzzles)if(cached[puzzle.id])try{changed=applyClassicClues(puzzle,cached[puzzle.id])||changed}catch{}}catch{}if(changed){renderClues();refreshUI();}}
let classicClueSyncPending=null,classicClueSyncLastStarted=0;
function syncClassicClues(force=false){
 if(typeof location==='undefined'||!/^https?:$/.test(location.protocol)||typeof fetch!=='function')return Promise.resolve([]);
 if(classicClueSyncPending)return classicClueSyncPending;if(!force&&Date.now()-classicClueSyncLastStarted<30000)return Promise.resolve([]);classicClueSyncLastStarted=Date.now();
 classicClueSyncPending=(async()=>{
  const updates=await Promise.allSettled(DATA.puzzles.map(async puzzle=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);try{const response=await fetch(CLASSIC_CLUE_SOURCES[puzzle.id],{cache:'no-cache',credentials:'same-origin',signal:controller.signal});if(!response.ok)throw Error('Classic clue fetch failed: '+response.status);return {puzzle,snapshot:validClassicClues(classicClueSnapshot(await response.text()),puzzle)}}finally{clearTimeout(timer)}}));
  let changed=false,cached={};try{cached=JSON.parse(localStorage.getItem(classicClueCacheKey)||'{}');if(!cached||typeof cached!=='object'||Array.isArray(cached))cached={}}catch{}
  for(const update of updates)if(update.status==='fulfilled'){const {puzzle,snapshot}=update.value;changed=applyClassicClues(puzzle,snapshot)||changed;cached[puzzle.id]=snapshot;}
  try{localStorage.setItem(classicClueCacheKey,JSON.stringify(cached))}catch{}
  if(changed){renderClues();refreshUI();}
  return updates.map((update,i)=>({puzzle:DATA.puzzles[i].id,updated:update.status==='fulfilled'}));
 })().finally(()=>{classicClueSyncPending=null});return classicClueSyncPending;
}
restoreClassicClueCache();
syncClassicClues();
window.addEventListener('focus',()=>syncClassicClues());
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')syncClassicClues()});
