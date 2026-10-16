import { Server, routePartykitRequest } from 'partyserver';
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
    if (path === '/api/health') {
      try {
        const stub = env.Setup.get(env.Setup.idFromName('setup-check'));
        const check = await stub.fetch(new Request('https://internal/'));
        if (!check.ok) throw new Error('Backend check failed');
        return Response.json({ ok: true, worker: true, partyserver: true, sqlite: true }, { headers: { 'Cache-Control': 'no-store' } });
      } catch {
        return Response.json({ ok: false, error: 'Backend check failed. Check Cloudflare deployment logs.' }, { status: 503 });
      }
    }
    if (path === '/parties/setup/setup-check') return (await routePartykitRequest(request, env)) || new Response('Not found', { status: 404 });
    if (path.startsWith('/api/') || path.startsWith('/parties/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
