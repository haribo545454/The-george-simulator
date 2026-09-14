import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {POINTS,KEY,addScore,rank,readScores,bankScore,isInstantBarred,resultMessage} from './dist/engine.js';
let checks=0;const check=(condition,message)=>{assert.ok(condition,message);checks++};
const ids=['harris','canny','onecan','chenzo','chorls','clayto'];
const jukeboxFiles={
 harris:'assets/jukebox/harris-american-pie.m4a',
 chenzo:'assets/jukebox/chenzo-summer-69.m4a',
 chorls:'assets/jukebox/chorls-foo.m4a',
 canny:'assets/jukebox/canny-mungo.m4a',
 onecan:'assets/jukebox/onecan-coldplay.m4a',
 clayto:'assets/jukebox/clayto-kol.m4a'
};
const cannyFiles={
 pint:'assets/canny/one-none.m4a',
 shot:'assets/canny/djouf.m4a',
 scratchings:'assets/canny/like-you.m4a'
};
const karaokeFiles={harris:['assets/karaoke/harris-bobby-darrin.m4a','assets/karaoke/harris-rem.m4a','assets/karaoke/harris-the-clash.m4a'],chenzo:['assets/karaoke/chenzo-bryan-adams.m4a','assets/karaoke/chenzo-guns-roses.m4a','assets/karaoke/chenzo-u2.m4a'],clayto:['assets/karaoke/clayto-kings-of-leon.m4a','assets/karaoke/clayto-the-hives.m4a','assets/karaoke/clayto-razorlight.m4a'],canny:['assets/karaoke/canny-mungo-jerry.m4a','assets/karaoke/canny-jurassic-5.m4a','assets/karaoke/canny-bobby-mcferrin.m4a'],chorls:['assets/karaoke/chorls-thin-lizzy.m4a','assets/karaoke/chorls-afroman.m4a','assets/karaoke/chorls-oasis.m4a'],onecan:['assets/karaoke/onecan-coldplay1.m4a','assets/karaoke/onecan-coldplay2.m4a','assets/karaoke/onecan-keane.m4a']};
const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
for(let total=0;total<27;total++)for(const [action,points]of Object.entries(POINTS)){
 const r=addScore(total,action);check(r.score===total+points,'action points');check(r.barred===(total+points>=27),'exact and overshoot boundary');
}
for(const score of [10,26,2,25,0,18,24,3,7,20,21,23])bankScore(storage,readScores(storage),'Regular',score);
check(readScores(storage).length===10,'top ten');check(readScores(storage)[0].score===26,'descending rank');
assert.throws(()=>bankScore(storage,[],'Barred',27));checks++;
storage.setItem(KEY,'bad json');check(readScores(storage).length===0,'corrupt storage recovery');storage.setItem(KEY,'[]');
const source=fs.readFileSync('dist/app.js','utf8').replace(/^import .*;\n/,'');
const style=fs.readFileSync('dist/style.css','utf8');
check(/\.action-scene\.jukebox \.actor\{[^}]*animation:dance \.45s ease-in-out infinite\}/.test(style),'jukebox animation loops for full track');
check(/\.action-scene\.pint \.actor-canny\{[^}]*animation:gulp 1s ease-in-out infinite\}/.test(style),'Canny pint animation loops for full track');
check(/\.action-scene\.shot \.actor-canny\{[^}]*animation:shot 1\.2s ease-in-out infinite\}/.test(style),'Canny shot animation loops for full track');
check(/\.action-scene\.scratchings \.actor-canny\{[^}]*animation:crunch \.38s ease-in-out infinite\}/.test(style),'Canny scratchings animation loops for full track');
let ctx,root,elements,timers,decoded,holds,music,audioPlays,reactionStarts;
function boot(blocked=[]){
 reactionStarts=[];timers=[];elements=new Map();decoded=new Set();holds=new Map();audioPlays=[];
 root={append(){},className:'',_html:'',set innerHTML(value){this._html=value;elements.clear()},get innerHTML(){return this._html},
 querySelector(sel){if(sel==='form'&&!this._html.includes('<form'))return null;if(!elements.has(sel))elements.set(sel,{dataset:{},elements:{nickname:{value:'Regular'}},append(){}});return elements.get(sel)},
 querySelectorAll(selector){return (selector==='[data-character]'?ids:selector==='[data-karaoke]'?['0','1','2']:Object.keys(POINTS).concat('karaoke','leave')).map(id=>{const e=this.querySelector(id);e.dataset[selector==='[data-character]'?'character':selector==='[data-karaoke]'?'karaoke':'action']=id;return e})}};
 class FakeImage{decode(){check(!this.src.endsWith('.m4a'),'audio is never loaded as an image');check(fs.existsSync('dist/'+this.src),'referenced image exists: '+this.src);if(blocked.includes(this.src))return new Promise((resolve,reject)=>holds.set(this.src,{resolve:()=>{decoded.add(this.src);resolve()},reject}));decoded.add(this.src);return Promise.resolve()}}
 class FakeAudio{
  constructor(src=''){this.src=src;this.paused=true;this.currentTime=0;this.duration=.01;this.readyState=2;this.events={};this.preload='';this.volume=1;this.muted=false;if(src.endsWith('cheers.m4a'))music=this}
  load(){}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn)}
  removeEventListener(type,fn){this.events[type]=(this.events[type]??[]).filter(candidate=>candidate!==fn)}
  play(){this.paused=false;audioPlays.push({src:this.src,muted:this.muted});return Promise.resolve()}
  pause(){this.paused=true}
 }
 class ReactionContext{
  constructor(){this.currentTime=42;this.destination={}}
  resume(){return Promise.resolve()}
  decodeAudioData(data){return Promise.resolve({src:data,duration:data.includes('pass')?6.6:10.7})}
  createGain(){return {gain:{value:1},connect(){},disconnect(){}}}
  createBufferSource(){return {connect(){},disconnect(){this.disconnected=true},stop(){this.stopped=true},start(time){reactionStarts.push({src:this.buffer.src,time,source:this});timers.push(()=>this.onended?.())}}}
 }
 ctx=vm.createContext({document:{querySelector:()=>root,addEventListener(){},createElement(){return {setAttribute(){}}}},window:{localStorage:storage,AudioContext:ReactionContext},fetch:async src=>({ok:fs.existsSync('dist/'+src),arrayBuffer:async()=>src}),Image:FakeImage,Audio:FakeAudio,POINTS,addScore,readScores,bankScore,isInstantBarred,resultMessage,setTimeout:f=>timers.push(f),clearTimeout(){},Math,Date,Promise});vm.runInContext(source,ctx);
}
const run=s=>vm.runInContext(s,ctx),click=sel=>root.querySelector(sel).onclick();
const tick=()=>new Promise(r=>setImmediate(r));
const settle=async()=>{for(let i=0;i<12;i++){await tick();while(timers.length)timers.shift()()}await tick()};
async function enter(id='harris'){
 check(run('screen')==='front','run starts at front');click('#continue');check(root.innerHTML.includes('side.png'),'side entrance');click('#continue');
 check(root.innerHTML.includes('bar.png'),'bar selection');for(const c of ids)check(root.innerHTML.includes('portrait-'+c+'.png'),'correct selector portrait '+c);
 await click(id);check(run('character')===id,'selected character');check(run('screen')==='pool','idle ready');check(music.paused,'opening music stopped');
 check(!root.innerHTML.includes('result-score')&&!root.innerHTML.includes('class="score"'),'score hidden in gameplay');
}
function currentPose(n,id=run('character')){return `assets/${id==='harris'?'':id+'/'}pose-${n}.png`}
async function action(name){click(name);await tick()}
boot();await enter();
for(const [id,file] of Object.entries(jukeboxFiles))check(run(`jukeboxTracks['${id}']`)===file,'exact jukebox mapping '+id);
for(const [action,file] of Object.entries(cannyFiles))check(run(`cannyActionTracks['${action}']`)===file,'exact Canny action mapping '+action);
for(const [id,files] of Object.entries(karaokeFiles))files.forEach((file,index)=>check(run(`karaokeTracks['${id}'][${index}]`)===file,'exact karaoke mapping '+id+' '+index));
for(const [id,files] of Object.entries(karaokeFiles))files.forEach((file,index)=>check(run(`karaokeTracks['${id}'][${index}]`)===file,'exact karaoke mapping '+id+' '+index));
for(const name of Object.keys(POINTS)){const before=run('score');await action(name);check(root.className.includes(name),'visible action sequence');check(root.innerHTML.includes(currentPose({pint:1,shot:2,scratchings:3,jukebox:4}[name])),'correct pose');await settle();check(run('score')===before+POINTS[name],'button points');check(run('screen')==='pool','return idle')}
check(run('pints')===1&&run('shots')===1,'alcohol-only counters');click('leave');check(readScores(storage)[0].score===10,'leave banks immediately');
let form=root.querySelector('form');form.elements.nickname.value='Mike <3';form.onsubmit({preventDefault(){}});check(readScores(storage)[0].name==='Mike <3','nickname stored');check(root.innerHTML.includes('Mike &lt;3'),'nickname escaped');check(readScores(storage).length===1,'no duplicate after name save');
click('#replay');check(run('score===0&&pints===0&&shots===0&&character===null'),'replay resets current-run state');boot();check(run('scores[0].name')==='Mike <3','refresh persistence');
for(const id of ids){
 run('restart()');await enter(id);check(root.innerHTML.includes(currentPose(0,id)),'correct seated image');
 for(const [name,pose] of Object.entries({pint:1,shot:2,scratchings:3,jukebox:4})){
 run('score=0;pints=0;shots=0;busy=false;renderPool()');const previous=JSON.stringify(readScores(storage));const playsBefore=audioPlays.length;await action(name);
  const instant=isInstantBarred(id,name);check(root.innerHTML.includes(currentPose(instant?5:pose,id)),'selected character action '+id+' '+name);
  check(decoded.has(currentPose(instant?5:pose,id)),'art decoded before action');check(root.innerHTML.includes('decoding="sync"'),'synchronous paint of cached art');
  if(name==='jukebox'&&!instant){check(run('activeJukebox!==null'),'jukebox track held during scene');check(audioPlays.at(-1)?.src===jukeboxFiles[id],'selected character jukebox track played');}
  if(id==='canny'&&cannyFiles[name]){check(run('activeCannyAction!==null'),'Canny action track held during scene');check(audioPlays.at(-1)?.src===cannyFiles[name],'Canny action track played');}
  if(id!=='canny'&&cannyFiles[name])check(audioPlays.length===playsBefore,'non-Canny action has no Canny track');
  if(instant)check(!root.className.includes(name),'Onecan alcohol directly retches');
  await settle();check(run('character')===id,'identity retained');check(run('screen')===(instant?'barred':'pool'),'correct action destination');
  if(id==='canny'&&cannyFiles[name])check(run('activeCannyAction===null'),'Canny track stopped before returning to options');
  if(instant){check(run('score')===0,'barred score zero');check(JSON.stringify(readScores(storage))===previous,'Onecan banks nothing')}
  else{check(run('score')===POINTS[name],'normal scoring for '+id);check(root.innerHTML.includes(currentPose(0,id)),'same character after action')}
 }
 run('score=26;busy=false;renderPool()');await action('scratchings');
 const actionTimers=timers.splice(0);actionTimers.forEach(f=>f());await tick();check(root.innerHTML.includes(currentPose(5,id)),'correct threshold vomiting character');await settle();check(run('screen')==='barred','threshold bars every character');
 click('#replay');check(run('character===null&&pints===0&&shots===0&&screen==="front"'),'try again reset');
 await enter(id);await action('scratchings');await settle();click('leave');check(run('screen')==='result','successful leave for '+id);click('#replay');
}
for(const [start,name] of [[24,'pint'],[23,'shot'],[26,'scratchings'],[25,'jukebox'],[26,'pint'],[26,'shot'],[26,'jukebox']]){
 await enter('harris');run(`score=${start}`);const previous=JSON.stringify(readScores(storage));await action(name);await settle();check(run('screen')==='barred','threshold end state');check(JSON.stringify(readScores(storage))===previous,'barred never banks');click('#replay');
}
// Successful drink combinations, including zero, maxima, and irrelevant non-alcohol actions.
for(const [p,s] of [[0,0],[4,2],[8,0],[0,6],[2,5],[1,1]]){
 await enter('chorls');for(let n=0;n<p;n++){await action('pint');await settle()}for(let n=0;n<s;n++){await action('shot');await settle()}
 if(p===1&&s===1){await action('scratchings');await settle();await action('jukebox');await settle()}
 check(run('pints')===p&&run('shots')===s,'counters match consumed drinks');click('leave');
 check((root.innerHTML.match(/class="consumed-pint"/g)||[]).length===p,'exact pint glasses');check((root.innerHTML.match(/class="consumed-shot"/g)||[]).length===s,'exact shot glasses');
 check(root.innerHTML.includes('result-score'),'final numerical score');check(root.innerHTML.includes(resultMessage(run('score'))),'unchanged result wording');
 form=root.querySelector('form');form.onsubmit({preventDefault(){}});check((root.innerHTML.match(/class="consumed-pint"/g)||[]).length===p,'name save preserves summary');click('#replay');check(run('pints===0&&shots===0'),'counters reset');
}
await enter('chenzo');click('pint');run("act('shot');leave()");await settle();check(run('score===3&&pints===1&&shots===0'),'double click locked');
// Slow decoding: never switch to the jukebox scene with an undecoded actor.
boot(['assets/onecan/pose-4.png']);click('#continue');click('#continue');const selecting=click('onecan');await tick();
check(run('screen')==='bar'&&root.className==='opening','slow asset keeps complete selection visible');check(!music.paused,'opening music continues while preparing');
click('canny');check(run('character')==='onecan','double selection locked');holds.get('assets/onecan/pose-4.png').resolve();await selecting;check(run('screen')==='pool','selection completes after decode');
await action('jukebox');check(root.className==='action-scene jukebox'&&root.innerHTML.includes(currentPose(4,'onecan')),'Onecan present in first committed jukebox frame');check(decoded.has(currentPose(4,'onecan')),'jukebox image already decoded');await settle();
// Restart while preparation is pending cannot resurrect the previous selection.
boot(['assets/chenzo/pose-4.png']);click('#continue');click('#continue');const stale=click('chenzo');run('restart()');holds.get('assets/chenzo/pose-4.png').resolve();await stale;check(run('screen==="front"&&character===null'),'stale selection cannot change new run');
// A load failure leaves a usable selector, never a fallback character.
boot(['assets/clayto/pose-4.png']);click('#continue');click('#continue');const failed=click('clayto');holds.get('assets/clayto/pose-4.png').reject(Error('offline'));await failed;check(run('screen==="bar"&&busy===false&&character===null'),'failed artwork permits retry without fallback');
for(const id of ids){check(fs.existsSync('dist/assets/portrait-'+id+'.png'),'portrait file');for(let n=0;n<6;n++)check(fs.existsSync('dist/'+currentPose(n,id)),'pose file')}
for(const file of Object.values(cannyFiles))check(fs.existsSync('dist/'+file),'Canny action audio file');
// Room navigation uses the actual UI callbacks and preserves all current-run values.
const expectedKaraoke={harris:['BOBBY DARIN','R.E.M.','THE CLASH'],chenzo:['BRYAN ADAMS','GUNS N’ ROSES','U2'],clayto:['KINGS OF LEON','THE HIVES','RAZORLIGHT'],canny:['MUNGO JERRY','JURASSIC 5','BOBBY McFERRIN'],chorls:['THIN LIZZY','AFROMAN','OASIS'],onecan:['COLDPLAY','COLDPLAY','KEANE']};
for(const id of ids){
 boot();await enter(id);await action('scratchings');await settle();
 if(id!=='onecan'){await action('pint');await settle();await action('shot');await settle()}
 const snapshot=run('JSON.stringify({character,score,pints,shots,runId,banked,scores,muted})');
 const beforeAudio=audioPlays.length;
 for(let trip=0;trip<3;trip++){
  await click('karaoke');check(run('screen')==='karaoke','persistent lounge for '+id);
  check(!root.innerHTML.includes('class="actor'),'POV has no playable body');
  check(root.innerHTML.includes('id="biff"'),'BIFF present for every character');
  check(root.querySelector('#biff').onclick===undefined,'BIFF has no action handler');
  check(fs.existsSync('dist/assets/icon-biff.svg'),'BIFF icon exists');
  check(root.innerHTML.includes('assets/karaoke.png'),'approved lounge used');
  const labels=[...root.innerHTML.matchAll(/<b>(.*?)<\/b>/g)].map(m=>m[1]);
  assert.deepEqual(labels,expectedKaraoke[id].concat('BIFF','BAR'));checks++;
  for(let n=0;n<3;n++){click(String(n));await tick();check(run('screen')==='karaoke-performance','all selected characters trigger performance');await settle();check(run('screen')==='karaoke','artist choice stays in lounge');check(run('JSON.stringify({character,score,pints,shots,runId,banked,scores,muted})')===snapshot,'artist does not alter run')}
  check(audioPlays.length===beforeAudio+3*(trip+1),'each song choice plays one recording');
  click('#return-bar');check(run('screen')==='pool','BAR returns to pool');
  check(root.innerHTML.includes(currentPose(0,id)),'same seated person after BAR');
  check(run('JSON.stringify({character,score,pints,shots,runId,banked,scores,muted})')===snapshot,'room transitions preserve entire run');
 }
 click('leave');check(run('screen')==='result','leave still works after room trips');click('#replay');check(run('character===null&&score===0&&pints===0&&shots===0'),'replay clears run');
}
boot(['assets/karaoke.png']);await enter('onecan');const moving=click('karaoke');await tick();check(run('screen==="pool"&&busy'),'lounge loading preserves current room');run('restart()');holds.get('assets/karaoke.png').resolve();await moving;check(run('screen==="front"&&character===null'),'late lounge load cannot overwrite new run');
// Harris-only reactions: the roll happens only after the selected recording
// finishes, each branch is exclusive, and neither branch changes run state.
async function testHarrisReaction(songIndex,randomValue,expected){
 boot();run(`Math.random=()=>${randomValue}`);await enter('harris');run('score=14;pints=2;shots=2');await click('karaoke');
 const before=JSON.stringify({character:run('character'),score:run('score'),pints:run('pints'),shots:run('shots'),runId:run('runId')});
 const plays=audioPlays.length;const performance=click(String(songIndex));await tick();
 check(run('screen')==='karaoke-performance','Harris performance begins before reaction '+songIndex);
 check(run('activeKaraoke?.src')===karaokeFiles.harris[songIndex],'Harris recording is attached '+songIndex);
 check(timers.length>0,'Harris recording owns the performance timer '+songIndex);timers.shift()();await tick();await tick();
 check(run('screen')===expected,'fresh 50/50 reaction branch '+expected);
 check(expected==='reaction-dave'?root.innerHTML.includes('fail-1.png'):root.innerHTML.includes('pass-1.png'),'reaction artwork is exclusive');
 check(expected==='reaction-dave'?root.innerHTML.includes('fail-1.png')&&root.innerHTML.includes('fail-2.png'):root.innerHTML.includes('pass-1.png')&&root.innerHTML.includes('pass-2.png'),'reaction uses approved branch assets');
 for(const asset of run("reactionTracks[screen==='reaction-dave'?'dave':'couple']"))check(decoded.has(asset),'both reaction frames decoded before display');
 check(!root.innerHTML.includes('karaoke-performance')&&!root.innerHTML.includes('data-karaoke'),'reaction has no song controls');
 check(audioPlays.length===plays+1,'existing song is played once');
 const prefix=expected==='reaction-dave'?'fail':'pass';
 check(reactionStarts.length===2,'exactly two reaction layers');
 check(reactionStarts.every((layer,i)=>layer.src===`assets/reactions/${prefix}${i+1}.m4a`),'exclusive exact reaction audio pair');
 check(reactionStarts[0].time===reactionStarts[1].time,'layers scheduled simultaneously');
 const first=expected==='reaction-dave'?1:0;
 reactionStarts[first].source.onended();await tick();
 check(run('screen')===expected,'first layer ending cannot cut off second');
 reactionStarts[1-first].source.onended();await tick();
 check(reactionStarts.every(layer=>layer.source.stopped&&layer.source.disconnected),'both layers cleaned up');
 while(timers.length)timers.shift()();await tick();await performance;await tick();
 check(run('screen')==='karaoke'&&!run('busy'),'reaction returns to lounge');check(run('JSON.stringify({character,score,pints,shots,runId})')===before,'reaction preserves run state');
}
for(let song=0;song<3;song++){
 await testHarrisReaction(song,.2,'reaction-dave');
 await testHarrisReaction(song,.2,'reaction-dave');
 await testHarrisReaction(song,.8,'reaction-couple');
}
check(style.includes('object-fit:contain')&&style.includes('@keyframes reaction-gesture'),'complete frames fit and gestures loop');
// Interrupting a reaction must stop both layers and prevent a stale return.
boot();await enter('harris');await click('karaoke');click('0');await tick();
timers.shift()();await tick();await tick();
check(reactionStarts.length===2,'reaction starts before interruption');
run('restart()');await settle();
check(reactionStarts.every(layer=>layer.source.stopped&&layer.source.disconnected),'restart stops all reaction layers');
check(run('screen==="front"&&character===null'),'interrupted reaction cannot restore previous run');
// Every singer has their own asset and independently animated host; all 18 callbacks.
for(const id of ids){
 boot();await enter(id);await action('scratchings');await settle();
 if(id!=='onecan'){await action('pint');await settle();await action('shot');await settle()}
 await click('karaoke');
 for(let n=0;n<3;n++){
  const snapshot=run('JSON.stringify({character,score,pints,shots,runId,scores,muted})');const plays=audioPlays.length;
  click(String(n));await tick();check(run('screen==="karaoke-performance"&&busy'),'performance active '+id+' '+n);
  check(root.innerHTML.includes('data-performer="'+id+'"'),'selected performer is single source of truth');
  for(const other of ids)check(root.innerHTML.includes('assets/performance/'+other+'.svg')===(other===id),'no other performer or Harris fallback');
  for(const file of ['room','dave',id])check(decoded.has('assets/performance/'+file+'.svg'),'all layers decoded before first frame');
  check(root.innerHTML.includes('performance-singer singer-'+id),'singer animation layer');
  check(root.innerHTML.includes('performance-dave'),'independent Dave laughing layer');
  check(!root.innerHTML.includes('data-karaoke'),'no song controls during performance');
  run('selectKaraokeChoice(1);act("pint");leave()');await settle();
  check(run('screen==="karaoke"&&!busy'),'performance returns to lounge');
  check(run('JSON.stringify({character,score,pints,shots,runId,scores,muted})')===snapshot,'performance preserves entire run');
  check(audioPlays.length===plays+1,'one karaoke recording per performance');
  check(audioPlays.at(-1)?.src===karaokeFiles[id][n],'recording matches selected character and song');
  check(reactionStarts.length===(id==='harris'?(n+1)*2:0),'reactions remain Harris only with no duplicate starts');
  check(reactionStarts.every(layer=>layer.source.stopped),'no old reaction audio remains');
 }
 check(root.querySelector('#biff').onclick===undefined,'BIFF remains unwired');click('#return-bar');check(run('screen==="pool"'),'BAR never performs');
 await click('karaoke');click('0');await tick();run('restart()');await settle();check(run('screen==="front"&&character===null'),'old performance cannot restore after restart');
}
for(const id of ids){
 const path='assets/performance/'+id+'.svg';
 boot([path]);await enter(id);await click('karaoke');const pending=click('0');await tick();check(run('screen==="karaoke"&&busy'),'slow asset retains complete lounge');
 holds.get(path).resolve();await tick();check(run('screen==="karaoke-performance"'),'delayed asset enters only when decoded');await settle();await pending;
 boot([path]);await enter(id);await click('karaoke');const failed=click('0');await tick();holds.get(path).reject(Error('offline'));await failed;check(run('screen==="karaoke"&&!busy'),'failed performance returns usable lounge');
 boot([path]);await enter(id);await click('karaoke');const stale=click('0');await tick();run('restart()');holds.get(path).resolve();await stale;check(run('screen==="front"&&character===null'),'old decoded sprite cannot change new run');
}
check(/performance-dave\{[^}]*animation:dave-chuckle [^}]*infinite/.test(style),'Dave animation loops');
check(/performance-singer\{[^}]*animation:sing-sway [^}]*infinite/.test(style),'singer animation loops');
check(!source.includes('performHarrisKaraoke'),'no hard-coded Harris performance function');
console.log('Karaoke navigation verified for all six characters, all artist buttons, repeated visits, no score changes and exact audio mappings, and pending-load restart.');
console.log(`${checks} checks passed: six identities, all actions, 108 scoring boundaries, Onecan rule, delayed/failed decoding, drink summaries, replay, naming and leaderboard persistence.`);
