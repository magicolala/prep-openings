import { EventBus } from './EventBus';
import { parseFEN, isWhitePiece, sq, sqToFR, clamp, lerp, easeOutCubic, } from './utils';
import { resolveTheme } from './themes';
import { FlatSprites } from './FlatSprites';
import { ChessJsRules } from './ChessJsRules';
import { DrawingManager } from './DrawingManager';
export class NeoChessBoard {
    /**
     * Creates an instance of NeoChessBoard.
     * @param root The HTMLElement to which the board will be appended.
     * @param options Optional configuration options for the board.
     */
    constructor(root, options = {}) {
        /**
         * Event bus for emitting and listening to board events.
         */
        this.bus = new EventBus();
        /**
         * The size of the board in pixels (width and height).
         */
        this.sizePx = 480;
        /**
         * The size of a single square in pixels.
         */
        this.square = 60;
        /**
         * Device pixel ratio for high-DPI displays.
         */
        this.dpr = 1;
        /**
         * Custom piece sprites provided by the user.
         */
        this.customPieceSprites = {};
        /**
         * Token used to invalidate pending custom piece loading operations.
         */
        this._pieceSetToken = 0;
        // Audio elements
        /**
         * Audio element for playing move sounds.
         */
        this.moveSound = null;
        /**
         * Audio elements keyed by the color that just moved.
         */
        this.moveSounds = {};
        // Internal state tracking for interactions and animations
        /**
         * The last move played, used for highlighting.
         */
        this._lastMove = null;
        /**
         * The currently stored premove.
         */
        this._premove = null;
        /**
         * The currently selected square.
         */
        this._selected = null;
        /**
         * Cached legal moves for the selected piece.
         */
        this._legalCached = null;
        /**
         * Information about the piece currently being dragged.
         */
        this._dragging = null;
        /**
         * The square currently hovered over during a drag.
         */
        this._hoverSq = null;
        /**
         * List of arrows drawn on the board (legacy, managed by DrawingManager now).
         */
        this._arrows = [];
        /**
         * Custom highlights applied to squares.
         */
        this._customHighlights = null;
        /**
         * Request animation frame ID for animations.
         */
        this._raf = 0;
        /**
         * Internal state for tracking an arrow being drawn by the user.
         */
        this._drawingArrow = null;
        this.root = root;
        const initialTheme = options.theme ?? 'classic';
        this.theme = resolveTheme(initialTheme);
        this.orientation = options.orientation || 'white';
        this.interactive = options.interactive !== false;
        this.showCoords = options.showCoordinates || false;
        this.highlightLegal = options.highlightLegal !== false;
        this.animationMs = options.animationMs || 300;
        // New features options
        this.allowPremoves = options.allowPremoves !== false;
        this.showArrows = options.showArrows !== false;
        this.showHighlights = options.showHighlights !== false;
        this.rightClickHighlights = options.rightClickHighlights !== false;
        this.soundEnabled = options.soundEnabled !== false;
        this.showSquareNames = options.showSquareNames || false;
        this.autoFlip = options.autoFlip ?? false;
        this.soundUrl = options.soundUrl;
        this.soundUrls = options.soundUrls;
        // Initialize sound
        this._initializeSound();
        // Initialize rules adapter - Use ChessJsRules by default for robust validation
        this.rules = options.rulesAdapter || new ChessJsRules();
        if (options.fen) {
            this.rules.setFEN(options.fen);
        }
        this.state = parseFEN(this.rules.getFEN());
        this._syncOrientationFromTurn(true);
        // Build DOM and setup
        this._buildDOM();
        this._attachEvents();
        this.resize();
        if (options.pieceSet) {
            void this.setPieceSet(options.pieceSet);
        }
    }
    // Public API methods
    /**
     * Gets the current position of the board in FEN format.
     * @returns The current FEN string.
     */
    getPosition() {
        return this.rules.getFEN();
    }
    /**
     * Sets the position of the board using a FEN string.
     * @param fen The FEN string to set the board to.
     * @param immediate If true, the board will update immediately without animation.
     */
    setPosition(fen, immediate = false) {
        this.setFEN(fen, immediate);
    }
    /**
     * Registers an event handler for a specific board event.
     * @param event The name of the event to listen for.
     * @param handler The callback function to execute when the event is emitted.
     * @returns A function to unsubscribe the event handler.
     */
    on(event, handler) {
        return this.bus.on(event, handler);
    }
    /**
     * Destroys the board instance, removing all event listeners and clearing the DOM.
     */
    destroy() {
        this._removeEvents();
        this.root.innerHTML = '';
    }
    /**
     * Sets the visual theme of the board.
     * @param theme Theme name or object to apply.
     */
    setTheme(theme) {
        this.applyTheme(theme);
    }
    /**
     * Applies a theme object directly, normalizing it and re-rendering the board.
     * @param theme Theme name or object to apply.
     */
    applyTheme(theme) {
        this.theme = resolveTheme(theme);
        this._rasterize();
        this.renderAll();
    }
    /**
     * Applies a custom piece set, allowing users to provide their own sprites.
     * Passing `undefined` or an empty configuration reverts to the default flat sprites.
     * @param pieceSet Custom piece configuration to apply.
     */
    async setPieceSet(pieceSet) {
        if (!pieceSet || !pieceSet.pieces || Object.keys(pieceSet.pieces).length === 0) {
            if (!this._pieceSetRaw && Object.keys(this.customPieceSprites).length === 0) {
                return;
            }
            this._pieceSetRaw = undefined;
            this.customPieceSprites = {};
            this._pieceSetToken++;
            this.renderAll();
            return;
        }
        if (pieceSet === this._pieceSetRaw) {
            return;
        }
        this._pieceSetRaw = pieceSet;
        const token = ++this._pieceSetToken;
        const defaultScale = pieceSet.defaultScale ?? 1;
        const resolved = {};
        const entries = Object.entries(pieceSet.pieces);
        await Promise.all(entries.map(async ([pieceKey, sprite]) => {
            if (!sprite)
                return;
            try {
                const resolvedSprite = await this._resolvePieceSprite(sprite, defaultScale);
                if (resolvedSprite) {
                    resolved[pieceKey] = resolvedSprite;
                }
            }
            catch (error) {
                console.warn(`[NeoChessBoard] Failed to load sprite for piece "${pieceKey}".`, error);
            }
        }));
        if (token !== this._pieceSetToken) {
            return;
        }
        this.customPieceSprites = resolved;
        this.renderAll();
    }
    /**
     * Sets the board position using a FEN string.
     * @param fen The FEN string representing the board state.
     * @param immediate If true, the board updates instantly without animation.
     */
    setFEN(fen, immediate = false) {
        const old = this.state;
        const oldTurn = this.state.turn;
        this.rules.setFEN(fen);
        this.state = parseFEN(this.rules.getFEN());
        this._syncOrientationFromTurn(false);
        this._lastMove = null;
        // If the turn has changed (opponent played), try to execute the premove
        const newTurn = this.state.turn;
        if (oldTurn !== newTurn) {
            this._executePremoveIfValid();
        }
        // Clear the old premove system
        this._premove = null;
        if (immediate) {
            this._clearAnim();
            this.renderAll();
        }
        else {
            this._animateTo(this.state, old);
        }
        this.bus.emit('update', { fen: this.getPosition() });
    }
    // ---- DOM & render ----
    _buildDOM() {
        this.root.classList.add('ncb-root');
        this.root.style.position = 'relative';
        this.root.style.userSelect = 'none';
        this.cBoard = document.createElement('canvas');
        this.cPieces = document.createElement('canvas');
        this.cOverlay = document.createElement('canvas');
        for (const c of [this.cBoard, this.cPieces, this.cOverlay]) {
            Object.assign(c.style, {
                position: 'absolute',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                aspectRatio: '606 / 606',
            });
            this.root.appendChild(c);
        }
        this.ctxB = this.cBoard.getContext('2d');
        this.ctxP = this.cPieces.getContext('2d');
        this.ctxO = this.cOverlay.getContext('2d');
        // Initialize the DrawingManager
        this.drawingManager = new DrawingManager(this.cOverlay);
        this.drawingManager.setOrientation(this.orientation);
        this.drawingManager.setShowSquareNames(this.showSquareNames);
        this._rasterize();
        const ro = new ResizeObserver(() => this.resize());
        ro.observe(this.root);
        this._ro = ro;
        // inject tiny styles
        if (typeof document !== 'undefined') {
            const style = document.createElement('style');
            style.textContent = `.ncb-root{display:block;max-width:100%;aspect-ratio:auto 606/606;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.10);} canvas{image-rendering:optimizeQuality;aspect-ratio:auto 606/606;}`;
            document.head.appendChild(style);
        }
    }
    /**
     * Resizes the board canvases based on the root element's dimensions and device pixel ratio.
     * This method is typically called when the board's container changes size.
     */
    resize() {
        const rect = this.root.getBoundingClientRect();
        // Determine the size of the board, defaulting to 480px if no size is available.
        const sz = Math.min(rect.width, rect.height) || 480;
        // Get the device pixel ratio for sharp rendering on high-DPI screens.
        const dpr = globalThis.devicePixelRatio || 1;
        // Set canvas dimensions, scaling by DPR for retina displays.
        for (const c of [this.cBoard, this.cPieces, this.cOverlay]) {
            c.width = Math.round(sz * dpr);
            c.height = Math.round(sz * dpr);
        }
        // Update internal size properties.
        this.sizePx = sz;
        this.square = (sz * dpr) / 8; // Calculate individual square size.
        this.dpr = dpr;
        // Inform the DrawingManager about updated dimensions.
        if (this.drawingManager) {
            this.drawingManager.updateDimensions();
        }
        // Re-render the entire board to apply new dimensions.
        this.renderAll();
    }
    /**
     * Initializes or re-initializes the sprite sheet for pieces based on the current theme.
     * This is called when the theme changes or on initial setup.
     */
    _rasterize() {
        this.sprites = new FlatSprites(128, this.theme);
    }
    /**
     * Renders all layers of the chess board (board, pieces, overlay).
     * This method should be called whenever the board state or visual settings change.
     */
    renderAll() {
        this._drawBoard();
        this._drawPieces();
        this._drawOverlay();
    }
    /**
     * Converts a square (e.g., 'e4') to its pixel coordinates on the canvas.
     * Adjusts for board orientation.
     * @param square The algebraic notation of the square.
     * @returns An object with x and y pixel coordinates.
     */
    _sqToXY(square) {
        const { f, r } = sqToFR(square);
        const ff = this.orientation === 'white' ? f : 7 - f;
        const rr = this.orientation === 'white' ? 7 - r : r;
        return { x: ff * this.square, y: rr * this.square };
    }
    /**
     * Draws the chess board squares onto the board canvas.
     * Uses the current theme's light and dark square colors.
     */
    _drawBoard() {
        const ctx = this.ctxB, s = this.square, W = this.cBoard.width, H = this.cBoard.height;
        const { light, dark, boardBorder } = this.theme;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = boardBorder;
        ctx.fillRect(0, 0, W, H);
        for (let r = 0; r < 8; r++)
            for (let f = 0; f < 8; f++) {
                const x = (this.orientation === 'white' ? f : 7 - f) * s;
                const y = (this.orientation === 'white' ? 7 - r : r) * s;
                ctx.fillStyle = (r + f) % 2 === 0 ? light : dark;
                ctx.fillRect(x, y, s, s);
            }
    }
    async _resolvePieceSprite(sprite, defaultScale) {
        const config = typeof sprite === 'object' && sprite !== null && 'image' in sprite
            ? sprite
            : { image: sprite };
        let source = null;
        if (typeof config.image === 'string') {
            source = await this._loadImage(config.image);
        }
        else if (config.image) {
            source = config.image;
        }
        if (!source) {
            return null;
        }
        return {
            image: source,
            scale: config.scale ?? defaultScale ?? 1,
            offsetX: config.offsetX ?? 0,
            offsetY: config.offsetY ?? 0,
        };
    }
    _loadImage(src) {
        return new Promise((resolve, reject) => {
            const doc = this.root?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
            const img = typeof Image !== 'undefined'
                ? new Image()
                : doc
                    ? doc.createElement('img')
                    : null;
            if (!img) {
                reject(new Error('Image loading is not supported in the current environment.'));
                return;
            }
            if (!src.startsWith('data:')) {
                img.crossOrigin = 'anonymous';
            }
            try {
                img.decoding = 'async';
            }
            catch (e) {
                // Ignore browsers that do not support decoding
            }
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err instanceof Error ? err : new Error(String(err)));
            img.src = src;
        });
    }
    /**
     * Draws a single piece sprite onto the pieces canvas.
     * @param piece The FEN notation of the piece (e.g., 'p', 'K').
     * @param x The x-coordinate for the top-left corner of the piece.
     * @param y The y-coordinate for the top-left corner of the piece.
     * @param scale Optional scale factor for the piece (default is 1).
     */
    _drawPieceSprite(piece, x, y, scale = 1) {
        const custom = this.customPieceSprites[piece];
        if (custom) {
            const spriteScale = scale * (custom.scale ?? 1);
            const size = this.square * spriteScale;
            const dx = x + (this.square - size) / 2 + custom.offsetX * this.square;
            const dy = y + (this.square - size) / 2 + custom.offsetY * this.square;
            this.ctxP.drawImage(custom.image, dx, dy, size, size);
            return;
        }
        // Map piece characters to their index in the sprite sheet.
        const map = { k: 0, q: 1, r: 2, b: 3, n: 4, p: 5 };
        const isW = isWhitePiece(piece);
        const idx = map[piece.toLowerCase()];
        const s128 = 128; // Original sprite size
        const sx = idx * s128; // Source x-coordinate on sprite sheet.
        const sy = isW ? s128 : 0; // Source y-coordinate on sprite sheet (white pieces are on the second row).
        const d = this.square * scale; // Destination size of the piece on the canvas.
        const dx = x + (this.square - d) / 2; // Center the piece horizontally.
        const dy = y + (this.square - d) / 2; // Center the piece vertically.
        this.ctxP.drawImage(this.sprites.getSheet(), sx, sy, s128, s128, dx, dy, d, d);
    }
    /**
     * Draws all pieces onto the pieces canvas, handling dragging pieces separately.
     */
    _drawPieces() {
        const ctx = this.ctxP, W = this.cPieces.width, H = this.cPieces.height;
        ctx.clearRect(0, 0, W, H);
        const draggingSq = this._dragging?.from;
        for (let r = 0; r < 8; r++)
            for (let f = 0; f < 8; f++) {
                const p = this.state.board[r][f];
                if (!p)
                    continue;
                const square = sq(f, r);
                // Don't draw the piece if it's currently being dragged.
                if (draggingSq === square)
                    continue;
                const { x, y } = this._sqToXY(square);
                this._drawPieceSprite(p, x, y, 1);
            }
        // Draw the dragging piece last, slightly larger, to appear on top.
        if (this._dragging) {
            const { piece, x, y } = this._dragging;
            this._drawPieceSprite(piece, x - this.square / 2, y - this.square / 2, 1.05);
        }
    }
    /**
     * Draws the overlay elements such as last move highlights, selected square, legal moves, premoves, and arrows.
     * Delegates to DrawingManager for modern drawing features.
     */
    _drawOverlay() {
        const ctx = this.ctxO, W = this.cOverlay.width, H = this.cOverlay.height;
        ctx.clearRect(0, 0, W, H);
        const s = this.square;
        // Render classic elements (lastMove, selected, etc.)
        if (this._lastMove) {
            const { from, to } = this._lastMove;
            const A = this._sqToXY(from), B = this._sqToXY(to);
            ctx.fillStyle = this.theme.lastMove;
            ctx.fillRect(A.x, A.y, s, s);
            ctx.fillRect(B.x, B.y, s, s);
        }
        if (this._customHighlights?.squares) {
            ctx.fillStyle = this.theme.moveTo;
            for (const sqr of this._customHighlights.squares) {
                const B = this._sqToXY(sqr);
                ctx.fillRect(B.x, B.y, s, s);
            }
        }
        if (this._selected) {
            const A = this._sqToXY(this._selected);
            ctx.fillStyle = this.theme.moveFrom;
            ctx.fillRect(A.x, A.y, s, s);
            if (this.highlightLegal && this._legalCached) {
                ctx.fillStyle = this.theme.dot;
                for (const m of this._legalCached) {
                    const B = this._sqToXY(m.to);
                    ctx.beginPath();
                    ctx.arc(B.x + s / 2, B.y + s / 2, s * 0.12, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        // Render classic arrows (for compatibility)
        for (const a of this._arrows) {
            this._drawArrow(a.from, a.to, a.color || this.theme.arrow);
        }
        if (this._premove) {
            const A = this._sqToXY(this._premove.from), B = this._sqToXY(this._premove.to);
            ctx.fillStyle = this.theme.premove;
            ctx.fillRect(A.x, A.y, s, s);
            ctx.fillRect(B.x, B.y, s, s);
        }
        if (this._hoverSq && this._dragging) {
            const B = this._sqToXY(this._hoverSq);
            ctx.fillStyle = this.theme.moveTo;
            ctx.fillRect(B.x, B.y, s, s);
        }
        // Delegate rendering of new drawings to DrawingManager
        if (this.drawingManager) {
            if (this.showArrows) {
                this.drawingManager.renderArrows();
            }
            if (this.showHighlights) {
                this.drawingManager.renderHighlights();
            }
            if (this.allowPremoves) {
                this.drawingManager.renderPremove();
            }
            if (this.showSquareNames) {
                this.drawingManager.renderSquareNames(this.orientation, this.square, this.dpr);
            }
        }
    }
    /**
     * Draws an arrow between the center of two squares.
     * @param from The starting square of the arrow.
     * @param to The ending square of the arrow.
     * @param color The color of the arrow.
     */
    _drawArrow(from, to, color) {
        const s = this.square;
        const A = this._sqToXY(from), B = this._sqToXY(to);
        this._drawArrowBetween(A.x + s / 2, A.y + s / 2, B.x + s / 2, B.y + s / 2, color);
    }
    /**
     * Draws an arrow between two pixel coordinates on the overlay canvas.
     * This is a helper for `_drawArrow`.
     * @param fromX Starting x-coordinate.
     * @param fromY Starting y-coordinate.
     * @param toX Ending x-coordinate.
     * @param toY Ending y-coordinate.
     * @param color The color of the arrow.
     */
    _drawArrowBetween(fromX, fromY, toX, toY, color) {
        const dx = toX - fromX, dy = toY - fromY;
        const len = Math.hypot(dx, dy);
        if (len < 1)
            return;
        const ux = dx / len, uy = dy / len;
        const head = Math.min(16 * this.dpr, len * 0.25); // Arrowhead size, capped at 16px or 25% of arrow length.
        const thick = Math.max(6 * this.dpr, this.square * 0.08); // Arrow thickness, capped at 6px or 8% of square size.
        const ctx = this.ctxO;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX - ux * head, toY - uy * head);
        ctx.lineWidth = thick;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - ux * head - uy * head * 0.5, toY - uy * head + ux * head * 0.5);
        ctx.lineTo(toX - ux * head + uy * head * 0.5, toY - uy * head - ux * head * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    _setSelection(square, piece) {
        const side = isWhitePiece(piece) ? 'w' : 'b';
        this._selected = square;
        if (side === this.state.turn) {
            this._legalCached = this.rules.movesFrom(square);
        }
        else if (this.allowPremoves) {
            this._legalCached = [];
        }
        else {
            this._legalCached = null;
        }
    }
    _handleClickMove(target) {
        const from = this._selected;
        if (!from || from === target) {
            if (from === target) {
                this.renderAll();
            }
            return;
        }
        const piece = this._pieceAt(from);
        if (!piece) {
            this._selected = null;
            this._legalCached = null;
            this.renderAll();
            return;
        }
        const targetPiece = this._pieceAt(target);
        if (targetPiece && isWhitePiece(targetPiece) === isWhitePiece(piece)) {
            this._setSelection(target, targetPiece);
            this.renderAll();
            return;
        }
        this._attemptMove(from, target, piece);
    }
    _attemptMove(from, to, piece) {
        const side = isWhitePiece(piece) ? 'w' : 'b';
        if (from === to) {
            this.renderAll();
            return true;
        }
        if (side !== this.state.turn) {
            if (!this.allowPremoves) {
                return false;
            }
            if (this.drawingManager) {
                this.drawingManager.setPremove(from, to);
            }
            this._premove = { from, to };
            this._selected = null;
            this._legalCached = null;
            this._hoverSq = null;
            this.renderAll();
            return true;
        }
        const legal = this.rules.move({ from, to });
        if (legal && legal.ok) {
            const fen = this.rules.getFEN();
            const old = this.state;
            const next = parseFEN(fen);
            this.state = next;
            this._syncOrientationFromTurn(false);
            this._selected = null;
            this._legalCached = null;
            this._hoverSq = null;
            this._lastMove = { from, to };
            if (this.drawingManager) {
                this.drawingManager.clearArrows();
            }
            this._playMoveSound();
            this._animateTo(next, old);
            this.bus.emit('move', { from, to, fen });
            setTimeout(() => {
                this._executePremoveIfValid();
            }, this.animationMs + 50);
            return true;
        }
        this._selected = null;
        this._legalCached = null;
        this._hoverSq = null;
        this.renderAll();
        this.bus.emit('illegal', { from, to, reason: legal?.reason || 'illegal' });
        return true;
    }
    // ---- interaction ----
    _attachEvents() {
        let cancelledDragWithRightClick = false;
        const cancelActiveDrag = () => {
            if (!this._dragging)
                return false;
            this._dragging = null;
            this._selected = null;
            this._legalCached = null;
            this._hoverSq = null;
            this.renderAll();
            return true;
        };
        const onDown = (e) => {
            if (!this.interactive) {
                if (e.button === 2) {
                    e.preventDefault();
                    if (cancelActiveDrag()) {
                        cancelledDragWithRightClick = true;
                    }
                }
                return;
            }
            // Handle right-click for arrows (drag & drop)
            if (e.button === 2) {
                e.preventDefault();
                if (cancelActiveDrag()) {
                    cancelledDragWithRightClick = true;
                    return;
                }
                cancelledDragWithRightClick = false;
                const pt = this._evt(e);
                if (pt &&
                    this.drawingManager &&
                    this.drawingManager.handleRightMouseDown(pt.x, pt.y, e.shiftKey, e.ctrlKey, e.altKey)) {
                    this.renderAll();
                }
                return;
            }
            if (e.button !== 0)
                return;
            const pt = this._evt(e);
            if (!pt)
                return;
            const from = this._xyToSquare(pt.x, pt.y);
            const piece = this._pieceAt(from);
            if (!piece)
                return;
            const side = isWhitePiece(piece) ? 'w' : 'b';
            if (side !== this.state.turn && !this.allowPremoves) {
                return;
            }
            this._setSelection(from, piece);
            this._dragging = { from, piece, x: pt.x, y: pt.y };
            this._hoverSq = from;
            this.renderAll();
        };
        const onMove = (e) => {
            const pt = this._evt(e);
            if (!pt) {
                if (this.interactive) {
                    this.cOverlay.style.cursor = 'default';
                }
                return;
            }
            // Delegate to DrawingManager
            if (this.drawingManager && this.drawingManager.handleMouseMove(pt.x, pt.y)) {
                this.renderAll();
            }
            if (this._dragging) {
                this._dragging.x = pt.x;
                this._dragging.y = pt.y;
                this._hoverSq = this._xyToSquare(pt.x, pt.y);
                this._drawPieces();
                this._drawOverlay();
            }
            else if (this.interactive) {
                const sq = this._xyToSquare(pt.x, pt.y);
                const piece = this._pieceAt(sq);
                this.cOverlay.style.cursor = piece ? 'pointer' : 'default';
            }
        };
        const onUp = (e) => {
            if (e.button === 2) {
                if (cancelActiveDrag()) {
                    cancelledDragWithRightClick = false;
                    return;
                }
                if (cancelledDragWithRightClick) {
                    cancelledDragWithRightClick = false;
                    return;
                }
            }
            const pt = this._evt(e);
            // Handle right-click release for arrows
            if (e.button === 2) {
                let handled = false;
                if (this.drawingManager && pt) {
                    handled = this.drawingManager.handleRightMouseUp(pt.x, pt.y);
                }
                // If no arrow was created and it was just a simple click
                if (!handled && pt) {
                    // Check if there's an active premove and cancel it
                    if (this.drawingManager && this.drawingManager.getPremove()) {
                        this.drawingManager.clearPremove();
                        this._premove = null; // Compatibility
                        console.log('Premove cancelled by right-click');
                        handled = true;
                    }
                    // Otherwise, handle highlights with modifiers
                    else if (this.rightClickHighlights) {
                        const square = this._xyToSquare(pt.x, pt.y);
                        if (this.drawingManager) {
                            this.drawingManager.handleHighlightClick(square, e.shiftKey, e.ctrlKey, e.altKey);
                        }
                    }
                }
                this.renderAll();
                return;
            }
            // Delegate to DrawingManager for other interactions
            if (this.drawingManager && this.drawingManager.handleMouseUp(pt?.x || 0, pt?.y || 0)) {
                this.renderAll();
                return;
            }
            if (!this._dragging) {
                if (this.interactive && e.button === 0 && pt) {
                    const square = this._xyToSquare(pt.x, pt.y);
                    this._handleClickMove(square);
                }
                return;
            }
            const drop = pt ? this._xyToSquare(pt.x, pt.y) : null;
            const from = this._dragging.from;
            const piece = this._dragging.piece;
            this._dragging = null;
            this._hoverSq = null;
            if (!drop) {
                this._selected = null;
                this._legalCached = null;
                this.renderAll();
                return;
            }
            if (drop === from) {
                this.renderAll();
                return;
            }
            this._attemptMove(from, drop, piece);
        };
        // Keyboard event handler
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                // Clear all selections and temporary drawings
                this._selected = null;
                this._legalCached = null;
                this._dragging = null;
                this._hoverSq = null;
                if (this.drawingManager) {
                    this.drawingManager.cancelCurrentAction();
                }
                this.renderAll();
            }
        };
        // Context menu handler (disable right-click)
        const onContextMenu = (e) => {
            if (this.rightClickHighlights) {
                e.preventDefault();
            }
        };
        this.cOverlay.addEventListener('pointerdown', onDown);
        this.cOverlay.addEventListener('contextmenu', onContextMenu);
        this._onPointerDown = onDown;
        this._onContextMenu = onContextMenu;
        globalThis.addEventListener('pointermove', onMove);
        this._onPointerMove = onMove;
        globalThis.addEventListener('pointerup', onUp);
        this._onPointerUp = onUp;
        globalThis.addEventListener('keydown', onKeyDown);
        this._onKeyDown = onKeyDown;
    }
    _removeEvents() {
        this.cOverlay.removeEventListener('pointerdown', this._onPointerDown);
        this.cOverlay.removeEventListener('contextmenu', this._onContextMenu);
        globalThis.removeEventListener('pointermove', this._onPointerMove);
        globalThis.removeEventListener('pointerup', this._onPointerUp);
        globalThis.removeEventListener('keydown', this._onKeyDown);
        this._ro?.disconnect();
    }
    _evt(e) {
        const rect = this.cOverlay.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.cOverlay.width / rect.width);
        const y = (e.clientY - rect.top) * (this.cOverlay.height / rect.height);
        if (x < 0 || y < 0 || x > this.cOverlay.width || y > this.cOverlay.height)
            return null;
        return { x, y };
    }
    _xyToSquare(x, y) {
        const f = clamp(Math.floor(x / this.square), 0, 7);
        const r = clamp(Math.floor(y / this.square), 0, 7);
        const ff = this.orientation === 'white' ? f : 7 - f;
        const rr = this.orientation === 'white' ? 7 - r : r;
        return sq(ff, rr);
    }
    _pieceAt(square) {
        const { f, r } = sqToFR(square);
        return this.state.board[r][f];
    }
    // ---- animation ----
    /**
     * Clears any ongoing animation frame request.
     */
    _clearAnim() {
        cancelAnimationFrame(this._raf);
        this._raf = 0;
    }
    /**
     * Animates piece movements from a starting board state to a target board state.
     * @param target The target BoardState after the move.
     * @param start The starting BoardState before the move.
     */
    _animateTo(target, start) {
        this._clearAnim();
        const startTime = performance.now();
        const dur = this.animationMs;
        const moving = new Map();
        // Identify pieces that have moved.
        for (let r = 0; r < 8; r++)
            for (let f = 0; f < 8; f++) {
                const a = start.board[r][f]; // Piece at (r,f) in start state.
                const b = target.board[r][f]; // Piece at (r,f) in target state.
                // If there was a piece in the start state and it's either gone or changed in the target state,
                // it means this piece has moved. Find its destination.
                if (a && (!b || a !== b)) {
                    const to = this.findPiece(target.board, a, r, f, start.board);
                    if (to)
                        moving.set(sq(f, r), sq(to.f, to.r));
                }
            }
        const tick = () => {
            // Calculate animation progress (t) and eased progress (e).
            const t = clamp((performance.now() - startTime) / dur, 0, 1);
            const e = easeOutCubic(t);
            const ctx = this.ctxP;
            ctx.clearRect(0, 0, this.cPieces.width, this.cPieces.height);
            for (let r = 0; r < 8; r++)
                for (let f = 0; f < 8; f++) {
                    const targetPiece = target.board[r][f];
                    if (!targetPiece)
                        continue;
                    const toSq = sq(f, r);
                    // Find if this piece is one of the moving pieces.
                    const fromKey = [...moving.entries()].find(([from, to]) => to === toSq)?.[0];
                    if (fromKey) {
                        // If it's a moving piece, interpolate its position.
                        const { x: fx, y: fy } = this._sqToXY(fromKey);
                        const { x: tx, y: ty } = this._sqToXY(toSq);
                        const x = lerp(fx, tx, e), y = lerp(fy, ty, e);
                        this._drawPieceSprite(targetPiece, x, y, 1);
                    }
                    else {
                        // If it's a stationary piece, draw it at its final position.
                        const { x, y } = this._sqToXY(toSq);
                        this._drawPieceSprite(targetPiece, x, y, 1);
                    }
                }
            this._drawOverlay();
            // Continue animation if not finished.
            if (t < 1)
                this._raf = requestAnimationFrame(tick);
            else {
                this._raf = 0;
                this.renderAll(); // Final render to ensure perfect state.
            }
        };
        this._raf = requestAnimationFrame(tick);
    }
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
    findPiece(board, piece, r0, f0, start) {
        for (let r = 0; r < 8; r++)
            for (let f = 0; f < 8; f++) {
                // Check if the piece exists in the target board at (r,f) and was not there in the start board at (r,f)
                // This helps identify where a piece *moved to* rather than just where it *is*.
                if (board[r][f] === piece && start[r][f] !== piece)
                    return { r, f };
            }
        return null;
    }
    // ---- Drawing methods ----
    /**
     * This method appears to be a remnant or is currently unused.
     * It attempts to draw the board and pieces using the DrawingManager.
     * @deprecated This method might be removed or refactored in future versions.
     */
    _draw() {
        if (!this.drawingManager)
            return;
        // Get the canvas context
        const ctx = this.ctxP || this.cPieces.getContext('2d');
        if (!ctx)
            return;
        // Clear the canvas
        ctx.clearRect(0, 0, this.cPieces.width, this.cPieces.height);
        // Draw the board and pieces using the drawing manager
        this.drawingManager.draw(ctx);
        // Draw any additional elements like arrows and highlights
        if ('renderArrows' in this.drawingManager) {
            this.drawingManager.renderArrows();
        }
        if ('renderHighlights' in this.drawingManager) {
            this.drawingManager.renderHighlights();
        }
    }
    // ---- Sound methods ----
    /**
     * Initializes the audio element for move sounds if sound is enabled and a sound URL is provided.
     * Handles potential loading errors silently.
     */
    _initializeSound() {
        this.moveSound = null;
        this.moveSounds = {};
        if (!this.soundEnabled || typeof Audio === 'undefined')
            return;
        const defaultUrl = this.soundUrl;
        const whiteUrl = this.soundUrls?.white;
        const blackUrl = this.soundUrls?.black;
        if (!defaultUrl && !whiteUrl && !blackUrl) {
            return;
        }
        const createAudio = (url) => {
            try {
                const audio = new Audio(url);
                audio.volume = 0.3; // Moderate volume
                audio.preload = 'auto';
                audio.addEventListener('error', () => {
                    console.debug('Sound not available');
                });
                return audio;
            }
            catch (error) {
                console.warn('Unable to load move sound:', error);
                return null;
            }
        };
        if (whiteUrl) {
            const audio = createAudio(whiteUrl);
            if (audio) {
                this.moveSounds.white = audio;
            }
        }
        if (blackUrl) {
            const audio = createAudio(blackUrl);
            if (audio) {
                this.moveSounds.black = audio;
            }
        }
        if (defaultUrl) {
            const audio = createAudio(defaultUrl);
            if (audio) {
                this.moveSound = audio;
            }
        }
    }
    /**
     * Plays the move sound if sound is enabled and the audio element is initialized.
     * Catches and ignores playback errors (e.g., due to user interaction policies).
     */
    _playMoveSound() {
        if (!this.soundEnabled)
            return;
        const movedColor = this.state.turn === 'w' ? 'black' : 'white';
        const sound = this.moveSounds[movedColor] ?? this.moveSound;
        if (!sound)
            return;
        try {
            // Reset sound to beginning and play
            sound.currentTime = 0;
            sound.play().catch((error) => {
                // Ignore playback errors (e.g., user hasn't interacted with page yet)
                console.debug('Sound not played:', error.message);
            });
        }
        catch (error) {
            console.debug('Error playing sound:', error);
        }
    }
    /**
     * Synchronizes the board orientation with the side to move when auto-flip is enabled.
     * @param initial When true, only the internal orientation state is updated without rendering.
     */
    _syncOrientationFromTurn(initial = false) {
        if (!this.autoFlip) {
            return;
        }
        const desired = this.state.turn === 'w' ? 'white' : 'black';
        if (initial || !this.drawingManager) {
            this.orientation = desired;
            if (this.drawingManager && !initial) {
                this.drawingManager.setOrientation(desired);
            }
            return;
        }
        if (this.orientation !== desired) {
            this.setOrientation(desired);
        }
    }
    /**
     * Enables or disables sound effects for moves.
     * If enabling and sound is not yet initialized, it will attempt to initialize it.
     * @param enabled True to enable sounds, false to disable.
     */
    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
        if (enabled) {
            this._initializeSound();
        }
        else {
            this.moveSound = null;
            this.moveSounds = {};
        }
    }
    /**
     * Updates the URLs used for move sounds and reinitializes audio elements if needed.
     * @param soundUrls Move sound URLs keyed by the color that just played.
     */
    setSoundUrls(soundUrls) {
        this.soundUrls = soundUrls;
        if (this.soundEnabled) {
            this._initializeSound();
        }
        else {
            this.moveSound = null;
            this.moveSounds = {};
        }
    }
    /**
     * Enables or disables automatic board flipping based on the side to move.
     * @param autoFlip True to enable auto-flip, false to disable it.
     */
    setAutoFlip(autoFlip) {
        this.autoFlip = autoFlip;
        if (autoFlip) {
            this._syncOrientationFromTurn(!this.drawingManager);
        }
    }
    /**
     * Sets the board orientation.
     * @param orientation The desired orientation ('white' or 'black').
     */
    setOrientation(orientation) {
        this.orientation = orientation;
        if (this.drawingManager) {
            this.drawingManager.setOrientation(orientation);
        }
        this.renderAll();
    }
    /**
     * Shows or hides arrows drawn on the board.
     * @param show True to show arrows, false to hide them.
     */
    setShowArrows(show) {
        this.showArrows = show;
        this.renderAll();
    }
    /**
     * Shows or hides highlights on the board.
     * @param show True to show highlights, false to hide them.
     */
    setShowHighlights(show) {
        this.showHighlights = show;
        this.renderAll();
    }
    /**
     * Enables or disables premoves.
     * If premoves are disabled, any existing premove will be cleared.
     * @param allow True to allow premoves, false to disallow.
     */
    setAllowPremoves(allow) {
        this.allowPremoves = allow;
        if (!allow) {
            this.clearPremove();
        }
        this.renderAll();
    }
    /**
     * Enables or disables highlighting of legal moves for the selected piece.
     * @param highlight True to highlight legal moves, false to disable.
     */
    setHighlightLegal(highlight) {
        this.highlightLegal = highlight;
        this.renderAll();
    }
    /**
     * Shows or hides square names (coordinates) on the board.
     * @param show True to show square names, false to hide them.
     */
    setShowSquareNames(show) {
        this.showSquareNames = show;
        if (this.drawingManager) {
            this.drawingManager.setShowSquareNames(show);
        }
        this.renderAll();
    }
    // ---- Private methods for premove execution ----
    /**
     * Attempts to execute a stored premove if it is valid in the current board position.
     * This method is typically called after an opponent's move has been processed.
     * If the premove is legal, it is executed after a short delay to allow for animation.
     * If illegal, the premove is silently cleared.
     */
    _executePremoveIfValid() {
        if (!this.allowPremoves || !this.drawingManager)
            return;
        const premove = this.drawingManager.getPremove();
        if (!premove)
            return;
        // Check if the premove is legal in the new position
        const premoveResult = this.rules.move({
            from: premove.from,
            to: premove.to,
            promotion: premove.promotion,
        });
        if (premoveResult && premoveResult.ok) {
            // The premove is legal, execute it after a short delay
            setTimeout(() => {
                const newFen = this.rules.getFEN();
                const newState = parseFEN(newFen);
                const oldState = this.state;
                this.state = newState;
                this._syncOrientationFromTurn(false);
                this._lastMove = { from: premove.from, to: premove.to };
                // Clear the premove and all arrows
                this.drawingManager?.clearPremove();
                this.drawingManager?.clearArrows();
                this._premove = null; // Compatibility with old premove system
                // Animate the premove
                this._animateTo(newState, oldState);
                // Emit the move event
                this.bus.emit('move', { from: premove.from, to: premove.to, fen: newFen });
            }, 150); // Slightly longer delay to let the opponent's move animation complete
        }
        else {
            // The premove is not legal, clear it silently
            this.drawingManager.clearPremove();
            this._premove = null; // Compatibility with old premove system
            this.renderAll();
        }
    }
    // ---- New feature methods ----
    /**
     * Add an arrow on the board
     * @param arrow The arrow to add (can be an object with from/to or an Arrow object)
     */
    addArrow(arrow) {
        if (!this.drawingManager)
            return;
        // Handle both simple arrow objects and full Arrow type
        if ('from' in arrow && 'to' in arrow) {
            if ('knightMove' in arrow) {
                // It's a full Arrow object
                this.drawingManager.addArrowFromObject(arrow);
            }
            else {
                // It's a simple arrow object
                this.drawingManager.addArrow(arrow);
            }
            this.renderAll();
        }
    }
    /**
     * Remove an arrow from the board
     */
    removeArrow(from, to) {
        if (this.drawingManager) {
            this.drawingManager.removeArrow(from, to);
            this.renderAll();
        }
    }
    /**
     * Clear all arrows
     */
    clearArrows() {
        if (this.drawingManager) {
            this.drawingManager.clearArrows();
            this.renderAll();
        }
    }
    /**
     * Add a highlight to a square
     * @param square The square to highlight (e.g., 'e4')
     * @param type The type of highlight (e.g., 'selected', 'lastMove', 'check')
     */
    addHighlight(square, type) {
        if (!this.drawingManager)
            return;
        if (typeof square === 'string' && type) {
            // Handle addHighlight(square, type) signature
            this.drawingManager.addHighlight(square, type);
            this.renderAll();
        }
        else if (typeof square === 'object' && 'square' in square) {
            // Handle addHighlight(SquareHighlight) signature
            this.drawingManager.addHighlightFromObject(square);
            this.renderAll();
        }
    }
    /**
     * Remove a highlight from a square
     */
    removeHighlight(square) {
        if (this.drawingManager) {
            this.drawingManager.removeHighlight(square);
            this.renderAll();
        }
    }
    /**
     * Clear all highlights
     */
    clearHighlights() {
        if (this.drawingManager) {
            this.drawingManager.clearHighlights();
            this.renderAll();
        }
    }
    /**
     * Set a premove
     */
    setPremove(premove) {
        if (this.drawingManager && this.allowPremoves) {
            this.drawingManager.setPremoveFromObject(premove);
            this.renderAll();
        }
    }
    /**
     * Clear the current premove
     */
    clearPremove() {
        if (this.drawingManager) {
            this.drawingManager.clearPremove();
            this.renderAll();
        }
    }
    /**
     * Get the current premove
     */
    getPremove() {
        return this.drawingManager ? this.drawingManager.getPremove() || null : null;
    }
    /**
     * Clear all drawings (arrows, highlights, premoves)
     */
    clearAllDrawings() {
        if (this.drawingManager) {
            this.drawingManager.clearAll();
            this.renderAll();
        }
    }
    /**
     * Export the drawings state
     */
    exportDrawings() {
        return this.drawingManager ? this.drawingManager.exportState() : null;
    }
    /**
     * Import the drawings state
     */
    importDrawings(state) {
        if (this.drawingManager) {
            this.drawingManager.importState(state);
            this.renderAll();
        }
    }
    /**
     * Load a PGN with visual annotations
     */
    loadPgnWithAnnotations(pgnString) {
        try {
            // First load the PGN normally in the rules
            const success = this.rules.loadPgn ? this.rules.loadPgn(pgnString) : false;
            if (success) {
                // Then extract and display the visual annotations
                const pgnNotation = this.rules.getPgnNotation
                    ? this.rules.getPgnNotation()
                    : null;
                if (pgnNotation) {
                    pgnNotation.loadPgnWithAnnotations(pgnString);
                    this.displayAnnotationsFromPgn(pgnNotation);
                }
                // Update the board state
                this.state = parseFEN(this.rules.getFEN());
                this._syncOrientationFromTurn(false);
                this.renderAll();
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Error loading PGN with annotations:', error);
            return false;
        }
    }
    /**
     * Display annotations from the last move played
     */
    displayAnnotationsFromPgn(pgnNotation) {
        if (!this.drawingManager)
            return;
        // Clear previous annotations
        this.drawingManager.clearArrows();
        this.drawingManager.clearHighlights();
        // Get the last move played
        const moves = pgnNotation.getMovesWithAnnotations();
        if (moves.length === 0)
            return;
        const lastMove = moves[moves.length - 1];
        const moveCount = (lastMove.white ? 1 : 0) + (lastMove.black ? 1 : 0);
        const totalMoves = moves.reduce((acc, move) => acc + (move.white ? 1 : 0) + (move.black ? 1 : 0), 0);
        // Determine which annotations to display (from the last move played)
        let annotationsToShow = null;
        if (totalMoves % 2 === 0 && lastMove.blackAnnotations) {
            // The last move was black
            annotationsToShow = lastMove.blackAnnotations;
        }
        else if (totalMoves % 2 === 1 && lastMove.whiteAnnotations) {
            // The last move was white
            annotationsToShow = lastMove.whiteAnnotations;
        }
        if (annotationsToShow) {
            // Display arrows
            if (annotationsToShow.arrows) {
                for (const arrow of annotationsToShow.arrows) {
                    this.drawingManager.addArrowFromObject(arrow);
                }
            }
            // Display circles
            if (annotationsToShow.circles) {
                for (const circle of annotationsToShow.circles) {
                    this.drawingManager.addHighlightFromObject(circle);
                }
            }
        }
    }
    /**
     * Add visual annotations to the current move and save them in the PGN
     */
    addAnnotationsToCurrentMove(arrows = [], circles = [], comment = '') {
        if (!this.drawingManager)
            return;
        // Get the PGN notation if available
        const pgnNotation = this.rules.getPgnNotation
            ? this.rules.getPgnNotation()
            : null;
        if (pgnNotation) {
            // Determine the move number and color
            const moveHistory = this.rules.history ? this.rules.history() : [];
            const moveCount = moveHistory.length;
            const moveNumber = Math.floor(moveCount / 2) + 1;
            const isWhite = moveCount % 2 === 0;
            // Add annotations to the PGN
            pgnNotation.addMoveAnnotations(moveNumber, isWhite, {
                arrows,
                circles,
                textComment: comment,
            });
        }
        // Display annotations immediately on the board
        for (const arrow of arrows) {
            this.drawingManager.addArrowFromObject(arrow);
        }
        for (const circle of circles) {
            this.drawingManager.addHighlightFromObject(circle);
        }
        this.renderAll();
    }
    /**
     * Export the PGN with all visual annotations
     */
    exportPgnWithAnnotations() {
        const pgnNotation = this.rules.getPgnNotation
            ? this.rules.getPgnNotation()
            : null;
        if (pgnNotation && typeof pgnNotation.toPgnWithAnnotations === 'function') {
            return pgnNotation.toPgnWithAnnotations();
        }
        // Fallback to standard PGN
        return this.rules.toPgn ? this.rules.toPgn() : '';
    }
}
