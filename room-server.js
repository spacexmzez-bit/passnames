import {matchCommand,matchView,tickMatch,syncMatch,GameRuleError,recoverRoom,recoveryView,ADMIN_GRACE,PRESENCE_TTL} from './room-match.js';
import {RoomError,createLobby,joinLobby,lobbyAction,lobbyView,memberForHash,readiness,EMPTY_ROOM_TTL} from './room-core.js';
export async function sessionHash(token){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new RoomError('SESSION_INVALID',401);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function errorResponse(error){return Response.json({ok:false,error:error instanceof RoomError?error.code:'SERVER_ERROR'},{status:error instanceof RoomError?error.status:500,headers:{'Cache-Control':'no-store'}});}
export async function readJSON(request){
 if(!request.headers.get('Content-Type')?.includes('application/json'))throw new RoomError('JSON_REQUIRED',415);
 if(Number(request.headers.get('Content-Length'))>8192)throw new RoomError('TOO_LARGE',413);
 const reader=request.body?.getReader();let size=0;const chunks=[];
 if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new RoomError('TOO_LARGE',413);}chunks.push(value);}}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const text=new TextDecoder().decode(bytes);
 try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new RoomError('BAD_JSON');}
}
// Base injection keeps transport/storage logic independently testable in Node.
export function makeRoomServer(Base,words=[]){return class extends Base{
 static options={hibernate:true};
 lobby=null;
 work=Promise.resolve();
 exclusive(fn){const operation=this.work.then(fn);this.work=operation.catch(()=>{});return operation;}
 async onStart(){
  this.lobby=await this.ctx.storage.get('lobby')||null;
  if(this.ctx.setWebSocketAutoResponse&&typeof WebSocketRequestResponsePair!=='undefined')this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
 }
 sockets(){return [...this.getConnections()];}
 online(now=Date.now()){return [...new Set(this.sockets().filter(c=>!c.state?.expired&&(c.state?.seenAt==null||now-c.state.seenAt<PRESENCE_TTL)).map(c=>c.state?.playerId).filter(id=>this.lobby?.players.some(p=>p.id===id)))];}
 expireConnections(now){
  let changed=false;
  for(const c of this.sockets()){
   if(!c.state?.playerId||c.state.expired)continue;
   // Attachments from a running 3B room get one bounded lease on first 3C activity.
   if(c.state.seenAt==null){c.setState({...c.state,seenAt:now});changed=true;}
   else if(now-c.state.seenAt>=PRESENCE_TTL){c.setState({...c.state,expired:true});c.close(4000,'PRESENCE_EXPIRED');changed=true;}
  }
  return changed;
 }
 send(connection,value){try{connection.send(JSON.stringify(value));}catch{/* close handling broadcasts current presence */}}
 async persist(next){
  if(!next?.adminId){await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();this.lobby=null;return;}
  await this.ctx.storage.put('lobby',next);this.lobby=next;
 }
 async schedule(){
  if(!this.lobby)return;
  const present=this.online().length>0;
  if(present&&this.lobby.emptySince!==null)await this.persist({...this.lobby,emptySince:null});
  if(!present&&this.lobby.emptySince===null)await this.persist({...this.lobby,emptySince:Date.now()});
  const deadlines=[];
  for(const c of this.sockets())if(c.state?.playerId&&!c.state.expired&&c.state.seenAt!=null)deadlines.push(c.state.seenAt+PRESENCE_TTL);
  const away=this.lobby.adminAway;
  if(away&&(away.since+ADMIN_GRACE>Date.now()||this.online().some(id=>id!==away.id&&this.lobby.players.some(p=>p.id===id&&p.status==='admitted'))))deadlines.push(away.since+ADMIN_GRACE);
  if(this.lobby.emptySince!==null)deadlines.push(this.lobby.emptySince+EMPTY_ROOM_TTL);
  if(this.lobby.match?.deadline!=null&&!this.lobby.match.pause)deadlines.push(this.lobby.match.deadline);
  if(deadlines.length)await this.ctx.storage.setAlarm(Math.min(...deadlines));else await this.ctx.storage.deleteAlarm();
 }
 async advance(){
  if(!this.lobby)return;
  const now=Date.now(),expired=this.expireConnections(now);
  const next=recoverRoom(tickMatch(this.lobby,now),this.online(now),now);
  if(next!==this.lobby){await this.persist(next);await this.schedule();this.publish();}
  else if(expired){await this.schedule();this.publish();}
 }
 async expireIfNeeded(){
  if(this.lobby&&this.lobby.emptySince!==null&&Date.now()-this.lobby.emptySince>=EMPTY_ROOM_TTL&&!this.online().length){
   await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();this.lobby=null;
   for(const c of this.sockets()){this.send(c,{type:'removed',reason:'ROOM_NOT_FOUND'});c.close(4404,'ROOM_NOT_FOUND');}
  }
 }
 publish(){
  const online=this.online();
  for(const c of this.sockets()){
   const id=c.state?.playerId;if(!id)continue;
   if(!this.lobby?.players.some(p=>p.id===id)){const reason=this.lobby?'REMOVED':'ROOM_NOT_FOUND';this.send(c,{type:'removed',reason});c.close(this.lobby?4403:4404,reason);continue;}
   const room=lobbyView(this.lobby,id,online);
   if(room.phase!=='waiting'){room.match=matchView(this.lobby,id,online);room.recovery=recoveryView(this.lobby,online);}
   this.send(c,{type:'snapshot',serverNow:Date.now(),room});
  }
 }
 async onRequest(request){return this.exclusive(async()=>{
  try{
   if(request.method==='GET'&&new URL(request.url).pathname==='/health')return Response.json({ok:true,service:'Rooms',phase:'3C'});
   if(request.method!=='POST')throw new RoomError('NOT_FOUND',404);
   const path=new URL(request.url).pathname;if(!['/create','/join'].includes(path))throw new RoomError('NOT_FOUND',404);
   const data=await readJSON(request);await this.expireIfNeeded();await this.advance();
   const hash=await sessionHash(data.token);let member;
   if(path==='/create'){
    if(this.lobby)throw new RoomError('ROOM_EXISTS',409);
    const next=createLobby(this.name,data.name,hash,data.settings);
    await this.persist(next);member=next.players[0];
   }else{
    const result=joinLobby(this.lobby,data.name,hash);await this.persist(result.state);member=result.member;
   }
   await this.schedule();this.publish();
   return Response.json({ok:true,code:this.lobby.code,playerId:member.id,status:member.status},{status:path==='/create'?201:200,headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error);}
 });}
 async onConnect(connection){
  if(!this.lobby){connection.close(4404,'ROOM_NOT_FOUND');return;}
  if(this.sockets().length>40){connection.close(4429,'TOO_MANY_CONNECTIONS');return;}
  this.send(connection,{type:'hello'});
 }
 async onMessage(connection,message){return this.exclusive(async()=>{
  let requestId=null;
  try{
   if(message==='ping'){try{connection.send('pong');}catch{}return;}
   if(typeof message!=='string'||message.length>8192)throw new RoomError('TOO_LARGE',413);
   let data;try{data=JSON.parse(message);}catch{throw new RoomError('BAD_JSON');}
   if(!data||typeof data!=='object'||Array.isArray(data))throw new RoomError('BAD_JSON');
   requestId=typeof data.requestId==='string'?data.requestId.slice(0,80):null;
   await this.expireIfNeeded();await this.advance();if(!this.lobby)throw new RoomError('ROOM_NOT_FOUND',404);
   if(data.type==='AUTH'){
    if(connection.state?.playerId)throw new RoomError('BAD_ACTION');
    const member=memberForHash(this.lobby,await sessionHash(data.token));
    if(!member)throw new RoomError('SESSION_INVALID',401);
    if(this.sockets().filter(c=>c.state?.playerId===member.id&&!c.state.expired).length>=4)throw new RoomError('TOO_MANY_CONNECTIONS',429);
    connection.setState({playerId:member.id,windowAt:Date.now(),count:0,seenAt:Date.now()});
    await this.advance();await this.schedule();this.publish();return;
   }
   const identity=connection.state; if(!identity?.playerId)throw new RoomError('SESSION_INVALID',401);
   if(identity.expired)throw new RoomError('DISCONNECTED',409);
   if(!this.lobby.players.some(p=>p.id===identity.playerId))throw new RoomError('SESSION_INVALID',401);
   if(data.type==='HEARTBEAT'){
    connection.setState({...identity,seenAt:Date.now()});await this.schedule();this.send(connection,{type:'heartbeat'});return;
   }
   const now=Date.now(),windowAt=now-identity.windowAt>10000?now:identity.windowAt;
   const count=windowAt===identity.windowAt?identity.count+1:1;
   connection.setState({...identity,windowAt,count,seenAt:now});if(count>45)throw new RoomError('RATE_LIMIT',429);
   const next=['LAUNCH','REMATCH','GAME','REPLACE_SPY'].includes(data.type)
    ?matchCommand(this.lobby,identity.playerId,data,this.online(),words,now)
    :syncMatch(lobbyAction(this.lobby,identity.playerId,data,this.online(),now),now);
   await this.persist(next);await this.advance();await this.schedule();
   this.send(connection,{type:'ack',requestId});this.publish();
  }catch(error){
   this.send(connection,{type:'error',requestId,error:error instanceof RoomError?error.code:error instanceof GameRuleError?'GAME_RULE':'SERVER_ERROR',...(error instanceof GameRuleError?{message:error.message}:{})});
   if(['SESSION_INVALID','ROOM_NOT_FOUND'].includes(error.code))connection.close(4401,error.code);
  }
 });}
 async onClose(){return this.exclusive(async()=>{await this.advance();await this.schedule();this.publish();});}
 async onError(){return this.onClose();}
 async onAlarm(){return this.exclusive(async()=>{await this.expireIfNeeded();await this.advance();if(this.lobby){await this.schedule();this.publish();}});}
};}
