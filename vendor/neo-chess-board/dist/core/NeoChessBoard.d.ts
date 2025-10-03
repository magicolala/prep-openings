import { EventBus } from './EventBus';
import type { ThemeName } from './themes';
import { DrawingManager } from './DrawingManager';
import type { Square, BoardOptions, Arrow, SquareHighlight, Premove, Theme, PieceSet } from './types';
interface BoardEvents {
    move: {
        from: Square;
        to: Square;
        fen: string;
    };
    illegal: {
        from: Square;
        to: Square;
        reason: string;
    };
    update: {
        fen: string;
    };
}
export declare class NeoChessBoard {
    /**
     * Event bus for emitting and listening to board events.
     */
    bus: EventBus<BoardEvents>;
    /**
     * The root HTML element where the board is rendered.
     */
    private root;
    /**
     * Adapter for chess rules, handling move validation and FEN manipulation.
     */
    private rules;
    /**
     * Current state of the chess board, parsed from FEN.
     */
    private state;
    /**
     * The current visual theme applied to the board.
     */
    private theme;
    /**
     * The orientation of the board ('white' or 'black' at the bottom).
     */
    private orientation;
    /**
     * Whether the board is interactive (draggable pieces, clickable squares).
     */
    private interactive;
    /**
     * Whether to display algebraic coordinates on the board.
     */
    private showCoords;
    /**
     * Whether to highlight legal moves when a piece is selected.
     */
    private highlightLegal;
    /**
     * Duration of piece animation in milliseconds.
     */
    private animationMs;
    /**
     * Manages piece sprites for drawing.
     */
    private sprites;
    /**
     * The size of the board in pixels (width and height).
     */
    private sizePx;
    /**
     * The size of a single square in pixels.
     */
    private square;
    /**
     * Device pixel ratio for high-DPI displays.
     */
    private dpr;
    /**
     * Canvas for drawing the board squares.
     */
    private cBoard;
    /**
     * Canvas for drawing the chess pieces.
     */
    private cPieces;
    /**
     * Canvas for drawing overlays like highlights, arrows, and coordinates.
     */
    private cOverlay;
    /**
     * 2D rendering context for the board canvas.
     */
    private ctxB;
    /**
     * 2D rendering context for the pieces canvas.
     */
    private ctxP;
    /**
     * 2D rendering context for the overlay canvas.
     */
    private ctxO;
    /**
     * Manages drawing of arrows, highlights, and premoves on the overlay canvas.
     */
    drawingManager: DrawingManager;
    /**
     * Whether premoves are allowed.
     */
    private allowPremoves;
    /**
     * Whether arrows are displayed.
     */
    private showArrows;
    /**
     * Whether highlights are displayed.
     */
    private showHighlights;
    /**
     * Whether right-click highlights are enabled.
     */
    private rightClickHighlights;
    /**
     * Whether sound effects are enabled.
     */
    private soundEnabled;
    /**
     * Whether square names (coordinates) are shown.
     */
    private showSquareNames;
    /**
     * Whether the board orientation should automatically follow the side to move.
     */
    private autoFlip;
    /**
     * URL for the move sound audio file.
     */
    private soundUrl;
    /**
     * URLs for move sounds by the side that just played.
     */
    private soundUrls;
    /**
     * Custom piece sprites provided by the user.
     */
    private customPieceSprites;
    /**
     * Token used to invalidate pending custom piece loading operations.
     */
    private _pieceSetToken;
    /**
     * Stores the latest piece set reference applied to the board.
     */
    private _pieceSetRaw?;
    /**
     * Audio element for playing move sounds.
     */
    private moveSound;
    /**
     * Audio elements keyed by the color that just moved.
     */
    private moveSounds;
    /**
     * The last move played, used for highlighting.
     */
    private _lastMove;
    /**
     * The currently stored premove.
     */
    private _premove;
    /**
     * The currently selected square.
     */
    private _selected;
    /**
     * Cached legal moves for the selected piece.
     */
    private _legalCached;
    /**
     * Information about the piece currently being dragged.
     */
    private _dragging;
    /**
     * The square currently hovered over during a drag.
     */
    private _hoverSq;
    /**
     * List of arrows drawn on the board (legacy, managed by DrawingManager now).
     */
    private _arrows;
    /**
     * Custom highlights applied to squares.
     */
    private _customHighlights;
    /**
     * Request animation frame ID for animations.
     */
    private _raf;
    /**
     * Internal state for tracking an arrow being drawn by the user.
     */
    private _drawingArrow;
    /**
     * Creates an instance of NeoChessBoard.
     * @param root The HTMLElement to which the board will be appended.
     * @param options Optional configuration options for the board.
     */
    constructor(root: HTMLElement, options?: BoardOptions);
    /**
     * Gets the current position of the board in FEN format.
     * @returns The current FEN string.
     */
    getPosition(): string;
    /**
     * Sets the position of the board using a FEN string.
     * @param fen The FEN string to set the board to.
     * @param immediate If true, the board will update immediately without animation.
     */
    setPosition(fen: string, immediate?: boolean): void;
    /**
     * Registers an event handler for a specific board event.
     * @param event The name of the event to listen for.
     * @param handler The callback function to execute when the event is emitted.
     * @returns A function to unsubscribe the event handler.
     */
    on<K extends keyof BoardEvents>(event: K, handler: (payload: BoardEvents[K]) => void): () => void;
    /**
     * Destroys the board instance, removing all event listeners and clearing the DOM.
     */
    destroy(): void;
    /**
     * Sets the visual theme of the board.
     * @param theme Theme name or object to apply.
     */
    setTheme(theme: ThemeName | Theme): void;
    /**
     * Applies a theme object directly, normalizing it and re-rendering the board.
     * @param theme Theme name or object to apply.
     */
    applyTheme(theme: ThemeName | Theme): void;
    /**
     * Applies a custom piece set, allowing users to provide their own sprites.
     * Passing `undefined` or an empty configuration reverts to the default flat sprites.
     * @param pieceSet Custom piece configuration to apply.
     */
    setPieceSet(pieceSet?: PieceSet | null): Promise<void>;
    /**
     * Sets the board position using a FEN string.
     * @param fen The FEN string representing the board state.
     * @param immediate If true, the board updates instantly without animation.
     */
    setFEN(fen: string, immediate?: boolean): void;
    private _buildDOM;
    /**
     * Resizes the board canvases based on the root element's dimensions and device pixel ratio.
     * This method is typically called when the board's container changes size.
     */
    resize(): void;
    /**
     * Initializes or re-initializes the sprite sheet for pieces based on the current theme.
     * This is called when the theme changes or on initial setup.
     */
    private _rasterize;
    /**
     * Renders all layers of the chess board (board, pieces, overlay).
     * This method should be called whenever the board state or visual settings change.
     */
    renderAll(): void;
    /**
     * Converts a square (e.g., 'e4') to its pixel coordinates on the canvas.
     * Adjusts for board orientation.
     * @param square The algebraic notation of the square.
     * @returns An object with x and y pixel coordinates.
     */
    private _sqToXY;
    /**
     * Draws the chess board squares onto the board canvas.
     * Uses the current theme's light and dark square colors.
     */
    private _drawBoard;
    private _resolvePieceSprite;
    private _loadImage;
    /**
     * Draws a single piece sprite onto the pieces canvas.
     * @param piece The FEN notation of the piece (e.g., 'p', 'K').
     * @param x The x-coordinate for the top-left corner of the piece.
     * @param y The y-coordinate for the top-left corner of the piece.
     * @param scale Optional scale factor for the piece (default is 1).
     */
    private _drawPieceSprite;
    /**
     * Draws all pieces onto the pieces canvas, handling dragging pieces separately.
     */
    private _drawPieces;
    /**
     * Draws the overlay elements such as last move highlights, selected square, legal moves, premoves, and arrows.
     * Delegates to DrawingManager for modern drawing features.
     */
    private _drawOverlay;
    /**
     * Draws an arrow between the center of two squares.
     * @param from The starting square of the arrow.
     * @param to The ending square of the arrow.
     * @param color The color of the arrow.
     */
    private _drawArrow;
    /**
     * Draws an arrow between two pixel coordinates on the overlay canvas.
     * This is a helper for `_drawArrow`.
     * @param fromX Starting x-coordinate.
     * @param fromY Starting y-coordinate.
     * @param toX Ending x-coordinate.
     * @param toY Ending y-coordinate.
     * @param color The color of the arrow.
     */
    private _drawArrowBetween;
    private _setSelection;
    private _handleClickMove;
    private _attemptMove;
    private _attachEvents;
    private _removeEvents;
    private _evt;
    private _xyToSquare;
    private _pieceAt;
    /**
     * Clears any ongoing animation frame request.
     */
    private _clearAnim;
    /**
     * Animates piece movements from a starting board state to a target board state.
     * @param target The target BoardState after the move.
     * @param start The starting BoardState before the move.
     */
    private _animateTo;
    /**
     * Finds the new position of a piece after a move.
     * This is a helper function for `_animateTo` to track piece movements.
     * @param board The target board state.
     * @param piece The piece to find.
     * @param r0 Original row of the piece.
     * @param f0 Original file of the piece.
     * @param start The starting board state.
     * @returns The new row and file of the piece, or null if not found.
     */
    private findPiece;
    /**
     * This method appears to be a remnant or is currently unused.
     * It attempts to draw the board and pieces using the DrawingManager.
     * @deprecated This method might be removed or refactored in future versions.
     */
    private _draw;
    /**
     * Initializes the audio element for move sounds if sound is enabled and a sound URL is provided.
     * Handles potential loading errors silently.
     */
    private _initializeSound;
    /**
     * Plays the move sound if sound is enabled and the audio element is initialized.
     * Catches and ignores playback errors (e.g., due to user interaction policies).
     */
    private _playMoveSound;
    /**
     * Synchronizes the board orientation with the side to move when auto-flip is enabled.
     * @param initial When true, only the internal orientation state is updated without rendering.
     */
    private _syncOrientationFromTurn;
    /**
     * Enables or disables sound effects for moves.
     * If enabling and sound is not yet initialized, it will attempt to initialize it.
     * @param enabled True to enable sounds, false to disable.
     */
    setSoundEnabled(enabled: boolean): void;
    /**
     * Updates the URLs used for move sounds and reinitializes audio elements if needed.
     * @param soundUrls Move sound URLs keyed by the color that just played.
     */
    setSoundUrls(soundUrls: BoardOptions['soundUrls']): void;
    /**
     * Enables or disables automatic board flipping based on the side to move.
     * @param autoFlip True to enable auto-flip, false to disable it.
     */
    setAutoFlip(autoFlip: boolean): void;
    /**
     * Sets the board orientation.
     * @param orientation The desired orientation ('white' or 'black').
     */
    setOrientation(orientation: 'white' | 'black'): void;
    /**
     * Shows or hides arrows drawn on the board.
     * @param show True to show arrows, false to hide them.
     */
    setShowArrows(show: boolean): void;
    /**
     * Shows or hides highlights on the board.
     * @param show True to show highlights, false to hide them.
     */
    setShowHighlights(show: boolean): void;
    /**
     * Enables or disables premoves.
     * If premoves are disabled, any existing premove will be cleared.
     * @param allow True to allow premoves, false to disallow.
     */
    setAllowPremoves(allow: boolean): void;
    /**
     * Enables or disables highlighting of legal moves for the selected piece.
     * @param highlight True to highlight legal moves, false to disable.
     */
    setHighlightLegal(highlight: boolean): void;
    /**
     * Shows or hides square names (coordinates) on the board.
     * @param show True to show square names, false to hide them.
     */
    setShowSquareNames(show: boolean): void;
    /**
     * Attempts to execute a stored premove if it is valid in the current board position.
     * This method is typically called after an opponent's move has been processed.
     * If the premove is legal, it is executed after a short delay to allow for animation.
     * If illegal, the premove is silently cleared.
     */
    private _executePremoveIfValid;
    /**
     * Add an arrow on the board
     * @param arrow The arrow to add (can be an object with from/to or an Arrow object)
     */
    addArrow(arrow: {
        from: Square;
        to: Square;
        color?: string;
    } | Arrow): void;
    /**
     * Remove an arrow from the board
     */
    removeArrow(from: Square, to: Square): void;
    /**
     * Clear all arrows
     */
    clearArrows(): void;
    /**
     * Add a highlight to a square
     * @param square The square to highlight (e.g., 'e4')
     * @param type The type of highlight (e.g., 'selected', 'lastMove', 'check')
     */
    addHighlight(square: Square | SquareHighlight, type?: string): void;
    /**
     * Remove a highlight from a square
     */
    removeHighlight(square: Square): void;
    /**
     * Clear all highlights
     */
    clearHighlights(): void;
    /**
     * Set a premove
     */
    setPremove(premove: Premove): void;
    /**
     * Clear the current premove
     */
    clearPremove(): void;
    /**
     * Get the current premove
     */
    getPremove(): Premove | null;
    /**
     * Clear all drawings (arrows, highlights, premoves)
     */
    clearAllDrawings(): void;
    /**
     * Export the drawings state
     */
    exportDrawings(): string | null;
    /**
     * Import the drawings state
     */
    importDrawings(state: any): void;
    /**
     * Load a PGN with visual annotations
     */
    loadPgnWithAnnotations(pgnString: string): boolean;
    /**
     * Display annotations from the last move played
     */
    private displayAnnotationsFromPgn;
    /**
     * Add visual annotations to the current move and save them in the PGN
     */
    addAnnotationsToCurrentMove(arrows?: Arrow[], circles?: SquareHighlight[], comment?: string): void;
    /**
     * Export the PGN with all visual annotations
     */
    exportPgnWithAnnotations(): string;
}
export {};
