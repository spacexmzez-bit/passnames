import {normalizeCode,validCode} from './room-core.js';
import {latinDigits} from './ui-utils.js';
export function newSessionToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function parseRoomCode(input){let text=String(input??'').trim();try{const url=new URL(text);text=url.searchParams.get('room')||text;}catch{}return normalizeCode(latinDigits(text));}
export function roomInvite(baseURL,code){const url=new URL(baseURL);url.search='';url.hash='';url.searchParams.set('room',code);return url.href;}
export function readSeat(code){try{const data=JSON.parse(localStorage.getItem('passnames-seat:'+code));return typeof data?.token==='string'&&/^[a-f0-9]{64}$/.test(data.token)?data:null;}catch{return null;}}
export function saveSeat(code,token){try{localStorage.setItem('passnames-seat:'+code,JSON.stringify({token}));localStorage.setItem('passnames-last-room',code);return true;}catch{return false;}}
export function forgetSeat(code){try{localStorage.removeItem('passnames-seat:'+code);if(localStorage.getItem('passnames-last-room')===code)localStorage.removeItem('passnames-last-room');}catch{}}
export async function enterRoom({name,code,create=false,token,fetcher=fetch}){
 const normalized=parseRoomCode(code);
 if(!create&&!validCode(normalized))throw Error('CODE_INVALID');
 const secret=token||(!create&&readSeat(normalized)?.token)||newSessionToken();
 // Known code: save before POST so a lost join response can be retried without a duplicate seat.
 if(!create)saveSeat(normalized,secret);
 const response=await fetcher(create?'/api/rooms':'/api/rooms/'+normalized+'/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,token:secret}),signal:AbortSignal.timeout(15000)});
 let data;try{data=await response.json();}catch{throw Error('SERVER_ERROR');}
 if(!response.ok||!data.ok)throw Error(data.error||'SERVER_ERROR');
 const persisted=saveSeat(data.code,secret);
 return {code:data.code,token:secret,persisted};
}
export class RoomConnection{
 constructor({code,token,onRoom=()=>{},onStatus=()=>{},onError=()=>{},onRemoved=()=>{},baseURL=location.href,Socket=WebSocket}){
  this.code=code;this.token=token;this.onRoom=onRoom;this.onStatus=onStatus;this.onError=onError;this.onRemoved=onRemoved;this.baseURL=baseURL;this.Socket=Socket;this.pending=new Map();this.closed=false;this.attempts=0;this.connected=false;this.sequence=0;
 }
 open(){
  if(this.closed)return;
  clearTimeout(this.retry);this.onStatus(this.attempts?'reconnecting':'connecting');
  const url=new URL(this.baseURL);url.pathname='/parties/rooms/'+this.code;url.search='';url.hash='';url.protocol=url.protocol==='https:'?'wss:':'ws:';
  const socket=new this.Socket(url.href);this.socket=socket;this.lastSeen=Date.now();
  socket.onopen=()=>{if(this.closed||this.socket!==socket)return;socket.send(JSON.stringify({type:'AUTH',token:this.token}));this.authTimer=setTimeout(()=>{if(!this.connected)socket.close();},12000);};
  socket.onmessage=event=>{
   if(this.closed||this.socket!==socket)return;this.lastSeen=Date.now();if(event.data==='pong')return;
   let data;try{data=JSON.parse(event.data);}catch{return;}
   if(data.type==='snapshot'){clearTimeout(this.authTimer);this.connected=true;this.attempts=0;this.onStatus('connected');this.onRoom({...data.room,clockOffset:typeof data.serverNow==='number'?data.serverNow-Date.now():0});}
   else if(data.type==='ack'||data.type==='error'){
    const pending=this.pending.get(data.requestId);
    if(pending){clearTimeout(pending.timer);this.pending.delete(data.requestId);data.type==='ack'?pending.resolve():pending.reject(Error(data.error==='GAME_RULE'?data.message:data.error));}
    else if(data.type==='error')this.onError(data.error==='GAME_RULE'?data.message:data.error);
    if(['SESSION_INVALID','ROOM_NOT_FOUND'].includes(data.error))this.removed(data.error);
   }else if(data.type==='removed')this.removed(data.reason||'REMOVED');
  };
  socket.onerror=()=>{}; // Browsers expose the connection failure through onclose.
  socket.onclose=event=>{
   if(this.closed||this.socket!==socket)return;
   this.connected=false;clearTimeout(this.authTimer);this.failPending('DISCONNECTED');clearInterval(this.heartbeat);
   if(event.code===4429)this.onError('TOO_MANY_CONNECTIONS');
   if([4401,4403,4404].includes(event.code)){this.removed(event.reason||'SESSION_INVALID');return;}
   this.onStatus('reconnecting');this.attempts++;this.retry=setTimeout(()=>this.open(),Math.min(15000,1000*2**Math.min(4,this.attempts-1)));
  };
  clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{
   if(socket.readyState!==1)return;
   if(Date.now()-this.lastSeen>65000){socket.close();return;}
   socket.send('ping');
  },20000);
 }
 send(action){
  if(!this.connected||this.socket?.readyState!==1)return Promise.reject(Error('DISCONNECTED'));
  const requestId=String(++this.sequence);
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(requestId);reject(Error('ACK_TIMEOUT'));},10000);
   this.pending.set(requestId,{resolve,reject,timer});
   try{this.socket.send(JSON.stringify({...action,requestId}));}catch{clearTimeout(timer);this.pending.delete(requestId);reject(Error('DISCONNECTED'));}
  });
 }
 failPending(code){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(code));}this.pending.clear();}
 removed(reason){if(this.closed)return;this.stop();this.onRemoved(reason);}
 stop(){this.closed=true;this.connected=false;clearTimeout(this.retry);clearTimeout(this.authTimer);clearInterval(this.heartbeat);this.failPending('DISCONNECTED');this.socket?.close();}
}
