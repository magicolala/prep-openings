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
  private requestQueue: Promise<void> = Promise.resolve();
  private nextAllowedCallAt = 0;

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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private enqueueRequest<T>(task: () => Promise<T>): Promise<T> {
    const run = this.requestQueue.then(task, task);
    this.requestQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async fetchJsonWithRateLimit(url: string): Promise<any> {
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
      const now = Date.now();
      if (now < this.nextAllowedCallAt) {
        await this.sleep(this.nextAllowedCallAt - now);
      }

      const response = await fetch(url);

      if (response.status === 429) {
        const retryAfterHeader = Number(response.headers.get("Retry-After"));
        const cooldown = Math.max(
          60000,
          Number.isFinite(retryAfterHeader) ? retryAfterHeader * 1000 : 60000,
        );
        this.nextAllowedCallAt = Date.now() + cooldown;
        attempt += 1;
        lastError = new Error("Lichess explorer a repondu 429. Pause d'une minute avant nouvel essai.");
        continue;
      }

      if (!response.ok) {
        throw new Error(`Lichess explorer failed: ${response.status}`);
      }

      this.nextAllowedCallAt = Date.now();
      return response.json();
    }

    throw lastError ?? new Error("Lichess explorer rate limit depassee a plusieurs reprises.");
  }

  private sanToUciMoves(sanLine: string[]): string[] {
    if (!sanLine.length) return [];
    const chess = new Chess();
    const uciMoves: string[] = [];
    for (const san of sanLine) {
      const move = chess.move(san);
      if (!move) break;
      const promotion = move.promotion ? move.promotion : "";
      uciMoves.push(`${move.from}${move.to}${promotion}`);
    }
    return uciMoves;
  }

  async getPositionInfo(
    sanLine: string[],
    variant: "standard" = "standard",
  ): Promise<ExplorerPositionInfo> {
    const uciMoves = this.sanToUciMoves(sanLine);
    const params = new URLSearchParams({
      variant,
      speeds: "blitz,rapid,classical",
      ratings: "1800,2000,2200",
    });
    if (uciMoves.length) params.set("play", uciMoves.join(","));
    const url = `${this.base}?${params.toString()}`;
    const cacheKey = `lichess:pos:${variant}:${uciMoves.join(",")}`;
    const cached = this.readCache<ExplorerPositionInfo>(cacheKey);
    if (cached) return cached;

    return this.enqueueRequest(async () => {
      const cachedDuringWait = this.readCache<ExplorerPositionInfo>(cacheKey);
      if (cachedDuringWait) return cachedDuringWait;

      const data = await this.fetchJsonWithRateLimit(url);
      const moves = (data.moves ?? []).map((m: any) => ({
        san: m.san,
        white: m.white ?? 0,
        draws: m.draws ?? 0,
        black: m.black ?? 0,
        total: (m.white ?? 0) + (m.draws ?? 0) + (m.black ?? 0),
        averageRating: m.averageRating,
      }));
      const recentGames = (data.recentGames ?? []).map((g: any) => ({
        id: g.id,
        winner: g.winner,
        speed: g.speed,
        mode: g.mode,
        white: g.white,
        black: g.black,
        year: g.year,
        month: g.month,
        uci: g.uci,
      }));
      const opening = data.opening ? { name: data.opening.name, eco: data.opening.eco } : undefined;
      const result: ExplorerPositionInfo = { opening, moves, recentGames };
      this.writeCache(cacheKey, result);
      return result;
    });
  }
}
