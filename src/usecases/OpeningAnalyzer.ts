import type { IOpeningAnalyzer, ILichessExplorerService } from "../domain/ports";
import type { ChessComGame, OpeningLine, PrepSuggestion } from "../domain/models";
import { Chess } from "chess.js";

const generateId = () => {
  const cryptoObj = (typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined);
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  if (cryptoObj?.getRandomValues) {
    const buffer = new Uint8Array(16);
    cryptoObj.getRandomValues(buffer);
    return Array.from(buffer, b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }
  return `fallback-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Heuristic analyzer: find shared opening prefixes in both players' last games,
 * then consult Lichess explorer to spot a move by either side that scores badly
 * for them but appears frequently in their practice. Mark those as prep targets.
 */
export class OpeningAnalyzer implements IOpeningAnalyzer {
  async findCommonWeaknesses(params: {
    you: { username: string };
    opponent: { username: string };
    yourGames: ChessComGame[];
    oppGames: ChessComGame[];
    explorer: ILichessExplorerService;
  }): Promise<PrepSuggestion[]> {
    const { yourGames, oppGames, explorer } = params;

    const yourLines = this.extractEarlyLines(yourGames, 12); // first 12 plies default
    const oppLines = this.extractEarlyLines(oppGames, 12);

    const shared: OpeningLine[] = this.intersectionByPrefix(yourLines, oppLines, 4); // share first 4 plies at least

    const suggestions: PrepSuggestion[] = [];

    for (const line of shared) {
      // Query explorer at each step and look for "interesting" edges.
      for (let i = 0; i < line.sanLine.length; i++) {
        const prefix = line.sanLine.slice(0, i);
        const info = await explorer.getPositionInfo(prefix);
        if (!info.moves?.length) continue;

        // Choose an "interesting" move: low popularity but good score for us OR
        // very popular but poor results for them
        const enriched = info.moves.map(m => ({
          ...m,
          whiteScore: (m.white + 0.5 * m.draws) / Math.max(1, m.total),
          blackScore: (m.black + 0.5 * m.draws) / Math.max(1, m.total),
        }));

        // Heuristics: candidate if its total >= 50 and either side has score <= 0.40 despite popularity >= 0.25
        const totalSum = enriched.reduce((a, b) => a + b.total, 0) || 1;
        const popular = enriched.filter(m => m.total / totalSum >= 0.25 && m.total >= 50);
        const lowScoreForWhite = popular.filter(m => m.whiteScore <= 0.40);
        const lowScoreForBlack = popular.filter(m => m.blackScore <= 0.40);

        const yourTurn = prefix.length % 2 === 0; // even ply means White to move in starting position

        if (yourTurn && lowScoreForBlack.length) {
          // It's your move as White. If a popular reply for Black scores badly, prep a line that leads them there.
          const bad = lowScoreForBlack[0];
          suggestions.push({
            id: generateId(),
            branch: {
              perspective: "opponent",
              color: "black",
              line: { sanLine: prefix },
              triggerMove: bad.san,
              reason: `Réponse noire populaire mais score faible pour les Noirs (~${(bad.blackScore * 100).toFixed(0)}%).`,
              explorerEvidence: bad,
            },
            recommendedFollowUp: this.extendWithFollowUp(prefix, bad.san),
          });
        }
        if (!yourTurn && lowScoreForWhite.length) {
          const bad = lowScoreForWhite[0];
          suggestions.push({
            id: generateId(),
            branch: {
              perspective: "opponent",
              color: "white",
              line: { sanLine: prefix },
              triggerMove: bad.san,
              reason: `Coup blanc populaire mais score faible pour les Blancs (~${(bad.whiteScore * 100).toFixed(0)}%).`,
              explorerEvidence: bad,
            },
            recommendedFollowUp: this.extendWithFollowUp(prefix, bad.san),
          });
        }
      }
    }

    // Remove duplicates by line+trigger
    const uniq = new Map<string, PrepSuggestion>();
    for (const s of suggestions) {
      const key = `${s.branch.line.sanLine.join(" ")}|${s.branch.triggerMove}`;
      if (!uniq.has(key)) uniq.set(key, s);
    }
    return Array.from(uniq.values());
  }

  private extractEarlyLines(games: ChessComGame[], maxPlies: number): OpeningLine[] {
    const out: OpeningLine[] = [];
    for (const g of games) {
      if (!g?.pgn) continue;
      try {
        const chess = new Chess();
        chess.loadPgn(g.pgn);
        const hist = chess.history({ verbose: true });
        const san = hist.slice(0, maxPlies).map(m => m.san);
        if (san.length >= 2) out.push({ sanLine: san });
      } catch (_e) {
        continue;
      }
    }
    return out;
  }

  private intersectionByPrefix(a: OpeningLine[], b: OpeningLine[], minCommonPlies: number): OpeningLine[] {
    const keySet = new Set(b.map(x => x.sanLine.slice(0, minCommonPlies).join(" ")));
    const res: OpeningLine[] = [];
    for (const x of a) {
      const k = x.sanLine.slice(0, minCommonPlies).join(" ");
      if (keySet.has(k)) res.push({ sanLine: x.sanLine });
    }
    return res;
  }

  private extendWithFollowUp(prefix: string[], theirMove: string): string[] {
    // Simple follow-up: propose forcing-looking responses from explorer later; placeholder keeps UI consistent
    // Here we just echo the move as a study marker.
    return [...prefix, theirMove];
  }
}
