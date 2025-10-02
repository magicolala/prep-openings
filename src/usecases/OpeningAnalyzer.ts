import type {
  IOpeningAnalyzer,
  ILichessExplorerService,
} from "../domain/ports";
import type {
  ChessComGame,
  OpeningSummary,
  PrepSuggestion,
  OpeningTreeResult,
  OpeningFenNode,
  PrepSheet,
  ExplorerMoveStat,
  PrepLeak,
  PrepModelGame,
  ExplorerPositionInfo,
} from "../domain/models";
import { Chess } from "chess.js";

type Color = "white" | "black";

type FenKey = string;

type PlyWindow = [number, number];

type FenAggregate = {
  fen: string;
  ply: number;
  color: Color;
  sanLine: string[];
  eco?: string;
  name?: string;
  scoreSum: number;
  frequency: number;
  moveMap: Map<string, FenMoveAggregate>;
  sampleGameUrl?: string;
};

type FenMoveAggregate = {
  count: number;
  scoreSum: number;
  sampleGameUrl?: string;
  fullSanLine: string[];
};

const DEFAULT_PLY_WINDOW: PlyWindow = [8, 12];
const DEFAULT_MAX_PLIES = 20;
const MIN_FREQ_FOR_LEAK = 3;
const SCORE_GAP_THRESHOLD = 0.15;
const LOW_POPULARITY_THRESHOLD = 0.05;
const ALT_POPULARITY_THRESHOLD = 0.3;
const PUNISHMENTS_DEFAULT = 2;
const MODEL_GAMES_DEFAULT = 2;
const MAX_LEAKS_PER_COLOR = 3;
const EXPLORER_TOP_RANK = 2;
const MOVE_ORDER_POP_THRESHOLD = 0.1;
const MOVE_ORDER_MIN_POP = 0.2;
const MOVE_ORDER_MAX_RANK = 4;
const ZERO_SCORE_THRESHOLD = 0.05;


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

export class OpeningAnalyzer implements IOpeningAnalyzer {
  async findCommonWeaknesses(): Promise<PrepSuggestion[]> {
    // Legacy API kept for backward compatibility with earlier UI.
    return [];
  }

  findSharedOpenings(): OpeningSummary[] {
    return [];
  }

  buildOpeningTree(params: {
    you: { username: string };
    opponent: { username: string };
    yourGames: ChessComGame[];
    oppGames: ChessComGame[];
    maxPlies?: number;
    plyWindow?: PlyWindow;
  }): OpeningTreeResult {
    const { you, opponent, yourGames, oppGames } = params;
    const maxPlies = params.maxPlies ?? DEFAULT_MAX_PLIES;
    const plyWindow: PlyWindow = params.plyWindow ?? DEFAULT_PLY_WINDOW;

    const opponentIndex = this.collectFenStats({
      games: oppGames,
      username: opponent.username,
      maxPlies,
      plyWindow,
    });
    const yourIndex = this.collectFenStats({
      games: yourGames,
      username: you.username,
      maxPlies,
      plyWindow,
    });

    const opponentNodes = this.materializeFenNodes(opponentIndex);
    const yourNodes = this.materializeFenNodes(yourIndex);

    const opponentByColor: Record<Color, OpeningFenNode[]> = { white: [], black: [] };
    const yourByColor: Record<Color, OpeningFenNode[]> = { white: [], black: [] };
    const opponentFenIndex: Record<string, OpeningFenNode> = {};
    const yourFenIndex: Record<string, OpeningFenNode> = {};

    for (const node of opponentNodes) {
      opponentByColor[node.color].push(node);
      opponentFenIndex[node.fen] = node;
    }
    for (const node of yourNodes) {
      yourByColor[node.color].push(node);
      yourFenIndex[node.fen] = node;
    }

    // Sort lists by frequency desc then score asc
    const sorter = (a: OpeningFenNode, b: OpeningFenNode) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.score - b.score;
    };
    opponentByColor.white.sort(sorter);
    opponentByColor.black.sort(sorter);
    yourByColor.white.sort(sorter);
    yourByColor.black.sort(sorter);

