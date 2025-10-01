export type Color = "white" | "black";

export interface Player {
  username: string; // lowercase for chess.com API
}

export interface ChessComGame {
  // Minimal subset we need from chess.com public API
  url: string;
  pgn: string; // full PGN
  time_control?: string;
  end_time?: number;
  rated?: boolean;
  white: { username: string; result?: string };
  black: { username: string; result?: string };
}

export interface OpeningLine {
  eco?: string;
  name?: string;
  sanLine: string[]; // ["e4","e5","Nf3",...]
}

export interface ExplorerMoveStat {
  san: string; // move in SAN
  white: number; // wins
  draws: number;
  black: number; // wins
  total: number; // games total for this move
  averageRating?: number;
}

export interface ExplorerPositionInfo {
  opening?: { name?: string; eco?: string };
  moves: ExplorerMoveStat[];
}

export interface CommonBranchIssue {
  perspective: "you" | "opponent"; // who is likely to suffer
  color: Color; // color of the perspective player for this line
  line: OpeningLine; // shared prefix
  triggerMove: string; // when this is played, edge appears
  reason: string; // why interesting
  explorerEvidence?: ExplorerMoveStat; // lichess data
}

export interface PrepSuggestion {
  id: string;
  branch: CommonBranchIssue;
  recommendedFollowUp: string[]; // continuation in SAN for you to study
}


