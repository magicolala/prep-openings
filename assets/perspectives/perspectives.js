import { parsePgnMany } from './pgn.js';
import { splitByColor, splitByTimeControl, topOpenings } from './insights.js';

// === CONFIG ===
const CF_BASE = 'https://prep-openings-proxy.dev-example.workers.dev';

// === HELPERS FETCH ===
async function fetchChesscom(username) {
  const archUrl = `${CF_BASE}/proxy/chesscom?url=${encodeURIComponent(`https://api.chess.com/pub/player/${username}/games/archives`)}`;
  const arch = await (await fetch(archUrl)).json();
  const pgnBlobs = [];
  if (!arch?.archives?.length) {
    return pgnBlobs;
  }
  for (const url of arch.archives) {
    const pUrl = `${CF_BASE}/proxy/chesscom?url=${encodeURIComponent(url + '/pgn')}`;
    const pgn = await (await fetch(pUrl)).text();
    pgnBlobs.push(pgn);
    // rate limit friendly
    await new Promise(r => setTimeout(r, 600));
  }
  return pgnBlobs;
}

async function fetchLichessNdjson(username) {
  const path = `/api/games/user/${username}?max=200&moves=true&opening=true`;
  const url = `${CF_BASE}/proxy/lichess?path=${encodeURIComponent(path)}`;
  const resp = await fetch(url, { headers: { 'Accept': 'application/x-ndjson' }});
  return await resp.text();
}

// === NORMALISATION ===
function normalizeFromPgn(pgnBlobs, me, site) {
  const games = [];
  for (const pgn of pgnBlobs) {
    for (const g of parsePgnMany(pgn)) {
      const white = g.tags.White, black = g.tags.Black;
      const color = (white||'').toLowerCase() === me.toLowerCase() ? 'white' : 'black';
      games.push({
        site,
        playedAt: (g.tags.UTCDate && g.tags.UTCTime) ? `${g.tags.UTCDate}T${g.tags.UTCTime}Z` : (g.tags.Date||''),
        white, black,
        result: g.tags.Result,
        timeControl: g.tags.TimeControl || '',
        rated: (g.tags.Event||'').toLowerCase().includes('rated'),
        eco: g.tags.ECO,
        opening: g.tags.Opening,
        movesSAN: g.moves,
        color,
        opponentRating: color === 'white' ? Number(g.tags.BlackElo) : Number(g.tags.WhiteElo)
      });
    }
  }
  return games;
}

function normalizeFromLichessNdjson(ndjson, me) {
  const out = [];
  for (const line of ndjson.split('\n')) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    const white = o.players?.white?.user?.name || o.players?.white?.userId || 'White';
    const black = o.players?.black?.user?.name || o.players?.black?.userId || 'Black';
    const color = (white||'').toLowerCase() === me.toLowerCase() ? 'white' : 'black';
    const result = o.winner ? (o.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2';
    const tc = o.clock ? `${o.clock.initial}/${o.clock.increment||0}` : '';
    out.push({
      site: 'lichess',
      playedAt: o.createdAt ? new Date(o.createdAt).toISOString() : (o.lastMoveAt ? new Date(o.lastMoveAt).toISOString() : ''),
      white, black,
      result,
      timeControl: tc,
      rated: !!o.rated,
      eco: o.opening?.eco,
      opening: o.opening?.name,
      movesSAN: o.moves ? o.moves.split(' ') : undefined,
      color,
      opponentRating: color === 'white' ? o.players?.black?.rating : o.players?.white?.rating
    });
  }
  return out;
}

