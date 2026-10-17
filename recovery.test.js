// End-to-end protocol simulations with real rules and isolated socket identities.
// Storage/sockets are in-process adapters, not a Cloudflare or browser runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRoomServer} from './room-server.js';
import {matchCommand,matchView,tickMatch,syncMatch,recoverRoom,missingRoles,replacementOptions,ADMIN_GRACE,PRESENCE_TTL} from './room-match.js';
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

const close=async(f,c)=>{c.closed=true;await f.server.onClose();};
const replace=(f,c,option)=>command(f,c,'REPLACE_SPY',{matchId:f.server.lobby.matchId,version:f.server.lobby.gameVersion,...option});
function clock(t){let now=1000000;t.mock.method(Date,'now',()=>now);return {get now(){return now;},add(ms){now+=ms;}};}
async function pulse(f){for(const c of f.clients)if(!c.closed)await command(f,c,'HEARTBEAT');}
test('required spy disconnect pauses the guess deadline, reconnect waits for admin resume',async t=>{
 const time=clock(t),f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);await clue(f,2);time.add(15000);
 const before=structuredClone(f.server.lobby.match);await close(f,f.clients[2]);const s=f.server.lobby.match;
 assert(s.pause);assert.equal(s.pause.kind,'recovery');assert.equal(s.pause.remaining,45000);assert.equal(s.deadline,null);assert.deepEqual(s.board,before.board);assert.deepEqual(s.clue,before.clue);assert.equal(s.guesses,0);
 assert(view(f.clients[1]).match.recovery.missing.some(r=>r.team==='red'&&r.role==='spy'));assert.equal((await game(f,f.clients[0],'PAUSE')).error,'RECONNECT_REQUIRED');
 time.add(10000);const returned=await connect(f,3);f.clients[2]=returned;assert(view(returned).match.pause);assert(view(returned).match.recovery.canResume);assert.equal((await game(f,f.clients[0],'PAUSE')).type,'ack');assert.equal(f.server.lobby.match.deadline,time.now+45000);assert.equal(f.server.lobby.match.guesses,0);
});
test('extra agent disconnect is harmless until its team has no connected agents',async t=>{
 clock(t);const f=await setup(undefined,5);await begin(f);await close(f,f.clients[1]);assert(!f.server.lobby.match.pause);await close(f,f.clients[4]);assert(f.server.lobby.match.pause);assert(view(f.clients[0]).match.recovery.missing.some(r=>r.role==='agent'&&r.team==='blue'));
 f.clients[1]=await connect(f,2);assert(view(f.clients[1]).match.pause);assert(view(f.clients[0]).match.recovery.canResume);await game(f,f.clients[0],'PAUSE');assert(!f.server.lobby.match.pause);
});
test('one tab closing does not disconnect a seat with another authenticated tab',async t=>{
 clock(t);const f=await setup();await begin(f);const secondTab=await connect(f,3);await close(f,f.clients[2]);assert(!f.server.lobby.match.pause);assert(f.server.online().includes(secondTab.state.playerId));
 await close(f,secondTab);assert(f.server.lobby.match.pause);
});
test('admin gets a 60-second grace period, then oldest connected admitted member inherits',async t=>{
 const time=clock(t),f=await setup();await begin(f);const old=f.server.lobby.adminId;await close(f,f.clients[0]);assert.equal(f.server.lobby.adminAway.since,time.now);assert.equal(f.storage.alarm,time.now+ADMIN_GRACE);
 time.add(59000);await pulse(f);await f.server.onAlarm();assert.equal(f.server.lobby.adminId,old);time.add(1000);await f.server.onAlarm();assert.equal(f.server.lobby.adminId,f.clients[1].state.playerId);assert.equal(f.server.lobby.match.adminId,f.clients[1].state.playerId);assert(!f.server.lobby.adminAway);assert(view(f.clients[1]).match.pause);
 f.clients[0]=await connect(f,1);assert.equal(view(f.clients[0]).adminId,f.clients[1].state.playerId);assert.equal((await command(f,f.clients[0],'LOCK',{locked:true})).error,'ADMIN_ONLY');assert.equal((await game(f,f.clients[1],'PAUSE')).type,'ack');
});
test('admin reconnect before the deadline cancels failover and does not resume play automatically',async t=>{
 const time=clock(t),f=await setup();await begin(f);const admin=f.server.lobby.adminId;await close(f,f.clients[0]);time.add(59000);f.clients[0]=await connect(f,1);await pulse(f);assert(!f.server.lobby.adminAway);time.add(2000);await f.server.onAlarm();assert.equal(f.server.lobby.adminId,admin);assert(f.server.lobby.match.pause);
});
test('pending entrants never inherit admin, and no connected candidate causes no alarm loop',async t=>{
 const time=clock(t),f=await fixture();await f.server.onRequest(req('/create',{name:'Owner',token:token(1)}));const admin=await connect(f,1);await f.server.onRequest(req('/join',{name:'Waiting',token:token(2)}));const pending=await connect(f,2);await close(f,admin);const owner=f.server.lobby.adminId;time.add(60000);await command(f,pending,'HEARTBEAT');await f.server.onAlarm();assert.equal(f.server.lobby.adminId,owner);assert(f.storage.alarm>time.now);assert.equal(view(pending).phase,'waiting');assert(!('recovery'in view(pending)));
});
test('all offline seats keep ownership until an admitted member returns after grace',async t=>{
 const time=clock(t),f=await setup();await begin(f);for(const c of f.clients)c.closed=true;await f.server.onClose();const owner=f.server.lobby.adminId;time.add(60000);await f.server.onAlarm();assert.equal(f.server.lobby.adminId,owner);assert.equal(f.storage.alarm,f.server.lobby.emptySince+EMPTY_ROOM_TTL);f.clients[3]=await connect(f,4);assert.equal(f.server.lobby.adminId,f.clients[3].state.playerId);assert(f.server.lobby.match.pause);
});
test('silent socket expiry is bounded by heartbeat lease and does not remove the saved seat',async t=>{
 const time=clock(t),f=await setup();await begin(f);time.add(50000);for(const c of [f.clients[0],f.clients[1],f.clients[3]])await command(f,c,'HEARTBEAT');time.add(15000);await f.server.onAlarm();assert(f.clients[2].closed);assert.equal(f.clients[2].closeCode,4000);assert(f.server.lobby.match.pause);assert(f.server.lobby.players.some(p=>p.id===f.clients[2].state.playerId));
 f.clients[2]=await connect(f,3);assert(view(f.clients[2]).match.recovery.canResume);assert.equal(view(f.clients[2]).me.role,'spy');
});
test('heartbeats keep presence alive without broadcasting or rewriting match state',async t=>{
 const time=clock(t),f=await setup();await begin(f);const before=JSON.stringify(f.server.lobby),messages=f.clients[1].messages.length;time.add(20000);await command(f,f.clients[0],'HEARTBEAT');assert.equal(JSON.stringify(f.server.lobby),before);assert.equal(f.clients[1].messages.length,messages);assert.equal(f.clients[0].messages.at(-1).type,'heartbeat');assert.equal(f.clients[0].state.seenAt,time.now);
});
test('offline spy can be replaced by a connected same-team agent while one agent remains',async t=>{
 clock(t);const f=await setup(undefined,5);await begin(f);await clue(f,2);await game(f,f.clients[1],'MARK',{cell:0});await close(f,f.clients[0]);
 // Explicitly transfer the offline host for this test; timed failover is tested above.
 f.server.lobby.adminId=f.clients[2].state.playerId;f.server.lobby.match.adminId=f.clients[2].state.playerId;f.server.publish();const before=structuredClone(f.server.lobby.match);
 const options=view(f.clients[2]).match.recovery.replacements;assert.equal(options.length,2);const option=options.find(o=>o.targetId===f.clients[1].state.playerId);assert.equal((await replace(f,f.clients[2],option)).type,'ack');
 const m=f.server.lobby.match;assert.deepEqual(m.board,before.board);assert.deepEqual(m.clue,before.clue);assert.deepEqual(m.teams,before.teams);assert.equal(m.guesses,before.guesses);assert.deepEqual(m.pause,before.pause);assert(m.pause);assert.equal(view(f.clients[1]).me.role,'spy');assert(view(f.clients[1]).match.board.every(c=>c.color));assert(!m.marks['0'].includes(f.clients[1].state.playerId));
 assert.equal(view(f.clients[4]).me.role,'agent');assert(view(f.clients[4]).match.board.every(c=>c.color===null));assert(view(f.clients[2]).match.recovery.canResume);
});
test('returning replaced spy becomes spectator with no key, hand, scans, marks or gameplay permissions',async t=>{
 clock(t);const f=await setup(undefined,5);await begin(f);await close(f,f.clients[0]);f.server.lobby.adminId=f.clients[2].state.playerId;f.server.lobby.match.adminId=f.clients[2].state.playerId;f.server.publish();await replace(f,f.clients[2],view(f.clients[2]).match.recovery.replacements[0]);
 const old=await connect(f,1),m=view(old).match;assert.equal(view(old).me.role,'spectator');assert.equal(m.me.role,'spectator');assert(m.board.every(c=>c.color===null&&c.marks.length===0));assert.deepEqual(m.hand,[]);assert.deepEqual(m.scans,[]);
 await game(f,f.clients[2],'PAUSE');for(const type of ['MARK','CLUE','GUESS','DRAW','SCAN','SWAP','END'])assert.equal((await game(f,old,type,{cell:0,count:1,text:'اختبار لغوي'})).error,'SPECTATOR_ONLY');assert.equal((await command(f,old,'ASSIGN',{targetId:old.state.playerId,team:'blue',role:'agent'})).error,'LOBBY_ONLY');
});
test('replacement rejects last agents, opponents, spectators, pending players, online spies and nonadmins',async t=>{
 clock(t);const f=await setup(undefined,5);await begin(f);await close(f,f.clients[0]);const host=f.clients[2];f.server.lobby.adminId=host.state.playerId;f.server.lobby.match.adminId=host.state.playerId;f.server.publish();const option=view(host).match.recovery.replacements[0];
 assert.equal((await replace(f,f.clients[1],option)).error,'ADMIN_ONLY');assert.equal((await replace(f,host,{...option,targetId:f.clients[3].state.playerId})).error,'REPLACEMENT_INVALID');
 await close(f,f.clients[4]);assert.equal((await replace(f,host,option)).error,'REPLACEMENT_INVALID');f.clients[4]=await connect(f,5);f.clients[0]=await connect(f,1);assert.equal((await replace(f,host,option)).error,'REPLACEMENT_INVALID');
 await game(f,host,'PAUSE');assert.equal((await replace(f,host,option)).error,'RECOVERY_ONLY');
});
test('stale replacement confirmations cannot replace a different spy or a newer match',async t=>{
 clock(t);const f=await setup(undefined,5);await begin(f);await close(f,f.clients[0]);f.server.lobby.adminId=f.clients[2].state.playerId;f.server.lobby.match.adminId=f.clients[2].state.playerId;f.server.publish();const option=view(f.clients[2]).match.recovery.replacements[0];
 assert.equal((await replace(f,f.clients[2],{...option,spyId:'forged'})).error,'REPLACEMENT_INVALID');const packet={matchId:f.server.lobby.matchId,version:f.server.lobby.gameVersion,...option};await command(f,f.clients[2],'REPLACE_SPY',packet);assert.equal((await command(f,f.clients[2],'REPLACE_SPY',packet)).error,'STALE_ACTION');packet.matchId='old-match';assert.equal((await command(f,f.clients[2],'REPLACE_SPY',packet)).error,'STALE_MATCH');
});
test('manual pause survives disconnect and reconnect without restarting or auto-resuming',async t=>{
 const time=clock(t),f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);await clue(f);time.add(10000);await game(f,f.clients[0],'PAUSE');const saved=f.server.lobby.match.pause.remaining;await close(f,f.clients[2]);time.add(20000);f.clients[2]=await connect(f,3);assert.equal(f.server.lobby.match.pause.kind,'manual');assert.equal(f.server.lobby.match.pause.remaining,saved);await game(f,f.clients[0],'PAUSE');assert.equal(f.server.lobby.match.deadline,time.now+saved);
});
test('pregame recovery still conceals both keys and preserves unclaimed manual draws',async t=>{
 clock(t);const f=await setup({mode:'expanded',timerSeconds:60,manualDraw:true});await game(f,f.clients[0],'DRAW');await close(f,f.clients[2]);assert(f.server.lobby.match.pause);assert(f.server.lobby.match.teams.red.pendingDraw);for(const c of [f.clients[0],f.clients[1],f.clients[3]])assert(view(c).match.board.every(c=>c.color===null));assert.equal((await game(f,f.clients[0],'BEGIN')).error,'RECONNECT_REQUIRED');f.clients[2]=await connect(f,3);await game(f,f.clients[0],'PAUSE');assert.equal((await game(f,f.clients[0],'BEGIN')).error,'GAME_RULE');await game(f,f.clients[2],'DRAW');await begin(f);assert(view(f.clients[2]).match.board.every(c=>c.color));
});
test('Second Chance recovery preserves both its decision time and saved guessing time',async t=>{
 const time=clock(t),f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);f.server.lobby.match.teams.blue.turns=2;f.server.lobby.match.teams.blue.hand=[{id:900,type:'second',usableTurn:2}];f.server.publish();await clue(f,2);time.add(10000);await guess(f,cell(f,'neutral'));time.add(3000);await close(f,f.clients[2]);assert.equal(f.server.lobby.match.pause.remaining,7000);assert.equal(f.server.lobby.match.remainingMs,50000);time.add(20000);f.clients[2]=await connect(f,3);await game(f,f.clients[0],'PAUSE');assert.equal(f.server.lobby.match.deadline,time.now+7000);await game(f,f.clients[1],'SECOND');assert.equal(f.server.lobby.match.deadline,time.now+50000);
});
test('recovery survives storage recreation without resetting host grace, clues or saved time',async t=>{
 const time=clock(t),f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false});await begin(f);await clue(f);time.add(5000);await close(f,f.clients[0]);const saved=structuredClone(f.server.lobby);time.add(20000);const g=await fixture(f.storage);const agent=await connect(g,2);assert.equal(g.server.lobby.adminAway.since,saved.adminAway.since);assert.equal(view(agent).match.id,saved.matchId);assert.equal(g.server.lobby.match.pause.remaining,saved.match.pause.remaining);assert.deepEqual(g.server.lobby.match.clues,saved.match.clues);
});
test('rematch releases former spies to normal lobby roles only after deleting the old board',async t=>{
 clock(t);const f=await setup(undefined,5);await begin(f);await close(f,f.clients[0]);f.server.lobby.adminId=f.clients[2].state.playerId;f.server.lobby.match.adminId=f.clients[2].state.playerId;f.server.publish();await replace(f,f.clients[2],view(f.clients[2]).match.recovery.replacements[0]);const old=f.clients[0].state.playerId;await command(f,f.clients[2],'REMATCH',{matchId:f.server.lobby.matchId});assert.equal(f.server.lobby.players.find(p=>p.id===old).role,'agent');assert(!f.server.lobby.match);assert.equal(f.server.lobby.phase,'lobby');
});
test('expired guessing deadline wins the race before disconnect recovery freezes the next turn',async t=>{
 const time=clock(t),f=await setup({mode:'expanded',timerSeconds:10,manualDraw:false});await begin(f);await clue(f);time.add(10000);await close(f,f.clients[2]);assert.equal(f.server.lobby.match.active,'red');assert.equal(f.server.lobby.match.phase,'clue');assert(f.server.lobby.match.pause);assert.equal(f.server.lobby.match.pause.remaining,null);assert.equal(f.server.lobby.match.teams.blue.streak,0);
});
test('failed storage write cannot partially promote a spy or expose a replacement key',async t=>{
 clock(t);const f=await setup(undefined,5);await begin(f);await close(f,f.clients[0]);f.server.lobby.adminId=f.clients[2].state.playerId;f.server.lobby.match.adminId=f.clients[2].state.playerId;f.server.publish();const option=view(f.clients[2]).match.recovery.replacements[0],before=JSON.stringify(f.server.lobby);f.storage.fail=true;assert.equal((await replace(f,f.clients[2],option)).error,'SERVER_ERROR');assert.equal(JSON.stringify(f.server.lobby),before);assert.equal(view(f.clients[1]).me.role,'agent');assert(view(f.clients[1]).match.board.every(c=>c.color===null));
});

