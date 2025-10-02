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
  eco?: string; // Chess.com openings URL or ECO reference
  white: { username: string; result?: string };
  black: { username: string; result?: string };
}

export interface OpeningLine {
  eco?: string; // ECO code like B93
  ecoUrl?: string; // Reference page on chess.com
  name?: string;
  sanLine: string[]; // ["e4","e5","Nf3",...]
}

export interface OpeningSummary extends OpeningLine {
  id: string;
  youCount: number;
  opponentCount: number;
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
  recentGames?: Array<{
    id?: string;
    winner?: "white" | "black" | null;
    speed?: string;
    mode?: string;
    white?: { name?: string; rating?: number };
    black?: { name?: string; rating?: number };
    year?: number;
    month?: string;
    uci?: string;
  }>;
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

export interface FenMoveSample {
  san: string;
  count: number;
  scoreSum: number;
  sampleGameUrl?: string;
  fullSanLine: string[];
}

export interface OpeningFenNode {
  id: string;
  fen: string;
  ply: number; // half-move index (1-based)
  color: Color; // color of the opponent at move time
  sanLine: string[]; // moves leading to the FEN (before opponent move)
  eco?: string;
  name?: string;
  frequency: number; // number of games reaching this FEN for opponent
  score: number; // average score for opponent from games hitting this FEN
  moveSamples: FenMoveSample[]; // moves the opponent played from this position
  sampleGameUrl?: string;
  preferredMove?: string; // most frequent SAN move by opponent
  yourOverlap?: {
    frequency: number;
    score: number;
  };
}

export interface OpeningTreeByColor {
  color: Color;
  nodes: OpeningFenNode[];
}

export interface OpeningTreeResultMeta {
  opponentUsedFallback: boolean;
  youUsedFallback: boolean;
  opponentRelaxedWindow: boolean;
  youRelaxedWindow: boolean;
  opponentCutoffApplied: boolean;
  youCutoffApplied: boolean;
  cutoffEpochMs?: number;
}

export interface OpeningTreeResult {
  opponent: {
    byColor: Record<Color, OpeningFenNode[]>;
    index: Record<string, OpeningFenNode>;
  };
  you: {
    byColor: Record<Color, OpeningFenNode[]>;
    index: Record<string, OpeningFenNode>;
  };
  meta?: OpeningTreeResultMeta;
}

export interface LichessExplorerGameRef {
  id: string;
  url: string;
  winner?: "white" | "black" | "draw" | null;
  speed?: string;
  mode?: string;
  white?: { name?: string; rating?: number };
  black?: { name?: string; rating?: number };
  year?: number;
  month?: string;
  uci?: string;
}

export interface PrepLeak {
  id: string;
  color: Color;
  fen: string;
  sanLine: string[];
  move: string; // opponent move considered weak
  frequency: number;
  playerScore: number; // opponent score from their games
  explorerScore?: number; // same move performance according to Explorer
  explorerPopularity?: number; // share of this move in Explorer
  reason: string;
  recommendedResponses: ExplorerMoveStat[]; // suggested replies for us
  sampleGameUrl?: string;
  openingName?: string;
  eco?: string;
  lichessRecentGames?: PrepModelGame[];
  yourOverlap?: {
    frequency: number;
    score: number;
  };
}

export interface PrepModelGame extends LichessExplorerGameRef {
  highlight?: string;
}

export interface PrepSheet {
  leaks: PrepLeak[];
  modelGames: PrepModelGame[];
}
