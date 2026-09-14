export const POINTS=Object.freeze({pint:3,shot:4,scratchings:1,jukebox:2});
export const KEY='the-george-leaderboard-v1';
export function addScore(score,action){if(!(action in POINTS))throw Error('Unknown action');const total=score+POINTS[action];return {score:total,barred:total>=27};}
export function rank(entries){return entries.filter(e=>e&&typeof e.name==='string'&&Number.isInteger(e.score)&&e.score>=0&&e.score<27).sort((a,b)=>b.score-a.score).slice(0,10);}
export function readScores(storage){try{return rank(JSON.parse(storage.getItem(KEY)||'[]'));}catch{return [];}}
export function bankScore(storage,entries,name,score,id=String(Date.now())+Math.random()){if(!Number.isInteger(score)||score<0||score>=27)throw Error('Cannot bank a barred run');const next=rank([...entries.filter(e=>e.id!==id),{id,name:String(name).trim().slice(0,18)||'Mystery regular',score}]);let saved=true;try{storage.setItem(KEY,JSON.stringify(next));}catch{saved=false;}return {entries:next,saved};}

export function isInstantBarred(character,action){return character==='onecan'&&(action==='pint'||action==='shot');}
export function resultMessage(score){if(score===26)return 'Legend.';if(score>=23)return 'Quality effort.';if(score>=19)return 'Decent evening.';if(score>=14)return 'Steady night.';if(score>=8)return 'Early night.';if(score>=1)return 'Pathetic.';return 'What was the point?';}
