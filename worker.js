import { Server, routePartykitRequest } from 'partyserver';
import {makeRoomServer} from './room-server.js';
import {handleRoomAPI,sameOrigin} from './room-api.js';
import {validCode} from './room-core.js';
export class RoomsServer extends makeRoomServer(Server) {}
export class SetupServer extends Server {
  static options = { hibernate: true };
  onRequest() { return Response.json({ ok: true, service: 'PartyServer', storage: 'SQLite' }); }
  onConnect(connection) {
    connection.send(JSON.stringify({ ok: true, service: 'WebSocket' }));
    connection.close(1000, 'Setup check complete');
  }
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const roomResponse=await handleRoomAPI(request,env);
    if(roomResponse)return roomResponse;
    const socketMatch=path.match(/^\/parties\/rooms\/([^/]+)$/);
    if(socketMatch){
      if(!validCode(socketMatch[1]))return new Response('Not found',{status:404});
      if(!sameOrigin(request))return new Response('Forbidden',{status:403});
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
      return (await routePartykitRequest(request,env))||new Response('Not found',{status:404});
    }
    if (path === '/api/health') {
      try {
        const stub = env.Setup.get(env.Setup.idFromName('setup-check'));
        const check = await stub.fetch(new Request('https://internal/'));
        if (!check.ok) throw new Error('Backend check failed');
        const rooms=env.Rooms.get(env.Rooms.idFromName('room-health-check'));
        const roomCheck=await rooms.fetch(new Request('https://room.internal/health'));
        if(!roomCheck.ok)throw new Error('Room service check failed');
        return Response.json({ ok: true, worker: true, partyserver: true, sqlite: true, rooms: true }, { headers: { 'Cache-Control': 'no-store' } });
      } catch {
        return Response.json({ ok: false, error: 'Backend check failed. Check Cloudflare deployment logs.' }, { status: 503 });
      }
    }
    if (path === '/parties/setup/setup-check') return (await routePartykitRequest(request, env)) || new Response('Not found', { status: 404 });
    if (path.startsWith('/api/') || path.startsWith('/parties/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
