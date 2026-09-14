import {POINTS,addScore,readScores,bankScore,isInstantBarred,resultMessage} from './engine.js';
const root=document.querySelector('#game');let storage;try{storage=window.localStorage}catch{storage={getItem(){return null},setItem(){throw Error('Storage unavailable')}}}
let scores=readScores(storage),score=0,screen='front',busy=false,muted=false,banked=false,runId=0,pendingId=null,saveWarning='',character=null,pints=0,shots=0;
const backgrounds={front:'front',side:'side',bar:'bar',pool:'pool'};
const lines={pint:['Just the one. Again.','That barely touched the sides.','A very ambitious sip.'],shot:['Lovely. Like drinking a radiator.','That’ll put hairs on your hairs.','Perfectly normal facial expression.'],scratchings:['One of your five a day. Probably.','The crunch heard round Walney.','A balanced diet: one in each hand.'],jukebox:['Your song. Everyone else’s problem.','A quid well spent. Allegedly.','The dance floor has not requested this.']};
const karaokeChoices=Object.freeze({harris:['BOBBY DARIN','R.E.M.','THE CLASH'],chenzo:["BRYAN ADAMS","GUNS N’ ROSES",'U2'],clayto:['KINGS OF LEON','THE HIVES','RAZORLIGHT'],canny:['MUNGO JERRY','JURASSIC 5','BOBBY McFERRIN'],chorls:['THIN LIZZY','AFROMAN','OASIS'],onecan:['COLDPLAY','COLDPLAY','KEANE']});
const karaokeTracks=Object.freeze({
 harris:['assets/karaoke/harris-bobby-darrin.m4a','assets/karaoke/harris-rem.m4a','assets/karaoke/harris-the-clash.m4a'],
 chenzo:['assets/karaoke/chenzo-bryan-adams.m4a','assets/karaoke/chenzo-guns-roses.m4a','assets/karaoke/chenzo-u2.m4a'],
 clayto:['assets/karaoke/clayto-kings-of-leon.m4a','assets/karaoke/clayto-the-hives.m4a','assets/karaoke/clayto-razorlight.m4a'],
 canny:['assets/karaoke/canny-mungo-jerry.m4a','assets/karaoke/canny-jurassic-5.m4a','assets/karaoke/canny-bobby-mcferrin.m4a'],
 chorls:['assets/karaoke/chorls-thin-lizzy.m4a','assets/karaoke/chorls-afroman.m4a','assets/karaoke/chorls-oasis.m4a'],
 onecan:['assets/karaoke/onecan-coldplay1.m4a','assets/karaoke/onecan-coldplay2.m4a','assets/karaoke/onecan-keane.m4a']
});
const reactionTracks=Object.freeze({dave:['assets/reactions/fail-1.png','assets/reactions/fail-2.png'],couple:['assets/reactions/pass-1.png','assets/reactions/pass-2.png']});
const reactionAudioTracks=Object.freeze({couple:['assets/reactions/pass1.m4a','assets/reactions/pass2.m4a'],dave:['assets/reactions/fail1.m4a','assets/reactions/fail2.m4a']});
let reactionContext=null,activeReaction=null;
const reactionBufferCache=new Map();
function prepareReactionAudio(){
 reactionContext??=new (window.AudioContext||window.webkitAudioContext)();
 const resumed=reactionContext.resume();
 return Promise.all([resumed,...Object.values(reactionAudioTracks).flat().map(src=>{
  if(!reactionBufferCache.has(src)){
   const loading=fetch(src).then(response=>{if(!response.ok)throw Error('Could not load '+src);return response.arrayBuffer()}).then(data=>reactionContext.decodeAudioData(data));
   reactionBufferCache.set(src,loading);
   loading.catch(()=>reactionBufferCache.delete(src));
  }
  return reactionBufferCache.get(src);
 })]);
}
function stopReactionAudio(){activeReaction?.finish();}
function playReactionAudio(buffers){
 stopReactionAudio();
 return new Promise(resolve=>{
  const gain=reactionContext.createGain();gain.gain.value=muted?0:1;gain.connect(reactionContext.destination);
  const sources=buffers.map(buffer=>{const source=reactionContext.createBufferSource();source.buffer=buffer;source.connect(gain);return source});
  let remaining=sources.length,finished=false;
  const session={sources,finish(){if(finished)return;finished=true;for(const source of sources){source.onended=null;try{source.stop()}catch{}source.disconnect()}gain.disconnect();if(activeReaction===session)activeReaction=null;resolve()}};
  activeReaction=session;
  const startAt=reactionContext.currentTime;
  for(const source of sources)source.onended=()=>{if(--remaining===0)session.finish()};
  try{for(const source of sources)source.start(startAt)}catch{session.finish()}
 });
}
const poses={pint:1,shot:2,scratchings:3,jukebox:4,vomit:5};
const jukeboxTracks=Object.freeze({
 harris:'assets/jukebox/harris-american-pie.m4a',
 chenzo:'assets/jukebox/chenzo-summer-69.m4a',
 chorls:'assets/jukebox/chorls-foo.m4a',
 canny:'assets/jukebox/canny-mungo.m4a',
 onecan:'assets/jukebox/onecan-coldplay.m4a',
 clayto:'assets/jukebox/clayto-kol.m4a'
});
const cannyActionTracks=Object.freeze({
 pint:'assets/canny/one-none.m4a',
 shot:'assets/canny/djouf.m4a',
 scratchings:'assets/canny/like-you.m4a'
});
const karaokeAudioCache=new Map();let activeKaraoke=null,activeKaraokeResolve=null;
function preloadKaraoke(id,index){
 const src=karaokeTracks[id]?.[index];if(!src||typeof Audio==='undefined')return Promise.resolve(null);
 const key=id+':'+index;if(karaokeAudioCache.has(key))return karaokeAudioCache.get(key).ready;
 const player=new Audio(src);player.preload='auto';player.volume=.78;
 if(typeof player.addEventListener!=='function'){const ready=Promise.resolve(player);karaokeAudioCache.set(key,{player,ready});return ready;}
 let settled=false,ok,fail;const cleanup=()=>{player.removeEventListener?.('canplaythrough',ok);player.removeEventListener?.('loadeddata',ok);player.removeEventListener?.('error',fail)};
 const ready=new Promise((resolve,reject)=>{ok=()=>{if(settled)return;settled=true;cleanup();resolve(player)};fail=()=>{if(settled)return;settled=true;cleanup();reject(Error('Could not load '+src))};player.addEventListener('canplaythrough',ok,{once:true});player.addEventListener('loadeddata',ok,{once:true});player.addEventListener('error',fail,{once:true});try{player.load?.();if(player.readyState>=2)ok()}catch{fail()}});
 karaokeAudioCache.set(key,{player,ready});return ready;
}
function stopKaraoke(){if(activeKaraokeResolve){const resolve=activeKaraokeResolve;activeKaraokeResolve=null;resolve()}if(activeKaraoke){try{activeKaraoke.pause();activeKaraoke.currentTime=0;activeKaraoke.muted=false}catch{}activeKaraoke=null}}
async function playKaraoke(id,index){
 const player=await preloadKaraoke(id,index).catch(()=>null);if(!player){await delay(2200);return}
 stopKaraoke();activeKaraoke=player;player.currentTime=0;player.muted=muted;
 await new Promise(resolve=>{let finished=false,timer;const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);player.removeEventListener?.('ended',finish);player.removeEventListener?.('error',finish);if(activeKaraokeResolve===finishResolve)activeKaraokeResolve=null;resolve()};const finishResolve=()=>finish();activeKaraokeResolve=finishResolve;player.addEventListener?.('ended',finish,{once:true});player.addEventListener?.('error',finish,{once:true});const duration=Number.isFinite(player.duration)&&player.duration>0?player.duration*1000+180:30000;timer=setTimeout(finish,duration);try{const started=player.play?.();if(started?.catch)started.catch(finish)}catch{finish()}});
 if(activeKaraoke===player){try{player.pause();player.currentTime=0;player.muted=false}catch{}activeKaraoke=null}
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function scene(name,cls=''){return `<div class="scene ${cls}" style="background-image:url('assets/${name}.png')"></div>`}
function actor(n=0){return `<img class="actor actor-${character}" src="${posePath(character,n)}" decoding="sync" loading="eager" alt="${characters[character].label} ${['sitting beside the pool table','downing a pint','throwing back a shot','eating pork scratchings','choosing a song and dancing','bending over in a slapstick retch'][n]}">`}
let audio;function sound(kind){if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const notes=kind==='jukebox'?[330,440,392,523,440,330]:kind==='vomit'?[140,105,75]:kind==='shot'?[880,440]:kind==='scratchings'?[180,260,150]:[660,880];notes.forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.type=kind==='scratchings'?'sawtooth':'triangle';o.frequency.value=f;g.gain.setValueAtTime(.035,audio.currentTime+i*.14);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+i*.14+.13);o.connect(g);g.connect(audio.destination);o.start(audio.currentTime+i*.14);o.stop(audio.currentTime+i*.14+.14)})}catch{}}
const characters=Object.fromEntries(['Harris','Canny','Onecan','Chenzo','Chorls','Clayto'].map(label=>[label.toLowerCase(),{label,head:'portrait-'+label.toLowerCase()+'.png'}]));
function posePath(id,n){if(!characters[id])throw Error('Choose a character first');return 'assets/'+(id==='harris'?'':id+'/')+'pose-'+n+'.png';}
// Retain decoded images for the run: switching the scene must never race a download.
const imageCache=new Map();
function readyImage(src){
 if(imageCache.has(src))return imageCache.get(src).ready;
 const image=new Image();image.decoding='sync';
 let decoded;
 if(typeof image.decode==='function'){image.src=src;decoded=image.decode();}
 else decoded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not load '+src));image.src=src;});
 const ready=decoded.catch(error=>{imageCache.delete(src);throw error});
 imageCache.set(src,{image,ready});return ready;
}
const jukeboxCache=new Map();let activeJukebox=null,activeJukeboxResolve=null;
function preloadJukebox(id){
 const src=jukeboxTracks[id];if(!src||typeof Audio==='undefined')return Promise.resolve(null);
 if(jukeboxCache.has(id))return jukeboxCache.get(id).ready;
 const player=new Audio(src);player.preload='auto';player.volume=.78;
 if(typeof player.addEventListener!=='function'){const ready=Promise.resolve(player);jukeboxCache.set(id,{player,ready});return ready;}
 let settled=false,ok,fail;
 const cleanup=()=>{player.removeEventListener?.('canplaythrough',ok);player.removeEventListener?.('loadeddata',ok);player.removeEventListener?.('error',fail)};
 const ready=new Promise((resolve,reject)=>{
  ok=()=>{if(settled)return;settled=true;cleanup();resolve(player)};
  fail=()=>{if(settled)return;settled=true;cleanup();reject(Error('Could not load '+src))};
  player.addEventListener('canplaythrough',ok,{once:true});player.addEventListener('loadeddata',ok,{once:true});player.addEventListener('error',fail,{once:true});
  try{player.load?.();if(player.readyState>=2)ok()}catch{fail()}
 });
 jukeboxCache.set(id,{player,ready});return ready;
}
function stopJukebox(){
 if(activeJukeboxResolve){const resolve=activeJukeboxResolve;activeJukeboxResolve=null;resolve()}
 if(activeJukebox){try{activeJukebox.pause();activeJukebox.currentTime=0;activeJukebox.muted=false}catch{}activeJukebox=null}
}
async function playJukebox(id){
 const player=await preloadJukebox(id).catch(()=>null);if(!player){await delay(2200);return}
 stopJukebox();activeJukebox=player;player.currentTime=0;player.muted=muted;
 await new Promise(resolve=>{
  let finished=false,timer;
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);player.removeEventListener?.('ended',finish);player.removeEventListener?.('error',finish);if(activeJukeboxResolve===finishResolve)activeJukeboxResolve=null;resolve()};
  const finishResolve=()=>finish();activeJukeboxResolve=finishResolve;
  player.addEventListener?.('ended',finish,{once:true});player.addEventListener?.('error',finish,{once:true});
  const duration=Number.isFinite(player.duration)&&player.duration>0?player.duration*1000+180:30000;timer=setTimeout(finish,duration);
  try{const started=player.play?.();if(started?.catch)started.catch(finish)}catch{finish()}
 });
 if(activeJukebox===player){try{player.pause();player.currentTime=0;player.muted=false}catch{}activeJukebox=null}
}
const cannyActionCache=new Map();let activeCannyAction=null,activeCannyActionResolve=null;
function preloadCannyAction(action){
 const src=cannyActionTracks[action];if(!src||typeof Audio==='undefined')return Promise.resolve(null);
 if(cannyActionCache.has(action))return cannyActionCache.get(action).ready;
 const player=new Audio(src);player.preload='auto';player.volume=.78;
 if(typeof player.addEventListener!=='function'){const ready=Promise.resolve(player);cannyActionCache.set(action,{player,ready});return ready;}
 let settled=false,ok,fail;
 const cleanup=()=>{player.removeEventListener?.('canplaythrough',ok);player.removeEventListener?.('loadeddata',ok);player.removeEventListener?.('error',fail)};
 const ready=new Promise((resolve,reject)=>{
  ok=()=>{if(settled)return;settled=true;cleanup();resolve(player)};
  fail=()=>{if(settled)return;settled=true;cleanup();reject(Error('Could not load '+src))};
  player.addEventListener('canplaythrough',ok,{once:true});player.addEventListener('loadeddata',ok,{once:true});player.addEventListener('error',fail,{once:true});
  try{player.load?.();if(player.readyState>=2)ok()}catch{fail()}
 });
 cannyActionCache.set(action,{player,ready});return ready;
}
function preloadCannyActions(id){return id==='canny'?Promise.all(Object.keys(cannyActionTracks).map(preloadCannyAction)):Promise.resolve();}
function stopCannyAction(){
 if(activeCannyActionResolve){const resolve=activeCannyActionResolve;activeCannyActionResolve=null;resolve()}
 if(activeCannyAction){try{activeCannyAction.pause();activeCannyAction.currentTime=0;activeCannyAction.muted=false}catch{}activeCannyAction=null}
}
async function playCannyAction(action){
 const player=await preloadCannyAction(action).catch(()=>null);if(!player)return false;
 stopCannyAction();activeCannyAction=player;player.currentTime=0;player.muted=muted;
 await new Promise(resolve=>{
  let finished=false,timer;
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);player.removeEventListener?.('ended',finish);player.removeEventListener?.('error',finish);if(activeCannyActionResolve===finishResolve)activeCannyActionResolve=null;resolve()};
  const finishResolve=()=>finish();activeCannyActionResolve=finishResolve;
  player.addEventListener?.('ended',finish,{once:true});player.addEventListener?.('error',finish,{once:true});
  const duration=Number.isFinite(player.duration)&&player.duration>0?player.duration*1000+180:30000;timer=setTimeout(finish,duration);
  try{const started=player.play?.();if(started?.catch)started.catch(finish)}catch{finish()}
 });
 if(activeCannyAction===player){try{player.pause();player.currentTime=0;player.muted=false}catch{}activeCannyAction=null}
 return true;
}
function prepareCharacter(id){return Promise.all([...Array.from({length:6},(_,n)=>posePath(id,n)),'assets/bar.png','assets/pool.png'].map(readyImage).concat(preloadJukebox(id),preloadCannyActions(id),...(karaokeTracks[id]||[]).map((_,i)=>preloadKaraoke(id,i))));}
async function chooseCharacter(id){
 if(busy||screen!=='bar'||!characters[id])return;
 busy=true;const currentRun=runId;character=id;
 root.querySelectorAll('[data-character]').forEach(button=>button.disabled=true);
 try{await prepareCharacter(id);if(currentRun!==runId)return;pints=0;shots=0;sound('click');stopOpeningMusic();busy=false;renderPool();}
 catch{if(currentRun!==runId)return;busy=false;character=null;renderOpening();const note=document.createElement('p');note.className='notice';note.setAttribute('role','status');note.textContent='Couldn’t load your character. Tap to try again.';root.querySelector('.character-select').append(note);}
}
const openingMusic=typeof Audio==='undefined'?{loop:true,preload:'auto',volume:.45,play(){return Promise.resolve()},pause(){},currentTime:0}:new Audio('assets/cheers.m4a');openingMusic.loop=true;openingMusic.preload='auto';openingMusic.volume=.45;
function startOpeningMusic(){if(muted||!['front','side','bar'].includes(screen))return;const play=openingMusic.play();if(play&&play.catch)play.catch(()=>{});}
function stopOpeningMusic(){openingMusic.pause();openingMusic.currentTime=0;}
document.addEventListener('pointerdown',startOpeningMusic);
document.addEventListener('keydown',startOpeningMusic);
function renderOpening(){root.className='opening';startOpeningMusic();if(screen==='bar'){root.innerHTML=scene('bar')+`<section class="opening-content character-select"><div class="eyebrow">Back on familiar carpet</div><h2>Choose Your Character</h2><div class="character-choices">${Object.entries(characters).map(([id,c])=>`<button class="character-choice" data-character="${id}"><img src="assets/${c.head}" alt="${c.label}" class="head-${id}"><b>${c.label}</b></button>`).join('')}</div></section>`;root.querySelectorAll('[data-character]').forEach(button=>button.onclick=()=>chooseCharacter(button.dataset.character));return;}
const copy=screen==='front'?`<div class="eyebrow">Walney Island · Somewhere around 2000</div><h1>THE GEORGE<span>SIMULATOR</span></h1><div class="rule"></div><p>Same pub. Same mates. Questionable decisions.</p>`:`<div class="eyebrow">The usual way in</div><h2>Round the side, lads.</h2><p>Nobody ever used the posh entrance.</p>`;root.innerHTML=scene(backgrounds[screen])+`<section class="opening-content">${copy}<button class="cta" id="continue">${screen==='front'?'ENTER':'CONTINUE'}</button></section>`;root.querySelector('#continue').onclick=()=>{sound('click');screen=screen==='front'?'side':'bar';renderOpening()};}
function renderPool(message='Settle in. Leave while you’re still welcome.'){screen='pool';root.className='playing';root.innerHTML=scene('pool','pool-scene')+actor()+`<header class="topbar"><div class="brand">THE GEORGE<small>POOL ROOM · WALNEY ISLAND · ${characters[character].label.toUpperCase()}</small></div></header><button class="mute" aria-label="${muted?'Enable':'Mute'} sound">SOUND ${muted?'OFF':'ON'}</button><div class="caption" aria-live="polite"><span>${message}</span></div><nav class="actions" aria-label="Pub decisions">${[['pint','🍺','PINT'],['shot','🥃','SHOT'],['scratchings','🥓','PORK<br>SCRATCHINGS'],['jukebox','♫','JUKEBOX'],['karaoke','🎤','KARAOKE'],['leave','↪','LEAVE']].map(([id,icon,label])=>`<button class="action ${id==='leave'?'leave':''}" data-action="${id}"><span class="icon" aria-hidden="true">${['leave','karaoke'].includes(id)?icon:`<img src="assets/icon-${id}.png" alt="">`}</span><b>${label}</b></button>`).join('')}</nav>`;root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>b.dataset.action==='leave'?leave():b.dataset.action==='karaoke'?enterKaraoke():act(b.dataset.action));root.querySelector('.mute').onclick=()=>{muted=!muted;renderPool(message)};}
async function enterKaraoke(){
 if(busy||screen!=='pool')return;
 busy=true;const currentRun=runId;
 try{await readyImage('assets/karaoke.png');if(currentRun!==runId)return;busy=false;renderKaraoke();}
 catch{if(currentRun!==runId)return;busy=false;renderPool('Couldn’t open the lounge. Give it another go.');}
}
function renderKaraoke(){
 preparePerformance(character).catch(()=>{});
 screen='karaoke';root.className='karaoke-room';
 root.innerHTML=scene('karaoke','karaoke-scene')+`<nav class="actions karaoke-actions" aria-label="Karaoke choices">${karaokeChoices[character].map((label,index)=>`<button class="action" data-karaoke="${index}"><span class="icon" aria-hidden="true">🎤</span><b>${esc(label)}</b></button>`).join('')}<button type="button" class="action" id="biff"><span class="icon" aria-hidden="true"><img src="assets/icon-biff.svg" alt=""></span><b>BIFF</b></button><button class="action leave" id="return-bar"><span class="icon" aria-hidden="true">🍺</span><b>BAR</b></button></nav>`;
 root.querySelectorAll('[data-karaoke]').forEach(button=>button.onclick=()=>selectKaraokeChoice(Number(button.dataset.karaoke)));
 root.querySelector('#return-bar').onclick=()=>{if(!busy&&screen==='karaoke')renderPool()};
}
function selectKaraokeChoice(index){
 if(busy||screen!=='karaoke'||!Number.isInteger(index)||!karaokeChoices[character][index])return;
 // Resume the reaction audio context inside the user's tap for mobile playback.
 const reactionReady=character==='harris'?prepareReactionAudio():null;
 return performKaraoke(index,reactionReady);
}
function performancePath(id){
 if(!characters[id])throw Error('Choose a character first');
 return 'assets/performance/'+id+'.svg';
}
function preparePerformance(id,songIndex){
 return Promise.all([performancePath(id),'assets/performance/room.svg','assets/performance/dave.svg'].map(readyImage).concat(songIndex===undefined?[]:[preloadKaraoke(id,songIndex)]));
}
async function playHarrisReaction(currentRun){
 const outcome=Math.random()<.5?'dave':'couple';
 const assets=reactionTracks[outcome];
 let buffers;
 try{[,buffers]=await Promise.all([Promise.all(assets.map(readyImage)),Promise.all(reactionAudioTracks[outcome].map(src=>reactionBufferCache.get(src)))]);}catch{return currentRun===runId;}
 if(currentRun!==runId)return false;
 screen=outcome==='dave'?'reaction-dave':'reaction-couple';root.className='reaction-screen '+screen;
 const description=outcome==='dave'?'Dave F angrily pointing towards the exit':'The seated regulars approving: the man bangs his tankard and the woman claps';
 root.innerHTML=`<div class="reaction-wash"><div class="reaction-frames" role="img" aria-label="${description}">${assets.map((src,index)=>`<img class="reaction-frame reaction-frame-${index}" src="${src}" decoding="sync" alt="" aria-hidden="true">`).join('')}</div></div>`;
 await playReactionAudio(buffers);
 return currentRun===runId;
}
async function performKaraoke(songIndex,reactionReady=null){
 if(busy||screen!=='karaoke'||!characters[character])return;
 busy=true;const currentRun=runId,performer=character;
 try{
  await Promise.all([preparePerformance(performer,songIndex),reactionReady]);
  if(currentRun!==runId||character!==performer)return;
  screen='karaoke-performance';root.className='karaoke-performance';
  root.innerHTML=`<div class="performance-frame"><div class="performance-stage">
   <img class="performance-room" src="assets/performance/room.svg" decoding="sync" alt="The George karaoke stage, with the two regulars seated at the far right">
   <img class="performance-dave" src="assets/performance/dave.svg" decoding="sync" alt="Dave F laughing with his hands on his stomach">
   <img class="performance-singer singer-${performer}" data-performer="${performer}" src="${performancePath(performer)}" decoding="sync" alt="${characters[performer].label} singing into a microphone">
  </div></div>`;
  await playKaraoke(performer,songIndex);
  if(currentRun!==runId||character!==performer)return;
  if(performer==='harris'&&!await playHarrisReaction(currentRun))return;
  if(currentRun!==runId||character!==performer)return;
  busy=false;renderKaraoke();
 }catch{
  if(currentRun!==runId)return;
  busy=false;renderKaraoke();
  const note=document.createElement('p');note.className='caption';note.setAttribute('role','status');note.textContent='Couldn’t load the performance. Give it another go.';root.append(note);
 }
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function sequence(action,message){const currentRun=runId;const customTrack=character==='canny'?cannyActionTracks[action]:null;await readyImage(posePath(character,poses[action]));if(action==='jukebox')await preloadJukebox(character).catch(()=>null);if(customTrack)await preloadCannyAction(action).catch(()=>null);if(currentRun!==runId)return;root.className=`action-scene ${action}`;root.innerHTML=scene(action==='jukebox'?'bar':'pool')+actor(poses[action])+`<div class="action-label">${action==='vomit'?'Oh, mate.':action==='scratchings'?'Pork scratchings':action}</div>${action==='jukebox'?'<div class="music-notes" aria-hidden="true">♪ ♫</div>':''}<div class="caption action-caption" aria-live="polite"><span>${message}</span></div>`;if(action==='jukebox')await playJukebox(character);else if(customTrack){const played=await playCannyAction(action);if(!played){sound(action);await delay(action==='vomit'?2400:2200);}}else{sound(action);await delay(action==='vomit'?2400:2200);}}
async function finishBarred(id){screen='vomit';await sequence('vomit','“I’m absolutely fi—”');if(id!==runId)return;score=0;screen='barred';renderBarred();busy=false;}
async function act(action){if(busy||screen!=='pool')return;busy=true;const id=runId;if(action==='pint')pints++;if(action==='shot')shots++;if(isInstantBarred(character,action)){await finishBarred(id);return;}screen='action';const choices=lines[action],line=choices[Math.floor(Math.random()*choices.length)];await sequence(action,line);if(id!==runId)return;const result=addScore(score,action);score=result.score;if(result.barred){await finishBarred(id);}else{renderPool(line);busy=false;}}
function leave(){if(busy||screen!=='pool')return;screen='result';banked=false;pendingId=String(Date.now())+Math.random();const result=bankScore(storage,scores,'Mystery regular',score,pendingId);scores=result.entries;saveWarning=result.saved?'':'This browser could not save the table. Scores will last for this session only.';sound('click');renderResult(saveWarning);}
function board(){return `<section class="board"><h3>THE GEORGE’S FINEST</h3><table aria-label="Top ten successful scores"><thead><tr><th>#</th><th>REGULAR</th><th>SCORE</th></tr></thead><tbody>${scores.length?scores.map((e,i)=>`<tr><td>${i+1}</td><td>${esc(e.name)}</td><td>${e.score}</td></tr>`).join(''):'<tr><td colspan="3">No legends yet. Set the standard.</td></tr>'}</tbody></table></section>`;}
function drinksSummary(){return '<section class="drinks-summary" aria-label="Drinks consumed: '+pints+' pints and '+shots+' shots"><div class="eyebrow">Your empties</div><div class="drink-glasses">'+Array.from({length:pints},()=>'<img class="consumed-pint" src="assets/icon-pint.png" alt="One pint">').join('')+Array.from({length:shots},()=>'<img class="consumed-shot" src="assets/icon-shot.png" alt="One shot">').join('')+'</div>'+(pints+shots===0?'<p>Not a glass to collect.</p>':'')+'</section>';}
function renderResult(note=''){root.className='';root.innerHTML=`<section class="result"><div class="result-inner"><div class="eyebrow">The tactical early exit</div><div class="stamp">YOU GOT AWAY WITH IT</div><h2>Home before the questions.</h2><div class="result-score"><small>SCORE</small>${score}</div><p class="verdict">${resultMessage(score)}</p>${drinksSummary()}<p>Coat on. Head down. See you next Friday.</p>${!banked?'<form class="bank-form"><input aria-label="Your name or nickname" name="nickname" maxlength="18" placeholder="Your pub nickname" autocomplete="nickname" required><button class="cta" type="submit">SAVE NAME</button></form>':'<p>Score banked. Reputation somehow intact.</p>'}${note?`<p class="notice" role="status">${note}</p>`:''}${board()}<button class="cta" id="replay">PLAY AGAIN</button><p><small>Top 10 · Saved on this browser</small></p></div></section>`;const form=root.querySelector('form');if(form)form.onsubmit=e=>{e.preventDefault();if(banked)return;const result=bankScore(storage,scores,form.elements.nickname.value,score,pendingId);scores=result.entries;banked=true;renderResult(result.saved?'':'This browser could not save the table. These scores will last for this session only.')};root.querySelector('#replay').onclick=restart;}
function renderBarred(){root.className='';root.innerHTML=`<section class="result barred"><div class="result-inner"><div class="eyebrow">“CAN I SEE YOUR ID, MATE?”</div><h2>“THAT’S IT.<br>YOU’RE BARRED.”</h2><div class="stamp">GAME OVER</div><p>Nothing banked. Not even your dignity.</p><button class="cta" id="replay">TRY AGAIN</button></div></section>`;root.querySelector('#replay').onclick=restart;}
function restart(){runId++;stopReactionAudio();stopJukebox();stopCannyAction();score=0;busy=false;banked=false;character=null;pints=0;shots=0;screen='front';renderOpening();}
for(const name of ['front','side','bar','pool','karaoke'])readyImage('assets/'+name+'.png').catch(()=>{});
// Warm all poses during the opening; selection also waits for decoding before play.
for(const id of Object.keys(characters))prepareCharacter(id).catch(()=>{});
renderOpening();

window.addEventListener?.("pagehide",stopReactionAudio);
