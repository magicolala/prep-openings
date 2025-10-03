import type { RulesAdapter, PgnMove, PgnMoveAnnotations } from './types';
export interface PgnMetadata {
    Event?: string;
    Site?: string;
    Date?: string;
    Round?: string;
    White?: string;
    Black?: string;
    Result?: string;
    WhiteElo?: string;
    BlackElo?: string;
    TimeControl?: string;
    ECO?: string;
    Opening?: string;
    Variation?: string;
    Annotator?: string;
    FEN?: string;
    SetUp?: string;
    [key: string]: string | undefined;
}
export declare class PgnNotation {
    private metadata;
    private moves;
    private result;
    private rulesAdapter?;
    constructor(rulesAdapter?: RulesAdapter);
    /**
     * Set the game metadata (headers)
     */
    setMetadata(metadata: Partial<PgnMetadata>): void;
    getMetadata(): PgnMetadata;
    /**
     * Add a move to the game
     */
    addMove(moveNumber: number, whiteMove?: string, blackMove?: string, whiteComment?: string, blackComment?: string): void;
    /**
     * Set the game result
     */
    setResult(result: string): void;
    /**
     * Import moves from a chess.js game
     */
    importFromChessJs(chess: any): void;
    /**
     * Parse PGN move text to extract individual moves
     */
    private parsePgnMoves;
    /**
     * Generate the complete PGN string
     */
    toPgn(includeHeaders?: boolean): string;
    /**
     * Clear all moves and reset
     */
    clear(): void;
    /**
     * Get move count
     */
    getMoveCount(): number;
    /**
     * Get current result
     */
    getResult(): string;
    /**
     * Create a PGN from a simple move list
     */
    static fromMoveList(moves: string[], metadata?: Partial<PgnMetadata>): string;
    /**
     * Download PGN as file (browser only)
     */
    downloadPgn(filename?: string): void;
    /**
     * Add visual annotations to a move
     */
    addMoveAnnotations(moveNumber: number, isWhite: boolean, annotations: PgnMoveAnnotations): void;
    /**
     * Parse a PGN string with comments containing visual annotations
     */
    loadPgnWithAnnotations(pgnString: string): void;
    /**
     * Parse moves string with embedded annotations
     */
    private parseMovesWithAnnotations;
    private static formatEvaluation;
    private updateMoveEvaluation;
    private normalizeCommentParts;
    /**
     * Generate PGN with visual annotations embedded in comments
     */
    toPgnWithAnnotations(): string;
    /**
     * Get annotations for a specific move
     */
    getMoveAnnotations(moveNumber: number, isWhite: boolean): PgnMoveAnnotations | undefined;
    /**
     * Get all moves with their annotations
     */
    getMovesWithAnnotations(): PgnMove[];
}
