// Match commands run only inside the room's serialized server queue.
import {RoomError,readiness} from './room-core.js';
import {createMatch,transition,playerView} from './engine.js';
const commands=new Set(['MARK','CLUE','GUESS','END','DRAW','BEGIN','SCAN','SWAP','SECOND','DECLINE','PAUSE']);
const need=(ok,code,status=409)=>{if(!ok)throw new RoomError(code,status);};
export class GameRuleError extends Error {}
export function secureRandom(){return crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;}
function run(match,action,now,rng){try{return transition(match,action,now,rng);}catch(e){throw new GameRuleError(e.message);}}
const changed=(s,match,now)=>({...s,match,revision:s.revision+1,updatedAt:now});
export function tickMatch(s,now=Date.now(),rng=secureRandom){
 if(!s.match||s.match.pause||s.match.deadline===null||now<s.match.deadline)return s;
 const next=changed(s,run(s.match,{type:'TICK'},now,rng),now);next.gameVersion++;return next;
}
export function missingSeats(s){
 if(!s.match)return false;
 const seats=s.players.filter(p=>p.status==='admitted');
 return ['blue','red'].some(team=>!s.match.players.some(p=>p.team===team&&p.role==='spy'&&seats.some(q=>q.id===p.id))||!s.match.players.some(p=>p.team===team&&p.role==='agent'&&seats.some(q=>q.id===p.id)));
}
export function syncMatch(s,now=Date.now()){
 if(!s.match)return s;
 const next=structuredClone(s),m=next.match;
 m.adminId=next.adminId;
 for(const p of m.players){const seat=next.players.find(q=>q.id===p.id);if(seat)p.name=seat.name;}
 // Departed seats cannot be replaced after seeing the key. A rematch restores roles.
 if(missingSeats(next)&&!['deal','finished'].includes(m.phase)&&!m.pause){
  m.pause={remaining:m.deadline===null?null:Math.max(0,m.deadline-now)};m.deadline=null;next.gameVersion++;
 }
 return next;
}
export function matchCommand(s,actorId,data,online,words,now=Date.now(),rng=secureRandom){
 const actor=s.players.find(p=>p.id===actorId);
 need(actor,'SESSION_INVALID',401);need(actor.status==='admitted','APPROVAL_REQUIRED',403);
 if(data.type==='LAUNCH'){
  need(actorId===s.adminId,'ADMIN_ONLY',403);need(s.phase==='ready'&&!s.match,'LOBBY_ONLY');
  const check=readiness(s,online);need(check.ready,check.problems[0]?.code||'INCOMPLETE_TEAMS');
  const roster=s.players.filter(p=>p.status==='admitted').map(({id,name,team,role})=>({id,name,team,role}));
  const match=createMatch(s.settings,roster,words,now,rng);match.adminId=s.adminId;
  return {...changed(s,match,now),phase:'playing',matchId:crypto.randomUUID(),gameVersion:1};
 }
 need(s.match&&s.phase==='playing','NO_MATCH');need(data.matchId===s.matchId,'STALE_MATCH');
 if(data.type==='REMATCH'){
  need(actorId===s.adminId,'ADMIN_ONLY',403);
  const next={...s,phase:'lobby',revision:s.revision+1,updatedAt:now};
  delete next.match;delete next.matchId;delete next.gameVersion;return next;
 }
 need(data.type==='GAME'&&commands.has(data.action?.type),'BAD_ACTION',400);
 const action=data.action;need(data.turnNumber===s.match.turnNumber,'STALE_ACTION');
 // Marks do not invalidate another agent's reveal. Other changes reject double clicks.
 if(action.type!=='MARK')need(data.version===s.gameVersion,'STALE_ACTION');
 need(s.match.players.some(p=>p.id===actorId),'NO_MATCH',403);
 if(action.type==='BEGIN'||action.type==='PAUSE'&&s.match.pause)need(!missingSeats(s),'MISSING_SEATS');
 if(action.type==='GUESS')need((s.match.marks[String(action.cell)]||[]).some(id=>s.match.players.some(p=>p.id===id&&p.role==='agent'&&p.team===actor.team)),'SUSPECT_FIRST',400);
 // Never trust a playerId, timer, board, role or settings supplied by the browser.
 const clean={type:action.type,playerId:actorId};
 if(['MARK','GUESS','SCAN'].includes(action.type))clean.cell=action.cell;
 if(action.type==='SWAP')clean.cells=action.cells;
 if(action.type==='CLUE'){clean.text=action.text;clean.count=action.count;}
 const next=changed(s,run(s.match,clean,now,rng),now);
 if(action.type!=='MARK')next.gameVersion++;return next;
}
export function matchView(s,playerId){
 if(!s.match||!s.match.players.some(p=>p.id===playerId))return null;
 return {...playerView(s.match,playerId),id:s.matchId,version:s.gameVersion,missingSeats:missingSeats(s)};
}
