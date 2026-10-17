// Match commands run only inside the room's serialized server queue.
import {RoomError,readiness} from './room-core.js';
import {createMatch,transition,playerView} from './engine.js';
export const ADMIN_GRACE=60000;
export const PRESENCE_TTL=65000;
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
export function syncMatch(s){
 if(!s.match)return s;
 const next=structuredClone(s);next.match.adminId=next.adminId;
 for(const p of next.match.players){const seat=next.players.find(q=>q.id===p.id);if(seat)p.name=seat.name;}
 return next;
}
function event(m,text){m.log.push({id:m.nextId++,turn:m.turnNumber,team:m.active,text,visibility:'all'});}
export function missingRoles(s,online){
 if(!s.match||s.match.phase==='finished')return [];
 const live=new Set(online),members=new Set(s.players.filter(p=>p.status==='admitted').map(p=>p.id)),missing=[];
 for(const team of ['blue','red']){
  const spy=s.match.players.find(p=>p.team===team&&p.role==='spy');
  if(!spy||!members.has(spy.id)||!live.has(spy.id))missing.push({team,role:'spy',playerId:spy?.id||null,name:spy?.name||''});
  if(!s.match.players.some(p=>p.team===team&&p.role==='agent'&&members.has(p.id)&&live.has(p.id)))missing.push({team,role:'agent',playerId:null,name:''});
 }
 return missing;
}
// Presence and host recovery run on authenticated activity, close events and alarms.
// Reconnection clears the reason for stopping; the admin explicitly resumes the timer.
export function recoverRoom(state,online,now=Date.now()){
 if(!state?.adminId)return state;
 let s=state;const edit=()=>{if(s===state)s=structuredClone(state);};
 const admitted=state.players.filter(p=>p.status==='admitted'),live=new Set(online);
 if(live.has(state.adminId)){
  if(state.adminAway){edit();delete s.adminAway;}
 }else{
  if(state.adminAway?.id!==state.adminId){edit();s.adminAway={id:state.adminId,since:now};}
  if(now-s.adminAway.since>=ADMIN_GRACE){
   const next=admitted.find(p=>live.has(p.id));
   if(next){edit();s.adminNotice={fromId:s.adminId,toId:next.id,at:now};s.adminId=next.id;delete s.adminAway;
    if(s.match){s.match.adminId=next.id;s.gameVersion++;event(s.match,'انتقلت إدارة الغرفة تلقائيًا إلى «'+next.name+'».');}
   }
  }
 }
 if(s.phase==='ready'&&!readiness(s,online).ready){edit();s.phase='lobby';}
 if(s.match){
  const missing=missingRoles(s,online);
  if(missing.length&&!s.match.pause){
   edit();const m=s.match;m.pause={remaining:m.deadline===null?null:Math.max(0,m.deadline-now),kind:'recovery'};m.deadline=null;s.gameVersion++;
   event(m,'أُوقفت المباراة لانتظار اتصال اللاعبين الأساسيين.');
  }
 }
 if(s!==state){s.revision++;s.updatedAt=now;}return s;
}
export function replacementOptions(s,online){
 if(!s.match?.pause||s.match.phase==='finished')return [];
 const live=new Set(online),members=new Set(s.players.filter(p=>p.status==='admitted').map(p=>p.id));
 return missingRoles(s,online).filter(r=>r.role==='spy').flatMap(r=>{
  const agents=s.match.players.filter(p=>p.team===r.team&&p.role==='agent'&&members.has(p.id)&&live.has(p.id));
  return agents.length<2?[]:agents.map(p=>({team:r.team,targetId:p.id,name:p.name,spyId:r.playerId}));
 });
}
export function recoveryView(s,online){
 return {adminDeadline:s.adminAway?s.adminAway.since+ADMIN_GRACE:null,adminName:s.players.find(p=>p.id===s.adminId)?.name||'',notice:s.adminNotice||null};
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
  const next={...s,players:s.players.map(p=>p.role==='spectator'?{...p,role:'agent'}:p),phase:'lobby',revision:s.revision+1,updatedAt:now};
  delete next.match;delete next.matchId;delete next.gameVersion;return next;
 }
 if(data.type==='REPLACE_SPY'){
  need(actorId===s.adminId,'ADMIN_ONLY',403);need(data.version===s.gameVersion,'STALE_ACTION');
  need(s.match.pause&&s.match.phase!=='finished','RECOVERY_ONLY');
  const option=replacementOptions(s,online).find(o=>o.targetId===data.targetId&&o.team===data.team&&o.spyId===data.spyId);
  need(option,'REPLACEMENT_INVALID');
  const next=structuredClone(s),m=next.match,old=m.players.find(p=>p.id===option.spyId),replacement=m.players.find(p=>p.id===option.targetId);
  if(old){old.role='spectator';const seat=next.players.find(p=>p.id===old.id);if(seat)seat.role='spectator';}
  replacement.role='spy';next.players.find(p=>p.id===replacement.id).role='spy';
  for(const key of Object.keys(m.marks))m.marks[key]=m.marks[key].filter(id=>id!==replacement.id);
  next.gameVersion++;next.revision++;next.updatedAt=now;
  event(m,'أصبح «'+replacement.name+'» جاسوسًا بديلًا للفريق '+(option.team==='blue'?'الأزرق':'الأحمر')+'.');
  return next;
 }
 need(data.type==='GAME'&&commands.has(data.action?.type),'BAD_ACTION',400);
 const action=data.action;need(data.turnNumber===s.match.turnNumber,'STALE_ACTION');
 // Marks do not invalidate another agent's reveal. Other changes reject double clicks.
 if(action.type!=='MARK')need(data.version===s.gameVersion,'STALE_ACTION');
 need(s.match.players.some(p=>p.id===actorId),'NO_MATCH',403);
 if(action.type==='BEGIN'||action.type==='PAUSE'&&s.match.pause){
  need(!missingSeats(s),'MISSING_SEATS');need(missingRoles(s,online).length===0,'RECONNECT_REQUIRED');
 }
 if(action.type==='PAUSE'){
  need(actorId===s.adminId,'ADMIN_ONLY',403);need(s.match.phase!=='finished','NO_MATCH');
  const next=structuredClone(s),m=next.match;
  if(m.pause){m.deadline=m.pause.remaining===null?null:now+m.pause.remaining;m.pause=null;event(m,'استؤنفت المباراة.');}
  else{m.pause={remaining:m.deadline===null?null:Math.max(0,m.deadline-now),kind:'manual'};m.deadline=null;event(m,'أُوقفت المباراة مؤقتًا.');}
  next.gameVersion++;next.revision++;next.updatedAt=now;return next;
 }
 need(actor.role!=='spectator','SPECTATOR_ONLY',403);
 if(action.type==='GUESS')need((s.match.marks[String(action.cell)]||[]).some(id=>s.match.players.some(p=>p.id===id&&p.role==='agent'&&p.team===actor.team)),'SUSPECT_FIRST',400);
 // Never trust a playerId, timer, board, role or settings supplied by the browser.
 const clean={type:action.type,playerId:actorId};
 if(['MARK','GUESS','SCAN'].includes(action.type))clean.cell=action.cell;
 if(action.type==='SWAP')clean.cells=action.cells;
 if(action.type==='CLUE'){clean.text=action.text;clean.count=action.count;}
 const next=changed(s,run(s.match,clean,now,rng),now);
 if(action.type!=='MARK')next.gameVersion++;return next;
}
export function matchView(s,playerId,online=s.players.map(p=>p.id)){
 if(!s.match||!s.match.players.some(p=>p.id===playerId))return null;
 return {...playerView(s.match,playerId),id:s.matchId,version:s.gameVersion,missingSeats:missingSeats(s),recovery:{missing:missingRoles(s,online),kind:s.match.pause?.kind||'manual',remainingMs:s.match.pause?.remaining??null,canResume:missingRoles(s,online).length===0,replacements:playerId===s.adminId?replacementOptions(s,online):[]}};
}
