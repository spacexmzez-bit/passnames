// End-to-end protocol simulations with real rules and isolated socket identities.
// Storage/sockets are in-process adapters, not a Cloudflare or browser runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRoomServer} from './room-server.js';
import {matchCommand,matchView,tickMatch,syncMatch} from './room-match.js';
import {EMPTY_ROOM_TTL} from './room-core.js';
const words=JSON.parse(readFileSync(new URL('./words.json',import.meta.url)));
const CODE='ABCD23456';
const token=n=>n.toString(16).padStart(64,'0');
class Storage{
 data=new Map();alarm=null;fail=false;
 async get(key){return structuredClone(this.data.get(key));}
 async put(key,value){if(this.fail)throw Error('Storage unavailable');this.data.set(key,structuredClone(value));}
 async deleteAll(){this.data.clear();}
 async setAlarm(value){this.alarm=value;}
 async deleteAlarm(){this.alarm=null;}
}
class Base{constructor(ctx){this.ctx=ctx;this.name=ctx.name;}getConnections(){return this.ctx.connections.filter(c=>!c.closed);}}
const Server=makeRoomServer(Base,words);
async function fixture(storage=new Storage(),code=CODE){const ctx={storage,name:code,connections:[]};const server=new Server(ctx);await server.onStart();return {server,ctx,storage,clients:[]};}
const req=(path,data)=>new Request('https://internal'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const view=c=>c.messages.filter(m=>m.type==='snapshot').at(-1)?.room;
async function connect(f,n){const c={messages:[],state:null,closed:false,send(s){this.messages.push(JSON.parse(s));},setState(s){this.state=s;},close(code){this.closed=true;this.closeCode=code;}};f.ctx.connections.push(c);await f.server.onConnect(c);await f.server.onMessage(c,JSON.stringify({type:'AUTH',token:token(n)}));return c;}
async function command(f,c,type,extra={}){const requestId=crypto.randomUUID();await f.server.onMessage(c,JSON.stringify({type,...extra,requestId}));return c.messages.findLast(m=>m.requestId===requestId);}
function envelope(c,action){const m=view(c).match;return {matchId:m.id,version:m.version,turnNumber:m.turnNumber,action};}
const game=(f,c,type,extra={})=>command(f,c,'GAME',envelope(c,{type,...extra}));
async function setup(settings={mode:'expanded',timerSeconds:0,manualDraw:false},count=4){
 const f=await fixture();assert.equal((await f.server.onRequest(req('/create',{name:'P1',token:token(1),settings}))).status,201);
 const admin=await connect(f,1);f.clients.push(admin);await command(f,admin,'LOCK',{locked:false});
 for(let n=2;n<=count;n++){assert.equal((await f.server.onRequest(req('/join',{name:'P'+n,token:token(n)}))).status,200);f.clients.push(await connect(f,n));}
 for(let i=1;i<count;i++)await command(f,admin,'ASSIGN',{targetId:f.clients[i].state.playerId,team:i===1||i>=4?'blue':'red',role:i===2?'spy':'agent'});
 assert.equal((await command(f,admin,'START')).type,'ack');
 assert.equal((await command(f,admin,'LAUNCH')).type,'ack');return f;
}
const member=(f,team,role)=>f.clients.find(c=>view(c).me.team===team&&view(c).me.role===role&&!c.closed);
async function begin(f){if(f.server.lobby.match.phase==='deal')assert.equal((await game(f,f.clients[0],'BEGIN')).type,'ack');}
async function clue(f,count=1,text='اختبار لغوي'){const s=f.server.lobby.match;assert.equal((await game(f,member(f,s.active,'spy'),'CLUE',{text,count})).type,'ack');}
async function guess(f,cell){const c=member(f,f.server.lobby.match.active,'agent');assert.equal((await game(f,c,'MARK',{cell})).type,'ack');return game(f,c,'GUESS',{cell});}
const cell=(f,color)=>f.server.lobby.match.board.find(c=>c.color===color&&!c.revealed).id;
function direct(s,c,type,extra={},now=Date.now()){return matchCommand(s,c.state.playerId,{type:'GAME',...envelope(c,{type,...extra})},s.players.map(p=>p.id),words,now,()=>0.5);}
test('four devices launch the same match, with spy keys and concealed agent boards',async()=>{
 const f=await setup();const id=view(f.clients[0]).match.id;
 for(const c of f.clients){const m=view(c).match;assert.equal(m.id,id);assert.equal(m.phase,'deal');assert(m.board.every(c=>c.color===null));assert(!JSON.stringify(m).includes('tokenHash'));assert(!('deck'in m));assert(!('discard'in m));}
 await begin(f);
 for(const c of f.clients){const m=view(c).match;assert.equal(m.board.length,36);assert(m.board.every(x=>view(c).me.role==='spy'?x.color!==null:x.color===null));}
});
test('socket identity overrides forged actor, board, score and timer fields',async()=>{
 const f=await setup();await begin(f);const before=JSON.stringify(f.server.lobby.match);
 const result=await game(f,f.clients[1],'CLUE',{playerId:f.clients[0].state.playerId,text:'اختبار لغوي',count:1,board:[],deadline:1});
 assert.equal(result.error,'GAME_RULE');assert.equal(JSON.stringify(f.server.lobby.match),before);
 for(const type of ['TICK','SET_STATE','WIN'])assert.equal((await game(f,f.clients[0],type)).error,'BAD_ACTION');
 await clue(f);assert.equal(view(f.clients[1]).match.clues.length,1);assert.equal(view(f.clients[3]).match.clue.text,'اختبار لغوي');
});
test('suspecting is private to team agents and revealing requires a suspected word',async()=>{
 const f=await setup(undefined,5);await begin(f);await clue(f);const id=cell(f,'blue');
 assert.equal((await game(f,f.clients[1],'GUESS',{cell:id})).error,'SUSPECT_FIRST');
 await game(f,f.clients[1],'MARK',{cell:id});
 assert(view(f.clients[4]).match.board[id].marks.includes('P2'));
 for(const c of [f.clients[0],f.clients[2],f.clients[3]])assert.deepEqual(view(c).match.board[id].marks,[]);
 assert.equal(f.server.lobby.match.guesses,0);assert.equal((await game(f,f.clients[4],'GUESS',{cell:id})).type,'ack');
 assert.equal(f.server.lobby.match.guesses,1);for(const c of f.clients)assert.equal(view(c).match.board[id].color,'blue');
});
test('simultaneous correct guesses from two agents accept one action from a given version',async()=>{
 const f=await setup(undefined,5);await begin(f);await clue(f,4);const ids=f.server.lobby.match.board.filter(c=>c.color==='blue').slice(0,2).map(c=>c.id);
 for(const id of ids)await game(f,f.clients[1],'MARK',{cell:id});
 const packets=ids.map((id,i)=>envelope(f.clients[i?4:1],{type:'GUESS',cell:id}));
 const results=await Promise.all(packets.map((packet,i)=>command(f,f.clients[i?4:1],'GAME',packet)));
 assert.equal(results.filter(r=>r.type==='ack').length,1);assert.equal(results.filter(r=>r.error==='STALE_ACTION').length,1);
 assert.equal(f.server.lobby.match.guesses,1);assert.equal(f.server.lobby.match.board.filter(c=>c.revealed).length,1);
});
test('manual initial draws keep keys hidden until both spies draw and admin starts play',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:0,manualDraw:true});
 assert.equal((await game(f,f.clients[0],'BEGIN')).error,'GAME_RULE');
 assert.equal((await game(f,f.clients[1],'DRAW')).error,'GAME_RULE');
 for(const c of [f.clients[0],f.clients[2]]){assert.equal((await game(f,c,'DRAW')).type,'ack');for(const c of f.clients)assert(view(c).match.board.every(c=>c.color===null));}
 assert.equal((await game(f,f.clients[2],'BEGIN')).error,'GAME_RULE');await begin(f);assert(view(f.clients[0]).match.board.every(c=>c.color));
 assert(view(f.clients[0]).match.hand.length===0);assert.deepEqual(view(f.clients[0]).match.scans,[]);
});
test('standard starts without deal, supports unlimited, and disallows zero and actions',async()=>{
 const f=await setup({mode:'standard',timerSeconds:0,manualDraw:true});assert.equal(f.server.lobby.match.phase,'clue');assert.equal(f.server.lobby.match.board.length,25);
 const spy=member(f,f.server.lobby.match.active,'spy');assert.equal((await game(f,spy,'CLUE',{text:'اختبار لغوي',count:0})).error,'GAME_RULE');
 await clue(f,'unlimited');assert.equal(f.server.lobby.match.clue.count,'unlimited');for(const c of f.clients)assert.deepEqual(view(c).match.hand,[]);
});
test('server alarms end guessing without client ticks; late stale guesses never reveal',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:10,manualDraw:false});await begin(f);assert.equal(f.storage.alarm,null);await clue(f);
 assert.equal(f.storage.alarm,f.server.lobby.match.deadline);const agent=f.clients[1],id=cell(f,'blue');await game(f,agent,'MARK',{cell:id});const stale=envelope(agent,{type:'GUESS',cell:id});
 f.server.lobby.match.deadline=Date.now()-1;const result=await command(f,agent,'GAME',stale);assert.equal(result.error,'STALE_ACTION');assert.equal(f.server.lobby.match.active,'red');assert.equal(f.server.lobby.match.board[id].revealed,false);assert.equal(f.storage.alarm,null);
 await clue(f);f.server.lobby.match.deadline=Date.now()-1;await f.server.onAlarm();assert.equal(view(agent).match.active,'blue');assert.equal(view(agent).match.phase,'clue');
});
test('clock-controlled Second Chance gives 10 seconds then restores saved guess time',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);
 let s=structuredClone(f.server.lobby);s.match.teams.blue.turns=2;s.match.teams.blue.hand=[{id:900,type:'second',usableTurn:2}];
 const blue=f.clients[1],spy=f.clients[0];s=direct(s,spy,'CLUE',{text:'اختبار لغوي',count:2},1000);
 const id=s.match.board.find(c=>c.color==='neutral').id;
 let m=matchView(s,blue.state.playerId);const apply=(type,extra,now)=>{m=matchView(s,blue.state.playerId);s=matchCommand(s,blue.state.playerId,{type:'GAME',matchId:m.id,version:m.version,turnNumber:m.turnNumber,action:{type,...extra}},s.players.map(p=>p.id),words,now);};
 apply('MARK',{cell:id},5000);apply('GUESS',{cell:id},11000);assert.equal(s.match.phase,'second');assert.equal(s.match.deadline,21000);assert.equal(s.match.remainingMs,50000);
 apply('SECOND',{},15000);assert.equal(s.match.deadline,65000);assert.equal(s.match.phase,'guess');assert(s.match.board[id].revealed);
});
test('Second Chance decision expiry is enforced by the server alarm',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);f.server.lobby.match.teams.blue.turns=2;f.server.lobby.match.teams.blue.hand=[{id:900,type:'second',usableTurn:2}];f.server.publish();await clue(f,2);await guess(f,cell(f,'neutral'));
 assert.equal(f.server.lobby.match.phase,'second');assert.equal(f.storage.alarm,f.server.lobby.match.deadline);
 f.server.lobby.match.deadline=Date.now()-1;await f.server.onAlarm();assert.equal(view(f.clients[0]).match.active,'red');assert.equal(view(f.clients[0]).match.phase,'clue');
});
test('scan outcome and card hand reach only owning agents; swaps broadcast words with fixed keys',async()=>{
 const f=await setup(undefined,5);await begin(f);const s=f.server.lobby.match;s.teams.blue.turns=2;s.teams.blue.hand=[{id:901,type:'scan',usableTurn:2}];f.server.publish();
 const black=cell(f,'black');assert.equal((await game(f,f.clients[1],'SCAN',{cell:black})).type,'ack');
 for(const c of f.clients){const own=[f.clients[1],f.clients[4]].includes(c);assert.equal(view(c).match.scans.length,own?1:0);assert(!view(c).match.board[black].revealed);if(!own)assert(!JSON.stringify(view(c).match.log).includes('فحص «'));}
 assert.equal(f.server.lobby.match.guesses,0);assert.equal((await game(f,f.clients[4],'SCAN',{cell:0})).error,'GAME_RULE');
 const match=f.server.lobby.match;match.actionUsed=false;match.teams.blue.hand=[{id:902,type:'swap',usableTurn:2}];f.server.publish();
 const [a,b]=match.board,aw=a.word,bw=b.word,ac=a.color,bc=b.color;
 assert.equal((await game(f,f.clients[1],'SWAP',{cells:[0,1]})).type,'ack');assert.equal(f.server.lobby.match.board[0].color,ac);assert.equal(f.server.lobby.match.board[1].color,bc);
 for(const c of f.clients){assert.equal(view(c).match.board[0].word,bw);assert.equal(view(c).match.board[1].word,aw);}
});
test('manual earned draws expire at next own turn and never expose drawn card to spies',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:0,manualDraw:true});await game(f,f.clients[0],'DRAW');await game(f,f.clients[2],'DRAW');await begin(f);
 const s=f.server.lobby.match;s.teams.blue.streak=1;s.deck=['scan'];f.server.publish();await clue(f,1);await guess(f,cell(f,'blue'));await game(f,f.clients[1],'END');
 assert(view(f.clients[0]).match.canDraw);assert.equal(f.server.lobby.match.active,'red');assert.equal((await game(f,f.clients[0],'DRAW')).type,'ack');
 assert(!view(f.clients[0]).match.canDraw);assert.deepEqual(view(f.clients[0]).match.hand,[]);assert(view(f.clients[1]).match.hand.some(c=>c.type==='scan'));
 f.server.lobby.match.teams.blue.pendingDraw={usableTurn:3};f.server.publish();await clue(f,1);await guess(f,cell(f,'red'));await game(f,f.clients[3],'END');assert.equal(f.server.lobby.match.active,'blue');assert.equal(f.server.lobby.match.teams.blue.pendingDraw,null);
});
test('pause freezes the server alarm and only admin can resume',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);await clue(f);
 assert.equal((await game(f,f.clients[1],'PAUSE')).error,'GAME_RULE');await game(f,f.clients[0],'PAUSE');assert(view(f.clients[1]).match.pause);assert.equal(f.storage.alarm,null);
 const left=f.server.lobby.match.pause.remaining;await f.server.onAlarm();assert.equal(f.server.lobby.match.pause.remaining,left);await game(f,f.clients[0],'PAUSE');assert(!view(f.clients[1]).match.pause);assert.equal(f.storage.alarm,f.server.lobby.match.deadline);
});
test('refresh and object recreation restore the same match, seat, private view and timer',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);await clue(f);await game(f,f.clients[1],'MARK',{cell:0});
 const before=view(f.clients[1]).match;const g=await fixture(f.storage);const agent=await connect(g,2);assert.equal(view(agent).me.id,f.clients[1].state.playerId);assert.deepEqual(view(agent).match,before);assert.equal(g.storage.alarm,before.deadline);assert(view(agent).match.board.every(c=>c.color===null));
});
test('midgame arrivals stay waiting with no match data even in unlocked rooms',async()=>{
 const f=await setup();await begin(f);await f.server.onRequest(req('/join',{name:'Late',token:token(9)}));const late=await connect(f,9);assert.equal(view(late).phase,'waiting');assert(!('match'in view(late)));assert.equal(view(late).players.length,0);
 assert.equal((await command(f,f.clients[0],'APPROVE',{targetId:late.state.playerId})).error,'LOBBY_ONLY');assert.equal((await command(f,late,'GAME',{matchId:f.server.lobby.matchId,version:1,turnNumber:1,action:{type:'MARK',cell:0}})).error,'APPROVAL_REQUIRED');
});
test('playing roles/settings cannot be reopened using BACK; a spy cannot become an agent',async()=>{
 const f=await setup();await begin(f);const original=JSON.stringify(f.server.lobby.match);
 for(const [type,extra] of [['BACK',{}],['ASSIGN',{targetId:f.clients[0].state.playerId,team:'blue',role:'agent'}],['SETTINGS',{settings:{mode:'standard'}}]])assert.equal((await command(f,f.clients[0],type,extra)).error,'LOBBY_ONLY');
 assert.equal(JSON.stringify(f.server.lobby.match),original);
});
test('kicking a required seat revokes all views, freezes play and permits a same-room rematch',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);await clue(f);const oldId=f.server.lobby.matchId;await command(f,f.clients[0],'KICK',{targetId:f.clients[3].state.playerId});
 assert(f.clients[3].closed);assert(view(f.clients[0]).match.pause);assert(view(f.clients[0]).match.missingSeats);assert.equal(f.storage.alarm,null);assert.equal((await game(f,f.clients[0],'PAUSE')).error,'MISSING_SEATS');
 assert.equal((await command(f,f.clients[0],'REMATCH',{matchId:oldId})).type,'ack');assert.equal(f.server.lobby.phase,'lobby');assert(!f.server.lobby.match);assert.equal(view(f.clients[0]).code,CODE);assert.equal(view(f.clients[1]).match,null);
});
test('departing admin transfers ownership without exposing roles or resetting the match',async()=>{
 const f=await setup();await begin(f);const matchId=f.server.lobby.matchId;await command(f,f.clients[0],'LEAVE');assert.equal(f.server.lobby.phase,'playing');assert.equal(f.server.lobby.matchId,matchId);assert.equal(f.server.lobby.adminId,f.clients[1].state.playerId);assert.equal(view(f.clients[1]).match.adminId,f.clients[1].state.playerId);assert(view(f.clients[1]).match.board.every(c=>c.color===null));
 assert.equal((await command(f,f.clients[1],'REMATCH',{matchId})).type,'ack');assert.equal(f.server.lobby.phase,'lobby');
});
test('rematch clears server key, hands, clues and old match IDs but keeps roster and settings',async()=>{
 const f=await setup();await begin(f);await clue(f);const id=f.server.lobby.matchId,roster=structuredClone(f.server.lobby.players),settings=structuredClone(f.server.lobby.settings);
 assert.equal((await command(f,f.clients[1],'REMATCH',{matchId:id})).error,'ADMIN_ONLY');await command(f,f.clients[0],'REMATCH',{matchId:id});assert.deepEqual(f.server.lobby.players,roster);assert.deepEqual(f.server.lobby.settings,settings);assert.equal(f.storage.alarm,null);const persisted=await f.storage.get('lobby');assert(!persisted.match);assert(!persisted.matchId);
 await command(f,f.clients[0],'START');await command(f,f.clients[0],'LAUNCH');assert.notEqual(f.server.lobby.matchId,id);assert.equal(f.server.lobby.match.clues.length,0);assert.equal((await command(f,f.clients[0],'REMATCH',{matchId:id})).error,'STALE_MATCH');
});
test('black card ends the game for every device, then rematch stays in the same room',async()=>{
 const f=await setup();await begin(f);await clue(f);assert.equal((await guess(f,cell(f,'black'))).type,'ack');for(const c of f.clients){assert.equal(view(c).match.phase,'finished');assert.equal(view(c).match.winner,'red');assert(view(c).match.board.every(c=>c.color));}
 await command(f,f.clients[0],'REMATCH',{matchId:f.server.lobby.matchId});for(const c of f.clients){assert.equal(view(c).phase,'lobby');assert.equal(view(c).match,null);}
});
test('failed storage writes never apply or broadcast a successful guess',async()=>{
 const f=await setup();await begin(f);await clue(f);const id=cell(f,'blue');await game(f,f.clients[1],'MARK',{cell:id});const before=JSON.stringify(f.server.lobby);f.storage.fail=true;assert.equal((await game(f,f.clients[1],'GUESS',{cell:id})).error,'SERVER_ERROR');assert.equal(JSON.stringify(f.server.lobby),before);assert(!view(f.clients[3]).match.board[id].revealed);
});
test('an empty timed room keeps its nearest deadline then expires without a result archive',async()=>{
 const f=await setup({mode:'expanded',timerSeconds:10,manualDraw:false});await begin(f);await clue(f);for(const c of f.clients)c.closed=true;await f.server.onClose();assert.equal(f.storage.alarm,f.server.lobby.match.deadline);f.server.lobby.match.deadline=Date.now()-1;await f.server.onAlarm();assert.equal(f.server.lobby.match.active,'red');assert.equal(f.storage.alarm,f.server.lobby.emptySince+EMPTY_ROOM_TTL);
 f.server.lobby.emptySince=Date.now()-EMPTY_ROOM_TTL-1;await f.server.onAlarm();assert.equal(f.server.lobby,null);assert.equal(f.storage.data.size,0);
});
