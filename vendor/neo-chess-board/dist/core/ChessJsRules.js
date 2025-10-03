import { Chess, SQUARES } from 'chess.js';
import { PgnNotation } from './PgnNotation';
/**
 * Adapter de règles utilisant chess.js pour une validation complète des coups
 */
export class ChessJsRules {
    getFenParts(fen) {
        const fenString = (fen ?? this.chess.fen()).trim();
        const parts = fenString.split(/\s+/);
        if (parts.length < 6) {
            return parts.concat(new Array(6 - parts.length).fill(''));
        }
        return parts;
    }
    getChessInstance() {
        return this.chess;
    }
    constructor(fen) {
        this.chess = new Chess(fen);
        this.pgnNotation = new PgnNotation();
    }
    /**
     * Obtenir la position actuelle au format FEN
     */
    getFEN() {
        return this.chess.fen();
    }
    /**
     * Définir une position FEN
     */
    setFEN(fen) {
        try {
            console.log('Attempting to load FEN:', fen);
            // Ensure FEN has all 6 parts, adding default if missing
            const fenParts = fen.split(' ');
            if (fenParts.length === 4) {
                // Missing en passant, halfmove clock and fullmove number
                fen += ' - 0 1'; // Default values
            }
            else if (fenParts.length === 5) {
                // Missing fullmove number
                fen += ' 1'; // Default value
            }
            this.chess.load(fen);
        }
        catch (error) {
            console.error('Invalid FEN:', fen, error);
            throw new Error(`Invalid FEN: ${fen}`);
        }
    }
    /**
     * Jouer un coup
     */
    move(moveData) {
        try {
            const move = this.chess.move({
                from: moveData.from,
                to: moveData.to,
                promotion: moveData.promotion,
            });
            if (move) {
                return { ok: true };
            }
            else {
                return { ok: false, reason: 'Invalid move' };
            }
        }
        catch (error) {
            return { ok: false, reason: error.message || 'Invalid move' };
        }
    }
    /**
     * Obtenir tous les coups légaux depuis une case
     */
    movesFrom(square) {
        const moves = this.chess.moves({ square: square, verbose: true });
        return moves.map((move) => ({
            from: move.from,
            to: move.to,
            promotion: move.promotion === 'k' ? undefined : move.promotion,
            piece: move.piece,
            captured: move.captured,
            flags: move.flags,
        }));
    }
    /**
     * Obtenir tous les coups légaux
     */
    getAllMoves() {
        const moves = this.chess.moves({ verbose: true });
        return moves.map((move) => ({
            from: move.from,
            to: move.to,
            promotion: move.promotion === 'k' ? undefined : move.promotion,
            piece: move.piece,
            captured: move.captured,
            flags: move.flags,
        }));
    }
    /**
     * Vérifier si un coup est légal
     */
    isLegalMove(from, to, promotion) {
        try {
            // Créer une copie pour tester le coup sans affecter l'état
            const testChess = new Chess(this.chess.fen());
            const move = testChess.move({
                from,
                to,
                promotion: promotion,
            });
            return move !== null;
        }
        catch {
            return false;
        }
    }
    /**
     * Vérifier si le roi est en échec
     */
    inCheck() {
        return this.chess.inCheck();
    }
    /**
     * Vérifier si c'est échec et mat
     */
    isCheckmate() {
        return this.chess.isCheckmate();
    }
    /**
     * Vérifier si c'est pat (stalemate)
     */
    isStalemate() {
        return this.chess.isStalemate();
    }
    /**
     * Vérifier si la partie est terminée
     */
    isGameOver() {
        return this.chess.isGameOver();
    }
    /**
     * Obtenir le résultat de la partie
     */
    getGameResult() {
        if (this.chess.isCheckmate()) {
            return this.chess.turn() === 'w' ? '0-1' : '1-0';
        }
        else if (this.chess.isStalemate() || this.chess.isDraw()) {
            return '1/2-1/2';
        }
        return '*';
    }
    /**
     * Obtenir le joueur au trait
     */
    turn() {
        return this.chess.turn();
    }
    /**
     * Obtenir la pièce sur une case
     */
    get(square) {
        const piece = this.chess.get(square);
        return piece || null;
    }
    /**
     * Annuler le dernier coup
     */
    undo() {
        const move = this.chess.undo();
        return move !== null;
    }
    /**
     * Obtenir l'historique des coups
     */
    history() {
        return this.chess.history();
    }
    /**
     * Obtenir l'historique détaillé des coups
     */
    getHistory() {
        return this.chess.history({ verbose: true });
    }
    /**
     * Remettre à la position initiale
     */
    reset() {
        this.chess.reset();
    }
    /**
     * Obtenir les cases attaquées par le joueur actuel
     *
     * Utilise la détection native de chess.js pour identifier toutes les cases
     * actuellement contrôlées par le joueur au trait.
     */
    getAttackedSquares() {
        const attackingColor = this.chess.turn();
        return SQUARES.filter((square) => this.chess.isAttacked(square, attackingColor)).map((square) => square);
    }
    /**
     * Vérifier si une case est attaquée
     *
     * @param square Case à vérifier (notation algébrique, insensible à la casse)
     * @param by Couleur optionnelle pour vérifier une couleur spécifique
     * @throws {Error} si la case ou la couleur fournie est invalide
     */
    isSquareAttacked(square, by) {
        if (typeof square !== 'string') {
            throw new Error(`Invalid square: ${square}`);
        }
        const normalizedSquare = square.toLowerCase();
        if (!SQUARES.includes(normalizedSquare)) {
            throw new Error(`Invalid square: ${square}`);
        }
        let colorToCheck;
        if (by === undefined) {
            colorToCheck = this.chess.turn();
        }
        else if (by === 'w' || by === 'b') {
            colorToCheck = by;
        }
        else {
            throw new Error(`Invalid color: ${by}`);
        }
        return this.chess.isAttacked(normalizedSquare, colorToCheck);
    }
    /**
     * Obtenir les cases du roi en échec (pour le surlignage)
     */
    getCheckSquares() {
        if (!this.chess.inCheck())
            return [];
        const kingSquare = this.getKingSquare(this.chess.turn());
        return kingSquare ? [kingSquare] : [];
    }
    /**
     * Obtenir la position du roi d'une couleur
     */
    getKingSquare(color) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
        for (const file of files) {
            for (const rank of ranks) {
                const square = `${file}${rank}`;
                const piece = this.chess.get(square);
                if (piece && piece.type === 'k' && piece.color === color) {
                    return square;
                }
            }
        }
        return null;
    }
    /**
     * Vérifier si le roque est possible
     */
    canCastle(side, color) {
        const currentColor = color || this.chess.turn();
        const castlingRights = this.chess.getCastlingRights(currentColor);
        if (side === 'k') {
            return castlingRights.k;
        }
        else {
            return castlingRights.q;
        }
    }
    /**
     * Obtenir le nombre de coups depuis le début
     */
    moveNumber() {
        return this.chess.moveNumber();
    }
    /**
     * Obtenir le nombre de demi-coups depuis la dernière prise ou mouvement de pion
     */
    halfMoves() {
        const fenParts = this.getFenParts();
        const halfMoveField = fenParts[4] ?? '0';
        const halfMoveCount = Number.parseInt(halfMoveField, 10);
        return Number.isNaN(halfMoveCount) ? 0 : halfMoveCount;
    }
    /**
     * Créer une copie de l'état actuel
     */
    clone() {
        return new ChessJsRules(this.chess.fen());
    }
    /**
     * Valider un FEN
     */
    static isValidFEN(fen) {
        try {
            const chess = new Chess();
            chess.load(fen);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Obtenir des informations sur le dernier coup joué
     */
    getLastMove() {
        const history = this.chess.history({ verbose: true });
        return history.length > 0 ? history[history.length - 1] : null;
    }
    /**
     * Générer le FEN à partir d'une position donnée
     */
    generateFEN() {
        return this.chess.fen();
    }
    /**
     * Définir les métadonnées PGN pour la partie actuelle
     */
    setPgnMetadata(metadata) {
        this.pgnNotation.setMetadata(metadata);
    }
    /**
     * Exporter la partie actuelle au format PGN
     */
    toPgn(includeHeaders = true) {
        this.pgnNotation.importFromChessJs(this.chess);
        return this.pgnNotation.toPgn(includeHeaders);
    }
    /**
     * Télécharger la partie actuelle sous forme de fichier PGN (navigateur uniquement)
     */
    downloadPgn(filename) {
        this.pgnNotation.importFromChessJs(this.chess);
        this.pgnNotation.downloadPgn(filename);
    }
    /**
     * Obtenir l'instance PgnNotation pour une manipulation avancée
     */
    getPgnNotation() {
        return this.pgnNotation;
    }
    /**
     * Charger une partie à partir d'une chaîne PGN
     */
    loadPgn(pgn) {
        try {
            this.chess.loadPgn(pgn);
            this.pgnNotation.importFromChessJs(this.chess);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Obtenir la notation PGN du dernier coup joué
     */
    getLastMoveNotation() {
        const history = this.chess.history();
        return history.length > 0 ? history[history.length - 1] : null;
    }
    /**
     * Obtenir toute l'historique des coups en notation PGN
     */
    getPgnMoves() {
        return this.chess.history();
    }
}
