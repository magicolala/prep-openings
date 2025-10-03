import { Chess } from 'chess.js';
import type { RulesAdapter, Move } from './types';
import { PgnNotation, PgnMetadata } from './PgnNotation';
/**
 * Adapter de règles utilisant chess.js pour une validation complète des coups
 */
export declare class ChessJsRules implements RulesAdapter {
    private chess;
    private pgnNotation;
    private getFenParts;
    getChessInstance(): Chess;
    constructor(fen?: string);
    /**
     * Obtenir la position actuelle au format FEN
     */
    getFEN(): string;
    /**
     * Définir une position FEN
     */
    setFEN(fen: string): void;
    /**
     * Jouer un coup
     */
    move(moveData: {
        from: string;
        to: string;
        promotion?: string;
    }): {
        ok: boolean;
        reason?: string;
    };
    /**
     * Obtenir tous les coups légaux depuis une case
     */
    movesFrom(square: string): Move[];
    /**
     * Obtenir tous les coups légaux
     */
    getAllMoves(): Move[];
    /**
     * Vérifier si un coup est légal
     */
    isLegalMove(from: string, to: string, promotion?: string): boolean;
    /**
     * Vérifier si le roi est en échec
     */
    inCheck(): boolean;
    /**
     * Vérifier si c'est échec et mat
     */
    isCheckmate(): boolean;
    /**
     * Vérifier si c'est pat (stalemate)
     */
    isStalemate(): boolean;
    /**
     * Vérifier si la partie est terminée
     */
    isGameOver(): boolean;
    /**
     * Obtenir le résultat de la partie
     */
    getGameResult(): '1-0' | '0-1' | '1/2-1/2' | '*';
    /**
     * Obtenir le joueur au trait
     */
    turn(): 'w' | 'b';
    /**
     * Obtenir la pièce sur une case
     */
    get(square: string): {
        type: string;
        color: string;
    } | null;
    /**
     * Annuler le dernier coup
     */
    undo(): boolean;
    /**
     * Obtenir l'historique des coups
     */
    history(): string[];
    /**
     * Obtenir l'historique détaillé des coups
     */
    getHistory(): any[];
    /**
     * Remettre à la position initiale
     */
    reset(): void;
    /**
     * Obtenir les cases attaquées par le joueur actuel
     *
     * Utilise la détection native de chess.js pour identifier toutes les cases
     * actuellement contrôlées par le joueur au trait.
     */
    getAttackedSquares(): string[];
    /**
     * Vérifier si une case est attaquée
     *
     * @param square Case à vérifier (notation algébrique, insensible à la casse)
     * @param by Couleur optionnelle pour vérifier une couleur spécifique
     * @throws {Error} si la case ou la couleur fournie est invalide
     */
    isSquareAttacked(square: string, by?: 'w' | 'b'): boolean;
    /**
     * Obtenir les cases du roi en échec (pour le surlignage)
     */
    getCheckSquares(): string[];
    /**
     * Obtenir la position du roi d'une couleur
     */
    private getKingSquare;
    /**
     * Vérifier si le roque est possible
     */
    canCastle(side: 'k' | 'q', color?: 'w' | 'b'): boolean;
    /**
     * Obtenir le nombre de coups depuis le début
     */
    moveNumber(): number;
    /**
     * Obtenir le nombre de demi-coups depuis la dernière prise ou mouvement de pion
     */
    halfMoves(): number;
    /**
     * Créer une copie de l'état actuel
     */
    clone(): ChessJsRules;
    /**
     * Valider un FEN
     */
    static isValidFEN(fen: string): boolean;
    /**
     * Obtenir des informations sur le dernier coup joué
     */
    getLastMove(): any | null;
    /**
     * Générer le FEN à partir d'une position donnée
     */
    generateFEN(): string;
    /**
     * Définir les métadonnées PGN pour la partie actuelle
     */
    setPgnMetadata(metadata: Partial<PgnMetadata>): void;
    /**
     * Exporter la partie actuelle au format PGN
     */
    toPgn(includeHeaders?: boolean): string;
    /**
     * Télécharger la partie actuelle sous forme de fichier PGN (navigateur uniquement)
     */
    downloadPgn(filename?: string): void;
    /**
     * Obtenir l'instance PgnNotation pour une manipulation avancée
     */
    getPgnNotation(): PgnNotation;
    /**
     * Charger une partie à partir d'une chaîne PGN
     */
    loadPgn(pgn: string): boolean;
    /**
     * Obtenir la notation PGN du dernier coup joué
     */
    getLastMoveNotation(): string | null;
    /**
     * Obtenir toute l'historique des coups en notation PGN
     */
    getPgnMoves(): string[];
}