test('complete failover, spy promotion, original-seat return and resume keep the live match intact',async t=>{
 const time=clock(t),f=await setup({mode:'expanded',timerSeconds:60,manualDraw:false},5);await begin(f);await clue(f,3);time.add(5000);const before=structuredClone(f.server.lobby.match);await close(f,f.clients[0]);time.add(50000);await pulse(f);time.add(10000);await f.server.onAlarm();const host=f.clients[1];assert.equal(f.server.lobby.adminId,host.state.playerId);const option=view(host).match.recovery.replacements.find(o=>o.targetId===host.state.playerId);assert(option);await replace(f,host,option);assert.equal(view(host).me.role,'spy');f.clients[0]=await connect(f,1);assert.equal(view(f.clients[0]).me.role,'spectator');assert.equal(view(f.clients[0]).adminId,host.state.playerId);assert.equal((await game(f,host,'PAUSE')).type,'ack');const m=f.server.lobby.match;assert.deepEqual(m.board,before.board);assert.deepEqual(m.clue,before.clue);assert.equal(m.guesses,before.guesses);assert.equal(m.deadline,time.now+55000);assert.deepEqual(m.teams,before.teams);assert(!view(f.clients[0]).match.board.some(c=>c.color));
});

test('existing 3B socket attachments receive bounded leases during the upgrade',async t=>{
 const time=clock(t),f=await setup();await begin(f);const legacy=f.clients[2];delete legacy.state.seenAt;await command(f,f.clients[0],'HEARTBEAT');assert.equal(legacy.state.seenAt,time.now);time.add(50000);for(const c of [f.clients[0],f.clients[1],f.clients[3]])await command(f,c,'HEARTBEAT');time.add(15000);await f.server.onAlarm();assert(legacy.closed);assert(f.server.lobby.match.pause);
});
