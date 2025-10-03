import type { Square, Color } from './types';
export declare const FILES: readonly ["a", "b", "c", "d", "e", "f", "g", "h"];
export declare const RANKS: readonly ["1", "2", "3", "4", "5", "6", "7", "8"];
export declare const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export declare function isWhitePiece(piece: string): boolean;
export declare function sq(file: number, rank: number): Square;
export declare function sqToFR(square: Square): {
    f: number;
    r: number;
};
export declare function parseFEN(fen: string): {
    board: (string | null)[][];
    turn: Color;
    castling: string;
    ep: string | null;
    halfmove: number;
    fullmove: number;
};
export declare function clamp(value: number, min: number, max: number): number;
export declare function lerp(a: number, b: number, t: number): number;
export declare function easeOutCubic(t: number): number;
