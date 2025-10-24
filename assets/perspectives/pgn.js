export function* parsePgnMany(pgn) {
  const parts = pgn.split(/\n\n\[\s*Event\s*/).map((s,i)=> i? '[Event '+s : s).filter(Boolean);
  for (const g of parts) {
    const tags = {};
    const tagRe = /\[(\w+)\s+"([^"]*)"\]/g;
    let m; while ((m = tagRe.exec(g))) tags[m[1]] = m[2];
    const movesPart = g.split(/\n\n/).slice(1).join('\n\n').trim();
    const moves = (movesPart||'')
      .replace(/\{[^}]*\}/g,'')
      .replace(/\([^\)]*\)/g,'')
      .replace(/\d+\.(\.\.)?/g,'')
      .replace(/\$\d+/g,'')
      .trim()
      .split(/\s+/)
      .filter(s => s && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(s));
    yield { tags, moves };
  }
}