    console.debug('[OpeningAnalyzer.buildOpeningTree]', {
      yourGames: yourGames.length,
      oppGames: oppGames.length,
      yourNodes: yourNodes.length,
      oppNodes: opponentNodes.length,
      yourByColor: {
        white: yourByColor.white.length,
        black: yourByColor.black.length,
      },
      oppByColor: {
        white: opponentByColor.white.length,
        black: opponentByColor.black.length,
      },
    });

    return {
      opponent: {
        byColor: opponentByColor,
        index: opponentFenIndex,
      },
      you: {
        byColor: yourByColor,
        index: yourFenIndex,
      },
    };
  }

  async createPrepSheet(params: {
    node: OpeningFenNode;
    opponentTree: OpeningTreeResult["opponent"];
    yourIndex: OpeningTreeResult["you"]["index"];
    explorer: ILichessExplorerService;
    punishmentsPerLeak?: number;
    maxModelGames?: number;
  }): Promise<PrepSheet> {
    const { node, explorer } = params;
    console.debug('[OpeningAnalyzer.createPrepSheet] start', { id: node.id, sanLine: node.sanLine, preferred: node.preferredMove });
    const punishmentsPerLeak = params.punishmentsPerLeak ?? PUNISHMENTS_DEFAULT;
    const maxModelGames = params.maxModelGames ?? MODEL_GAMES_DEFAULT;
    const explorerCache = new Map<string, ExplorerPositionInfo>();
    const getExplorerInfo = async (line: string[]): Promise<ExplorerPositionInfo> => {
      const key = line.join(' ');
      let info = explorerCache.get(key);
      if (!info) {
        info = await explorer.getPositionInfo(line);
        explorerCache.set(key, info);
      }
      return info;
    };
    const baseInfo = await getExplorerInfo(node.sanLine);
    const explorerMoves = [...(baseInfo.moves ?? [])].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    const explorerTotalGames = explorerMoves.reduce((sum, move) => sum + (move.total ?? 0), 0) || 1;
    const leakEntries: Array<{ leak: PrepLeak; score: number }> = [];
    for (const sample of node.moveSamples) {
      if (sample.count < MIN_FREQ_FOR_LEAK) continue;
      const playerAvgScore = this.safeAverage(sample.scoreSum, sample.count);
      const explorerMoveIndex = explorerMoves.findIndex(move => move.san === sample.san);
      const explorerMove = explorerMoveIndex >= 0 ? explorerMoves[explorerMoveIndex] : undefined;
      const reasons: string[] = [];
      let explorerScore: number | undefined;
      let explorerPopularity: number | undefined;
      let popularityGap = 0;
      let scoreGap = 0;
      let rankPenalty = 0;
      let moveOrderTagged = false;
      const bestMove = explorerMoves[0];
      const bestPopularity = bestMove ? (bestMove.total ?? 0) / explorerTotalGames : 0;
      if (explorerMove) {
        explorerScore = this.scoreForColor(explorerMove, node.color);
        explorerPopularity = (explorerMove.total ?? 0) / explorerTotalGames;
        scoreGap = explorerScore - playerAvgScore;
        if (scoreGap >= SCORE_GAP_THRESHOLD) {
          reasons.push(`Score perso ${Math.round(playerAvgScore * 100)}% vs ${Math.round(explorerScore * 100)}% sur Lichess`);
        }
        const rank = explorerMoveIndex + 1;
        if (rank > EXPLORER_TOP_RANK) {
          reasons.push(`Son ${sample.san} sort du top ${EXPLORER_TOP_RANK} Explorer (rang ${rank}).`);
          rankPenalty = 0.5;
        }
        if (rank === 1 && playerAvgScore <= ZERO_SCORE_THRESHOLD) {
          reasons.push(`Top move mais score ${Math.round(playerAvgScore * 100)}%. Vise la ligne critique.`);
        }
        if (bestMove && bestMove !== explorerMove) {
          const bestPop = (bestMove.total ?? 0) / explorerTotalGames;
          popularityGap = bestPop - (explorerPopularity ?? 0);
          if ((explorerPopularity ?? 0) < LOW_POPULARITY_THRESHOLD && bestPop >= ALT_POPULARITY_THRESHOLD) {
            reasons.push(
              `Joue ${sample.san} (${Math.round((explorerPopularity ?? 0) * 100)}%) alors que ${bestMove.san} domine (${Math.round(bestPop * 100)}%). Prepare la ref standard.`
            );
          } else if (rank > 1) {
            reasons.push(`S'ecarte du top Explorer (${bestMove.san}).`);
          }
        }
      } else {
        reasons.push("Coup absent d'Explorer: profite-en.");
        popularityGap = bestPopularity;
      }
      if (!explorerMoves.length) {
        reasons.push('Explorer muet sur la position: impose ton plan.');
      }
      const infoAfter = await getExplorerInfo(sample.fullSanLine);
      const ourColor: Color = node.color === 'white' ? 'black' : 'white';
      const punishments = this.selectPunishments(infoAfter.moves ?? [], ourColor, punishmentsPerLeak);
      const moveOrderNote = await this.detectMoveOrderTrap({
        node,
        sample,
        getExplorerInfo,
        expectedPrimaryRef: punishments[0]?.san,
      });
      if (moveOrderNote) {
        moveOrderTagged = true;
        reasons.push(moveOrderNote);
      }
      if (!reasons.length) continue;
      const recentRaw = this.mapRecentGames(infoAfter.recentGames ?? []);
      const recent = recentRaw.map(game => ({ ...game, highlight: sample.san }));
      const afterFen = this.computeFenFromSanLine(sample.fullSanLine);
      const yourNode = params.yourIndex[afterFen];
      const leak: PrepLeak = {
        id: `${node.id}-${this.simpleHash(sample.san)}`,
        color: node.color,
        fen: afterFen,
        sanLine: [...sample.fullSanLine],
        move: sample.san,
        frequency: sample.count,
        playerScore: playerAvgScore,
        explorerScore,
        explorerPopularity,
        reason: reasons.join(' | '),
        recommendedResponses: punishments,
        sampleGameUrl: sample.sampleGameUrl ?? node.sampleGameUrl,
        openingName: node.name ?? baseInfo.opening?.name ?? infoAfter.opening?.name,
        eco: node.eco ?? baseInfo.opening?.eco ?? infoAfter.opening?.eco,
        lichessRecentGames: recent,
        yourOverlap: yourNode
          ? {
              frequency: yourNode.frequency,
              score: yourNode.score,
            }
          : undefined,
      };
      const severity = this.computeLeakPriority({
        frequency: sample.count,
        scoreGap,
        popularityGap,
        rankPenalty,
        explorerMissed: !explorerMove,
        moveOrderTagged,
        playerScore: playerAvgScore,
      });
      leakEntries.push({ leak, score: severity });
    }
    const leaks = leakEntries
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LEAKS_PER_COLOR)
      .map(entry => entry.leak);
    const modelGameMap = new Map<string, PrepModelGame>();
    for (const leak of leaks) {
      for (const game of leak.lichessRecentGames ?? []) {
        if (!game.id) continue;
        if (!modelGameMap.has(game.id)) {
          modelGameMap.set(game.id, game);
        }
        if (modelGameMap.size >= maxModelGames) break;
      }
      if (modelGameMap.size >= maxModelGames) break;
    }
    const modelGames = Array.from(modelGameMap.values()).slice(0, maxModelGames);
    console.debug('[OpeningAnalyzer.createPrepSheet]', {
      node: node.id,
      leaks: leaks.length,
      evaluated: leakEntries.length,
      modelPool: modelGameMap.size,
    });
    return {
      leaks,
      modelGames,
    };
  }

  private collectFenStats(params: {
    games: ChessComGame[];
    username: string;
    maxPlies: number;
    plyWindow: PlyWindow;
  }): Map<FenKey, FenAggregate> {
    const target = params.username.trim().toLowerCase();
    const map = new Map<FenKey, FenAggregate>();
    const [windowStart, windowEnd] = params.plyWindow;
    const debug = {
      total: params.games.length,
      colorMatches: 0,
      colorMisses: 0,
      invalidPgn: 0,
      fenHits: 0,
    };

    for (const game of params.games) {
      const white = game.white?.username?.toLowerCase?.();
      const black = game.black?.username?.toLowerCase?.();
      let color: Color | null = null;
      if (white === target) color = "white";
      else if (black === target) color = "black";
      if (!color) {
        debug.colorMisses += 1;
        continue;
      }
      debug.colorMatches += 1;

      try {
        const base = new Chess();
        const loaded = base.loadPgn(game.pgn) as unknown as boolean;
        if (!loaded) {
          debug.invalidPgn += 1;
          continue;
        }
        const header = base.header() as Record<string, string>;
        const eco = header.ECO ?? undefined;
        const ecoUrl = game.eco;
        const name = this.deriveOpeningName(header, ecoUrl);
        const resultScore = this.scoreFromHeader(header.Result, color) ?? this.scoreFromChessCom(game, color) ?? 0.5;
        const history = base.history({ verbose: true });
        const replay = new Chess();
        const prefixSan: string[] = [];

        for (let idx = 0; idx < history.length && idx < params.maxPlies; idx++) {
          const move = history[idx];
          const plyNumber = idx + 1;
          const mover: Color = move.color === "w" ? "white" : "black";
          const fenBefore = replay.fen();

          if (
            mover === color &&
            plyNumber >= windowStart &&
            plyNumber <= windowEnd
          ) {
            const key = fenBefore;
            let aggregate = map.get(key);
            if (!aggregate) {
              aggregate = {
                fen: fenBefore,
                ply: plyNumber,
                color,
                sanLine: [...prefixSan],
                eco,
                name,
                scoreSum: 0,
                frequency: 0,
                moveMap: new Map(),
                sampleGameUrl: game.url,
              };
              map.set(key, aggregate);
            }
            aggregate.frequency += 1;
            aggregate.scoreSum += resultScore;
            if (!aggregate.sampleGameUrl) aggregate.sampleGameUrl = game.url;

            const moveSan = move.san;
            let moveAgg = aggregate.moveMap.get(moveSan);
            if (!moveAgg) {
              moveAgg = {
                count: 0,
                scoreSum: 0,
                sampleGameUrl: game.url,
                fullSanLine: [...prefixSan, moveSan],
              };
              aggregate.moveMap.set(moveSan, moveAgg);
            }
            moveAgg.count += 1;
            moveAgg.scoreSum += resultScore;
            if (!moveAgg.sampleGameUrl) moveAgg.sampleGameUrl = game.url;
          }

          replay.move(move);
          prefixSan.push(move.san);
        }
      } catch {
        continue;
      }
    }

    debug.fenHits = map.size;
    console.debug('[OpeningAnalyzer.collectFenStats]', { username: target, ...debug });
    return map;
  }

  private materializeFenNodes(map: Map<FenKey, FenAggregate>): OpeningFenNode[] {
    const nodes: OpeningFenNode[] = [];
    for (const aggregate of map.values()) {
      const moveSamples = Array.from(aggregate.moveMap.entries())
        .map(([san, data]) => ({
          san,
          count: data.count,
          scoreSum: data.scoreSum,
          sampleGameUrl: data.sampleGameUrl,
          fullSanLine: [...data.fullSanLine],
        }))
        .sort((a, b) => b.count - a.count);
      const preferredMove = moveSamples[0]?.san;
      nodes.push({
        id: `${aggregate.color}-${this.simpleHash(aggregate.fen)}`,
        fen: aggregate.fen,
        ply: aggregate.ply,
        color: aggregate.color,
        sanLine: [...aggregate.sanLine],
        eco: aggregate.eco,
        name: aggregate.name,
        frequency: aggregate.frequency,
        score: this.safeAverage(aggregate.scoreSum, aggregate.frequency),
        moveSamples,
        sampleGameUrl: aggregate.sampleGameUrl,
        preferredMove,
      });
    }
    return nodes;
  }

  private scoreForColor(move: ExplorerMoveStat, color: Color): number {
    const total = move.total || 1;
    if (color === "white") {
      return (move.white + 0.5 * move.draws) / total;
    }
    return (move.black + 0.5 * move.draws) / total;
  }

  private safeAverage(sum: number, count: number): number {
    if (!count) return 0;
    return sum / count;
  }

  private scoreFromHeader(result: string | undefined, color: Color): number | null {
    if (!result) return null;
    switch (result) {
      case "1-0":
        return color === "white" ? 1 : 0;
      case "0-1":
        return color === "white" ? 0 : 1;
      case "1/2-1/2":
        return 0.5;
      default:
        return null;
    }
  }

  private scoreFromChessCom(game: ChessComGame, color: Color): number | null {
    const result = color === "white" ? game.white?.result : game.black?.result;
    if (!result) return null;
    const normalized = result.toLowerCase();
    if (normalized === "win") return 1;
    if (normalized === "checkmated" || normalized === "resigned" || normalized === "timeout" || normalized === "abandoned" || normalized === "lose") return 0;
    if (
      normalized === "stalemate" ||
      normalized === "agreed" ||
      normalized === "repetition" ||
      normalized === "timevsinsufficientmaterial" ||
      normalized === "insufficient" ||
      normalized === "draw" ||
      normalized === "50move"
    ) {
      return 0.5;
    }
    return null;
  }

  private deriveOpeningName(tags: Record<string, string>, ecoUrl?: string): string | undefined {
    const opening = tags.Opening?.trim();
    const variation = tags.Variation?.trim();
    if (opening && variation) {
      return `${opening}${variation.startsWith("(") ? " " : ": "}${variation}`;
    }
    if (opening) return opening;
    return this.nameFromEcoUrl(ecoUrl ?? tags.ECOUrl);
  }

  private nameFromEcoUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const lastSegment = url.split("/").pop();
    if (!lastSegment) return undefined;
    const decoded = decodeURIComponent(lastSegment);
    const cleaned = decoded.replace(/-/g, " ").replace(/\s+/g, " ").trim();
    return cleaned || undefined;
  }

  private simpleHash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  }

  private computeFenFromSanLine(line: string[]): string {
    const chess = new Chess();
    for (const san of line) {
      try {
        chess.move(san);
      } catch {
        break;
      }
    }
    return chess.fen();
  }

  private selectPunishments(moves: ExplorerMoveStat[], color: Color, take: number): ExplorerMoveStat[] {
    if (!moves.length) return [];
    const scored = moves
      .map(move => ({
        move,
        score: this.scoreForColor(move, color),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.move.total ?? 0) - (a.move.total ?? 0);
      });
    return scored.slice(0, take).map(x => x.move);
  }

  private mapRecentGames(games: ExplorerPositionInfo["recentGames"]): PrepModelGame[] {
    if (!games?.length) return [];
    const out: PrepModelGame[] = [];
    for (const entry of games) {
      const game = entry ?? {};
      const id = game.id ?? generateId();
      const url = game.id ? `https://lichess.org/${game.id}` : `https://lichess.org/analysis?uci=${game.uci ?? ""}`;
      out.push({
        id,
        url,
        winner: game.winner ?? null,
        speed: game.speed,
        mode: game.mode,
        white: game.white,
        black: game.black,
        year: game.year,
        month: game.month,
        uci: game.uci,
      });
    }
    return out;
  }


}

