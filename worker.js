export default {
  async fetch(req) {
    const url = new URL(req.url);

    const isLichess = url.pathname.startsWith('/proxy/lichess');
    const isChesscom = url.pathname.startsWith('/proxy/chesscom');

    if (!isLichess && !isChesscom) {
      return new Response('Not found', { status: 404 });
    }

    const targetBase = isLichess ? 'https://lichess.org' : 'https://api.chess.com';
    const target = url.searchParams.get('url')
      ? url.searchParams.get('url')
      : targetBase + (url.searchParams.get('path') || '');

    const headers = new Headers();
    headers.set('User-Agent', 'prep-openings-perspectives (contact: dev@example.com)');

    // Si NDJSON demandé côté client, relaie l’en-tête
    const accept = req.headers.get('Accept');
    if (accept) headers.set('Accept', accept);

    const upstream = await fetch(target, { method: 'GET', headers });
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Expose-Headers', '*');

    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  }
};
