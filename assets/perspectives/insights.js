export function humanTC(tc) {
  if (!tc) return 'Unknown';
  const m = tc.match(/(\d+)[+/](\d+)/);
  if (!m) return tc;
  const init = Number(m[1]); // secondes
  if (init <= 179) return 'Bullet';
  if (init <= 479) return 'Blitz';
  if (init <= 1799) return 'Rapid';
  return 'Classical';
}

export function splitByColor(games) {
  const white = games.filter(g => g.color==='white');
  const black = games.filter(g => g.color==='black');
  return [
    aggregate('white', white, g => g.result==='1-0', g => g.result==='0-1'),
    aggregate('black', black, g => g.result==='0-1', g => g.result==='1-0'),
  ];
}

export function splitByTimeControl(games) {
  const map = new Map();
  for (const g of games) {
    const key = humanTC(g.timeControl||'');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(g);
  }
  return [...map.entries()].map(([key, arr]) =>
    aggregate(key, arr, g => g.result==='1-0', g => g.result==='0-1')
  );
}

export function topOpenings(games, minGames=8) {
  const map = new Map();
  for (const g of games) {
    const key = (g.eco||'?') + '|' + (g.opening||'Unknown');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(g);
  }
  return [...map.entries()].map(([k, arr]) => {
    const [eco, name] = k.split('|');
    const a = aggregate(`${eco} ${name}`, arr, g => g.result==='1-0', g => g.result==='0-1');
    a.extra = { eco, name };
    return a;
  }).filter(x => x.games >= minGames).sort((a,b)=> (b.wr - a.wr));
}

function aggregate(key, arr, isWin, isLoss) {
  const games = arr.length;
  const wins = arr.filter(isWin).length;
  const losses = arr.filter(isLoss).length;
  const draws = arr.filter(g => g.result==='1/2-1/2').length;
  const wr = Math.round((wins / Math.max(1, (games - draws))) * 100);
  return { key, games, wins, draws, losses, wr };
}
