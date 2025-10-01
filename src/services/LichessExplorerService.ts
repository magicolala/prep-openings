import type { ILichessExplorerService } from "../domain/ports";
import type { ExplorerPositionInfo } from "../domain/models";
import { Chess } from "chess.js";

/**
 * Lichess opening explorer public endpoint.
 * We use the lichess database by default. CORS is allowed.
 * Reference shape based on explorer responses.
 */
export class LichessExplorerService implements ILichessExplorerService {
  private base = "https://explorer.lichess.ovh/lichess"; // reliable mirror used by many projects
  private cacheTtlMs = 12 * 60 * 60 * 1000; // 12h

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

  private sanToUciMoves(sanLine: string[]): string[] {
    if (!sanLine.length) return [];
    const chess = new Chess();
    const uciMoves: string[] = [];
    for (const san of sanLine) {
      const move = chess.move(san, { sloppy: true });
      if (!move) break;
      const promotion = move.promotion ? move.promotion : "";
      uciMoves.push(`${move.from}${move.to}${promotion}`);
    }
    return uciMoves;
  }

  async getPositionInfo(sanLine: string[], variant: "standard" = "standard"): Promise<ExplorerPositionInfo> {
    const uciMoves = this.sanToUciMoves(sanLine);
    const params = new URLSearchParams({ variant, speeds: "blitz,rapid,classical", ratings: "1800,2000,2200" });
    if (uciMoves.length) params.set("play", uciMoves.join(" "));
    const url = `${this.base}?${params.toString()}`;
    const cacheKey = `lichess:pos:${variant}:${uciMoves.join(" ")}`;
    const cached = this.readCache<ExplorerPositionInfo>(cacheKey);
    if (cached) return cached;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Lichess explorer failed: ${r.status}`);
    const data = await r.json();
    // Map shape we care about
    const moves = (data.moves ?? []).map((m: any) => ({
      san: m.san,
      white: m.white ?? 0,
      draws: m.draws ?? 0,
      black: m.black ?? 0,
      total: (m.white ?? 0) + (m.draws ?? 0) + (m.black ?? 0),
      averageRating: m.averageRating,
    }));
    const opening = data.opening ? { name: data.opening.name, eco: data.opening.eco } : undefined;
    const result: ExplorerPositionInfo = { opening, moves };
    this.writeCache(cacheKey, result);
    return result;
  }
}
