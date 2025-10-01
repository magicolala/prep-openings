import type { IChessComService } from "../domain/ports";
import type { ChessComGame } from "../domain/models";

/**
 * Chess.com public API, no key required.
 * Docs: https://www.chess.com/news/view/published-data-api
 */
export class ChessComService implements IChessComService {
  private base = "https://api.chess.com/pub/player";
  private cacheTtlMs = 6 * 60 * 60 * 1000; // 6h

  private readCache<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (typeof ts !== "number" || Date.now() - ts > this.cacheTtlMs) {
        sessionStorage.removeItem(key);
        return null;
      }
      return data as T;
    } catch {
      return null;
    }
  }

  private writeCache<T>(key: string, data: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // ignore quota errors
    }
  }

  async getRecentGames(username: string, monthsBack: number): Promise<ChessComGame[]> {
    const u = username.toLowerCase();
    const cacheKey = `chesscom:recent:${u}:${monthsBack}`;
    const cached = this.readCache<ChessComGame[]>(cacheKey);
    if (cached) return cached;
    const archivesUrl = `${this.base}/${encodeURIComponent(u)}/games/archives`;
    const archivesResp = await fetch(archivesUrl);
    if (!archivesResp.ok) throw new Error(`Chess.com archives failed: ${archivesResp.status}`);
    const { archives } = await archivesResp.json();

    // Take last N monthly archive URLs
    const lastN = archives.slice(-monthsBack);
    const results: ChessComGame[] = [];
    for (const url of lastN) {
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      if (Array.isArray(data.games)) {
        for (const g of data.games) {
          // normalize field names
          results.push({
            url: g.url,
            pgn: g.pgn,
            time_control: g.time_control,
            end_time: g.end_time,
            rated: g.rated,
            white: { username: g.white?.username?.toLowerCase?.() ?? "", result: g.white?.result },
            black: { username: g.black?.username?.toLowerCase?.() ?? "", result: g.black?.result },
          });
        }
      }
    }
    this.writeCache(cacheKey, results);
    return results;
  }
}