// === RENDER ===
function el(tag, attrs={}, ...children) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k==='class') e.className = v;
    else if (k.startsWith('on') && typeof v==='function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c?.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

function renderColorStats(root, arr) {
  root.innerHTML = '';
  const wrap = el('div', { class:'row cols-2' });
  for (const it of arr) {
    const badge = it.wr >= 55 ? 'ok' : it.wr >= 45 ? 'warn' : 'bad';
    wrap.append(
      el('div', { class:'card' },
        el('div', { class:'muted' }, it.key === 'white' ? 'Blancs' : 'Noirs'),
        el('div', { class:'kpi '+badge }, `${it.wr}%`),
        el('div', { class:'sub' }, `${it.wins} W · ${it.draws} D · ${it.losses} L  —  ${it.games} parties`)
      )
    );
  }
  root.append(wrap);
}

function renderTCStats(root, arr) {
  root.innerHTML = '';
  const tbl = el('table');
  tbl.append(el('thead',{}, el('tr',{},
    el('th',{},'Cadence'),
    el('th',{},'WR %'),
    el('th',{},'W'),
    el('th',{},'D'),
    el('th',{},'L'),
    el('th',{},'Games')
  )));
  const tb = el('tbody');
  for (const it of arr) {
    tb.append(el('tr',{},
      el('td',{},it.key), el('td',{},String(it.wr)),
      el('td',{},String(it.wins)), el('td',{},String(it.draws)),
      el('td',{},String(it.losses)), el('td',{},String(it.games)),
    ));
  }
  tbl.append(tb);
  root.append(tbl);
}

function renderOpenings(root, arr) {
  root.innerHTML = '';
  const tbl = el('table');
  const headers = [
    {k:'key', label:'Ouverture'}, {k:'wr', label:'WR %'},
    {k:'wins', label:'W'}, {k:'draws', label:'D'}, {k:'losses', label:'L'},
    {k:'games', label:'Games'}
  ];
  const trh = el('tr');
  for (const h of headers) {
    trh.append(el('th', { onClick: () => sortBy(h.k) }, h.label));
  }
  tbl.append(el('thead',{}, trh));
  const tb = el('tbody'); tbl.append(tb);
  root.append(tbl);

  let data = [...arr]; let asc = false; let lastK = 'wr';
  function draw() {
    tb.innerHTML='';
    for (const it of data) {
      tb.append(el('tr',{},
        el('td',{},it.key),
        el('td',{},String(it.wr)),
        el('td',{},String(it.wins)),
        el('td',{},String(it.draws)),
        el('td',{},String(it.losses)),
        el('td',{},String(it.games)),
      ));
    }
  }
  function sortBy(k) {
    asc = lastK===k ? !asc : false;
    lastK = k;
    data.sort((a, b) => {
      const av = a[k];
      const bv = b[k];
      if (typeof av === 'number' && typeof bv === 'number') {
        return asc ? av - bv : bv - av;
      }
      return asc
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''));
    });
    draw();
  }
  sortBy('wr');
}

// === CACHE ===
function cacheKey(user) { return `persp:${user.toLowerCase()}`; }
function saveCache(user, games) { localStorage.setItem(cacheKey(user), JSON.stringify(games)); }
function loadCache(user) { const s = localStorage.getItem(cacheKey(user)); return s? JSON.parse(s): null; }
function clearCache(user) { localStorage.removeItem(cacheKey(user)); }

// === WIRES ===
const $ = id => document.getElementById(id);
const $status = $('status'), $color = $('colorStats'), $tc = $('tcStats'), $ops = $('openings');

$('btnRun').addEventListener('click', async () => {
  const platform = $('platform').value;
  const username = $('username').value.trim();
  const minGames = Math.max(1, Number($('minGames').value||8));

  if (!username) { $status.textContent = 'Entre un username.'; return; }

  $status.textContent = 'Téléchargement en cours…';
  try {
    const chunks = [];
    if (platform==='both' || platform==='chesscom') {
      const pgns = await fetchChesscom(username);
      chunks.push(...normalizeFromPgn(pgns, username, 'chess.com'));
    }
    if (platform==='both' || platform==='lichess') {
      const ndjson = await fetchLichessNdjson(username);
      if (ndjson?.trim()) chunks.push(...normalizeFromLichessNdjson(ndjson, username));
    }

    if (chunks.length === 0) {
      $status.textContent = 'Aucune partie trouvée (vérifie le pseudo ou réessaie plus tard).';
      return;
    }

    saveCache(username, chunks);

    const byColor = splitByColor(chunks);
    const byTC = splitByTimeControl(chunks);
    const tops = topOpenings(chunks, minGames);

    renderColorStats($color, byColor);
    renderTCStats($tc, byTC);
    renderOpenings($ops, tops);

    $status.textContent = `OK — ${chunks.length} parties chargées et analysées. Cache activé.`;
  } catch (e) {
    console.error(e);
    $status.textContent = 'Erreur pendant l’analyse. Regarde la console.';
  }
});

$('btnLoadCache').addEventListener('click', () => {
  const user = $('username').value.trim();
  if (!user) { $status.textContent = 'Entre un username pour charger le cache.'; return; }
  const games = loadCache(user);
  if (!games) { $status.textContent = 'Pas de cache pour cet utilisateur.'; return; }
  const minGames = Math.max(1, Number($('minGames').value||8));
  renderColorStats($color, splitByColor(games));
  renderTCStats($tc, splitByTimeControl(games));
  renderOpenings($ops, topOpenings(games, minGames));
  $status.textContent = `Cache rechargé — ${games.length} parties.`;
});

$('btnClearCache').addEventListener('click', () => {
  const user = $('username').value.trim();
  if (!user) { $status.textContent = 'Entre un username pour vider le cache.'; return; }
  clearCache(user);
  $status.textContent = 'Cache vidé pour cet utilisateur.';
});
