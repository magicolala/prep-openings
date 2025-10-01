import type { Player, ChessComGame, ExplorerPositionInfo } from "./models";

export interface IClock {
  now(): Date;
}

export interface IChessComService {
  getRecentGames(username: string, monthsBack: number): Promise<ChessComGame[]>;
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
  }): Promise<import("./models").PrepSuggestion[]>;
}


