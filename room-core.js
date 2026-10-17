// Authoritative lobby rules. Session hashes stay on the server; no board exists in 3A.
export const ROOM_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const EMPTY_ROOM_TTL=60*60*1000;
export class RoomError extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status;} }
const requireThat=(value,code,status=400)=>{if(!value)throw new RoomError(code,status);};
export function normalizeCode(value){return String(value??'').replace(/[\s-]/g,'').toUpperCase();}
export function validCode(value){return typeof value==='string'&&value.length===9&&[...value].every(c=>ROOM_ALPHABET.includes(c));}
export function randomCode(){const bytes=crypto.getRandomValues(new Uint8Array(9));return [...bytes].map(n=>ROOM_ALPHABET[n%32]).join('');}
export function cleanName(value){requireThat(typeof value==='string','NAME_REQUIRED');const name=value.normalize('NFKC').trim().replace(/\s+/g,' ');requireThat(name.length>=1&&name.length<=24&&!/[\p{Cc}\p{Cf}]/u.test(name),'NAME_INVALID');return name;}
export function lobbySettings(value={}){
 const mode=value.mode??'standard', timerSeconds=value.timerSeconds??0;
 requireThat(['standard','expanded'].includes(mode),'SETTINGS_INVALID');
 requireThat(Number.isInteger(timerSeconds)&&(timerSeconds===0||timerSeconds>=10&&timerSeconds<=600),'TIMER_INVALID');
 return {mode,timerSeconds,manualDraw:mode==='expanded'&&value.manualDraw===true};
}
function checkHash(hash){requireThat(typeof hash==='string'&&/^[0-9a-f]{64}$/.test(hash),'SESSION_INVALID',401);}
function player(name,tokenHash,status,now){return {id:crypto.randomUUID(),name:cleanName(name),tokenHash,status,team:null,role:'agent',joinedAt:now};}
export function createLobby(code,name,hash,settings,now=Date.now()){
 requireThat(validCode(code),'CODE_INVALID');checkHash(hash);
 const owner=player(name,hash,'admitted',now);owner.team='blue';owner.role='spy';
 return {schema:1,code,createdAt:now,updatedAt:now,emptySince:now,revision:1,locked:true,phase:'lobby',adminId:owner.id,settings:lobbySettings(settings),players:[owner],blockedHashes:[]};
}
export function memberForHash(s,hash){return s?.players.find(p=>p.tokenHash===hash)||null;}
export function joinLobby(state,name,hash,now=Date.now()){
 requireThat(state&&state.adminId,'ROOM_NOT_FOUND',404);checkHash(hash);
 requireThat(!state.blockedHashes.includes(hash),'REMOVED',403);
 const known=memberForHash(state,hash);if(known)return {state,member:known};
 const trimmed=cleanName(name);
 requireThat(!state.players.some(p=>p.name.toLocaleLowerCase()===trimmed.toLocaleLowerCase()),'NAME_TAKEN',409);
 requireThat(state.players.filter(p=>p.status==='admitted').length<10,'ROOM_FULL',409);
 requireThat(state.players.filter(p=>p.status==='pending').length<10,'WAITING_FULL',429);
 const s=structuredClone(state),newPlayer=player(trimmed,hash,s.locked||s.phase!=='lobby'?'pending':'admitted',now);
 s.players.push(newPlayer);s.updatedAt=now;s.revision++;
 return {state:s,member:newPlayer};
}
export function readiness(s,onlineIds=[]){
 const approved=s.players.filter(p=>p.status==='admitted'),online=new Set(onlineIds),problems=[];
 if(approved.length<4)problems.push({code:'NEED_FOUR'});
 if(approved.some(p=>!p.team))problems.push({code:'ASSIGN_EVERYONE'});
 for(const team of ['blue','red']){
  if(approved.filter(p=>p.team===team&&p.role==='spy').length!==1)problems.push({code:'SPY_REQUIRED',team});
  if(!approved.some(p=>p.team===team&&p.role==='agent'))problems.push({code:'AGENT_REQUIRED',team});
  if(!approved.some(p=>p.team===team&&p.role==='spy'&&online.has(p.id))||!approved.some(p=>p.team===team&&p.role==='agent'&&online.has(p.id)))problems.push({code:'OFFLINE_PLAYERS',team});
 }
 return {ready:problems.length===0,problems};
}
export function lobbyAction(state,actorId,action,onlineIds=[],now=Date.now()){
 requireThat(state,'ROOM_NOT_FOUND',404);
 const s=structuredClone(state),actor=s.players.find(p=>p.id===actorId);
 requireThat(actor,'SESSION_INVALID',401);
 const admin=actor.id===s.adminId;
 if(action.type==='LEAVE'){
  if(actor.status==='admitted'&&s.phase==='ready')s.phase='lobby';
  s.players=s.players.filter(p=>p.id!==actorId);
  if(admin){const candidates=s.players.filter(p=>p.status==='admitted');s.adminId=(candidates.find(p=>onlineIds.includes(p.id))||candidates[0])?.id||null;s.phase='lobby';}
  // Closing the last admitted seat removes pending members too; nobody can claim admin later.
  if(!s.adminId)s.players=[];
 }else{
  requireThat(actor.status==='admitted','APPROVAL_REQUIRED',403);
  if(['LOCK','APPROVE','REJECT','KICK','SETTINGS','START','BACK'].includes(action.type))requireThat(admin,'ADMIN_ONLY',403);
  if(action.type==='LOCK')requireThat(typeof action.locked==='boolean','BAD_ACTION');
  if(action.type==='LOCK')s.locked=action.locked;
  else if(action.type==='APPROVE'){
   requireThat(s.phase==='lobby','LOBBY_ONLY',409);
   const target=s.players.find(p=>p.id===action.targetId&&p.status==='pending');requireThat(target,'PLAYER_NOT_FOUND',404);
   requireThat(s.players.filter(p=>p.status==='admitted').length<10,'ROOM_FULL',409);target.status='admitted';
  }else if(action.type==='REJECT'||action.type==='KICK'){
   requireThat(action.targetId!==s.adminId,'CANNOT_KICK_ADMIN');
   const target=s.players.find(p=>p.id===action.targetId&&(action.type==='REJECT'?p.status==='pending':p.status==='admitted'));requireThat(target,'PLAYER_NOT_FOUND',404);
   s.blockedHashes.push(target.tokenHash);s.players=s.players.filter(p=>p.id!==target.id);
   if(s.phase==='ready')s.phase='lobby';
  }else if(action.type==='ASSIGN'){
   requireThat(s.phase==='lobby','LOBBY_ONLY',409);requireThat(admin||action.targetId===actor.id,'SELF_ONLY',403);
   const target=s.players.find(p=>p.id===action.targetId&&p.status==='admitted');requireThat(target,'PLAYER_NOT_FOUND',404);
   requireThat([null,'blue','red'].includes(action.team)&&['spy','agent'].includes(action.role),'ROLE_INVALID');
   requireThat(!(action.team&&action.role==='spy'&&s.players.some(p=>p.status==='admitted'&&p.id!==target.id&&p.team===action.team&&p.role==='spy')),'SPY_TAKEN',409);
   target.team=action.team;target.role=action.role;
  }else if(action.type==='RENAME'){
   const name=cleanName(action.name);requireThat(!s.players.some(p=>p.id!==actor.id&&p.name.toLocaleLowerCase()===name.toLocaleLowerCase()),'NAME_TAKEN',409);actor.name=name;
  }else if(action.type==='SETTINGS'){
   requireThat(s.phase==='lobby','LOBBY_ONLY',409);s.settings=lobbySettings(action.settings);
  }else if(action.type==='START'){
   requireThat(s.phase==='lobby','LOBBY_ONLY',409);
   const check=readiness(s,onlineIds);requireThat(check.ready,check.problems[0]?.code||'INCOMPLETE_TEAMS',409);
   s.phase='ready';
  }else if(action.type==='BACK'){
   s.phase='lobby';
  }else if(action.type!=='LOCK')throw new RoomError('BAD_ACTION');
 }
 s.updatedAt=now;s.revision++;return s;
}
export function lobbyView(s,playerId,onlineIds=[]){
 const me=s.players.find(p=>p.id===playerId);requireThat(me,'SESSION_INVALID',401);
 const online=new Set(onlineIds),isAdmin=me.id===s.adminId;
 const safe=p=>({id:p.id,name:p.name,team:p.team,role:p.role,status:p.status,online:online.has(p.id)});
 if(me.status==='pending')return {code:s.code,revision:s.revision,phase:'waiting',locked:s.locked,me:safe(me),adminId:null,players:[],pending:[],settings:null,readiness:null};
 return {code:s.code,revision:s.revision,phase:s.phase,locked:s.locked,adminId:s.adminId,me:safe(me),settings:{...s.settings},
  players:s.players.filter(p=>p.status==='admitted').map(safe),pending:isAdmin?s.players.filter(p=>p.status==='pending').map(safe):[],readiness:readiness(s,onlineIds)};
}
