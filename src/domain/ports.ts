import type {
  Player,
  ChessComGame,
  ExplorerPositionInfo,
  PrepSuggestion,
  OpeningSummary,
  OpeningTreeResult,
  OpeningFenNode,
  PrepSheet,
} from "./models";

export interface IClock {
  now(): Date;
}

export interface IChessComService {
  getRecentGames(
    username: string,
    monthsBack: number,
    onProgress?: (progress: {
      username: string;
      games: number;
      monthsFetched: number;
      monthsTotal: number;
    }) => void
  ): Promise<ChessComGame[]>;
}

export interface ILichessExplorerService {
  // Query the Lichess opening explorer for position stats given a SAN line
  getPositionInfo(sanLine: string[], variant?: "standard"): Promise<ExplorerPositionInfo>;
}

export interface IOpeningAnalyzer {
  findCommonWeaknesses(params: {
    you: Player;
    opponent: Player;
    yourGames: ChessComGame[];
    oppGames: ChessComGame[];
    explorer: ILichessExplorerService;
  }): Promise<PrepSuggestion[]>;

  findSharedOpenings(params: {
    yourGames: ChessComGame[];
    oppGames: ChessComGame[];
    minCommonPlies?: number;
    maxPlies?: number;
  }): OpeningSummary[];

  buildOpeningTree(params: {
    you: Player;
    opponent: Player;
    yourGames: ChessComGame[];
    oppGames: ChessComGame[];
    maxPlies?: number;
    plyWindow?: [number, number];
  }): OpeningTreeResult;

  createPrepSheet(params: {
    node: OpeningFenNode;
    opponentTree: OpeningTreeResult["opponent"];
    yourIndex: OpeningTreeResult["you"]["index"];
    explorer: ILichessExplorerService;
    punishmentsPerLeak?: number;
    maxModelGames?: number;
  }): Promise<PrepSheet>;
}
