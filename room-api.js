import {RoomError,normalizeCode,validCode,randomCode} from './room-core.js';
import {readJSON,errorResponse} from './room-server.js';
export function sameOrigin(request){const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin;}
export async function handleRoomAPI(request,env){
 const path=new URL(request.url).pathname;
 if(path!=='/api/rooms'&&!path.startsWith('/api/rooms/'))return null;
 try{
  if(!sameOrigin(request))throw new RoomError('ORIGIN_DENIED',403);
  if(request.method!=='POST')throw new RoomError('METHOD_NOT_ALLOWED',405);
  const data=await readJSON(request);
  const invoke=(code,action)=>env.Rooms.get(env.Rooms.idFromName(code)).fetch(new Request('https://room.internal/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}));
  if(path==='/api/rooms'){
   for(let attempt=0;attempt<3;attempt++){
    const response=await invoke(randomCode(),'create');
    if(response.status!==409)return response;
    const result=await response.clone().json();if(result.error!=='ROOM_EXISTS')return response;
   }
   throw new RoomError('SERVER_ERROR',503);
  }
  const match=path.match(/^\/api\/rooms\/([^/]+)\/join$/);if(!match)throw new RoomError('NOT_FOUND',404);
  const code=normalizeCode(match[1]);if(!validCode(code))throw new RoomError('CODE_INVALID');
  return await invoke(code,'join');
 }catch(error){return errorResponse(error);}
}
