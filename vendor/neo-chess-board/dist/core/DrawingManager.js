import { FILES, RANKS } from './utils';
const DEFAULT_ARROW_STYLE = {
    color: 'rgba(34, 197, 94, 0.6)',
    width: 2,
    opacity: 0.8,
};
const ARROW_COLOR_BY_MODIFIER = {
    default: '#ffeb3b',
    shiftKey: '#22c55e',
    ctrlKey: '#ef4444',
    altKey: '#f59e0b',
};
const MODIFIER_PRIORITY = ['shiftKey', 'ctrlKey', 'altKey'];
const HIGHLIGHT_COLORS = {
    green: 'rgba(34, 197, 94, 0.6)',
    red: 'rgba(239, 68, 68, 0.6)',
    blue: 'rgba(59, 130, 246, 0.6)',
    yellow: 'rgba(245, 158, 11, 0.6)',
    orange: 'rgba(249, 115, 22, 0.6)',
    purple: 'rgba(168, 85, 247, 0.6)',
};
const HIGHLIGHT_SEQUENCE = [
    'green',
    'red',
    'blue',
    'yellow',
    'orange',
    'purple',
];
const HIGHLIGHT_TYPE_BY_MODIFIER = {
    shiftKey: 'green',
    ctrlKey: 'red',
    altKey: 'yellow',
};
const DEFAULT_HIGHLIGHT_OPACITY = 0.3;
const SPECIAL_HIGHLIGHT_OPACITY = {
    selected: 0.5,
    lastMove: 0.6,
};
const DEFAULT_CIRCLE_COLOR = 'rgba(255, 255, 0, 0.5)';
export class DrawingManager {
    constructor(canvas) {
        this.state = {
            arrows: [],
            highlights: [],
            premove: undefined,
        };
        this.squareSize = 60;
        this.orientation = 'white';
        this.showSquareNames = false;
        /**
         * Tracks the current user interaction state
         */
        this.currentAction = { type: 'none' };
        // Alias for clearAllDrawings for backward compatibility
        this.clearAll = this.clearAllDrawings;
        this.canvas = canvas;
        this.updateDimensions();
    }
    updateDimensions() {
        // Use the real canvas size in pixels, not the DOM size
        const boardSize = Math.min(this.canvas.width, this.canvas.height);
        this.squareSize = boardSize / 8;
    }
    setOrientation(orientation) {
        this.orientation = orientation;
    }
    setShowSquareNames(show) {
        this.showSquareNames = show;
    }
    // Arrow management
    addArrow(fromOrArrow, to, color = DEFAULT_ARROW_STYLE.color, width = DEFAULT_ARROW_STYLE.width, opacity = DEFAULT_ARROW_STYLE.opacity) {
        const arrow = typeof fromOrArrow === 'object'
            ? this.normalizeArrow(fromOrArrow)
            : this.normalizeArrow({
                from: fromOrArrow,
                to: to,
                color,
                width,
                opacity,
            });
        const existingIndex = this.findArrowIndex(arrow.from, arrow.to);
        if (existingIndex >= 0) {
            this.state.arrows[existingIndex] = {
                ...this.state.arrows[existingIndex],
                ...arrow,
            };
            return;
        }
        this.state.arrows.push(arrow);
    }
    normalizeArrow(arrow) {
        const color = arrow.color ?? DEFAULT_ARROW_STYLE.color;
        const width = arrow.width ?? DEFAULT_ARROW_STYLE.width;
        const opacity = arrow.opacity ?? DEFAULT_ARROW_STYLE.opacity;
        const knightMove = arrow.knightMove ?? this.isKnightMove(arrow.from, arrow.to);
        return {
            from: arrow.from,
            to: arrow.to,
            color,
            width,
            opacity,
            knightMove,
        };
    }
    findArrowIndex(from, to) {
        return this.state.arrows.findIndex((candidate) => candidate.from === from && candidate.to === to);
    }
    removeArrow(from, to) {
        const index = this.findArrowIndex(from, to);
        if (index >= 0) {
            this.state.arrows.splice(index, 1);
        }
    }
    clearArrows() {
        this.state.arrows = [];
    }
    getArrows() {
        return this.state.arrows.map((arrow) => ({ ...arrow }));
    }
    // Highlight management
    addHighlight(square, type = 'green', opacity) {
        const calculatedOpacity = opacity ?? this.getDefaultHighlightOpacity(type);
        const existingIndex = this.findHighlightIndex(square);
        if (existingIndex >= 0) {
            // Update existing highlight
            this.state.highlights[existingIndex] = {
                ...this.state.highlights[existingIndex],
                type: type,
                opacity: calculatedOpacity,
            };
            return;
        }
        // Add new highlight
        this.state.highlights.push({
            square,
            type: type,
            opacity: calculatedOpacity,
        });
    }
    getDefaultHighlightOpacity(type) {
        return SPECIAL_HIGHLIGHT_OPACITY[type] ?? DEFAULT_HIGHLIGHT_OPACITY;
    }
    findHighlightIndex(square) {
        return this.state.highlights.findIndex((highlight) => highlight.square === square);
    }
    removeHighlight(square) {
        const index = this.findHighlightIndex(square);
        if (index >= 0) {
            this.state.highlights.splice(index, 1);
        }
    }
    clearHighlights() {
        this.state.highlights = [];
    }
    /**
     * Get the pixel coordinates of the top-left corner of a square
     * @param square The square in algebraic notation (e.g., 'a1', 'h8')
     * @returns An object with x and y coordinates
     */
    getSquareCoordinates(square) {
        const file = square[0].toLowerCase();
        const rank = parseInt(square[1], 10);
        let fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
        let rankIndex = 8 - rank;
        // Adjust for board orientation
        if (this.orientation === 'black') {
            fileIndex = 7 - fileIndex;
            rankIndex = 7 - rankIndex;
        }
        return {
            x: fileIndex * this.squareSize,
            y: rankIndex * this.squareSize,
        };
    }
    /**
     * Get the size of a square in pixels
     */
    getSquareSize() {
        return this.squareSize;
    }
    /**
     * Get the center point of a square in pixels
     */
    getSquareCenter(square) {
        const { x, y } = this.getSquareCoordinates(square);
        const halfSize = this.squareSize / 2;
        return {
            x: x + halfSize,
            y: y + halfSize,
        };
    }
    getHighlights() {
        return this.state.highlights.map((highlight) => ({ ...highlight }));
    }
    // Premove management
    setPremove(from, to, promotion) {
        this.state.premove = { from, to, promotion };
    }
    clearPremove() {
        this.state.premove = undefined;
    }
    getPremove() {
        return this.state.premove;
    }
    // Coordinate utilities
    squareToCoords(square) {
        const file = square.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
        const rank = parseInt(square[1]) - 1; // '1' = 0, '2' = 1, etc.
        if (this.orientation === 'white') {
            return [file * this.squareSize, (7 - rank) * this.squareSize];
        }
        else {
            return [(7 - file) * this.squareSize, rank * this.squareSize];
        }
    }
    coordsToSquare(x, y) {
        const file = Math.floor(x / this.squareSize);
        const rank = Math.floor(y / this.squareSize);
        let actualFile;
        let actualRank;
        if (this.orientation === 'white') {
            actualFile = file;
            actualRank = 7 - rank;
        }
        else {
            actualFile = 7 - file;
            actualRank = rank;
        }
        const fileChar = String.fromCharCode(97 + actualFile); // 0 = 'a', 1 = 'b', etc.
        const rankChar = (actualRank + 1).toString();
        return `${fileChar}${rankChar}`;
    }
    // Knight move detection
    isKnightMove(from, to) {
        const fromFile = from.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
        const fromRank = parseInt(from[1]) - 1; // '1' = 0, '2' = 1, etc.
        const toFile = to.charCodeAt(0) - 97;
        const toRank = parseInt(to[1]) - 1;
        const dx = Math.abs(toFile - fromFile);
        const dy = Math.abs(toRank - fromRank);
        // A knight's move is characterized by a (1,2) or (2,1) movement
        return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    }
    // Square names rendering
    renderSquareNames(orientation, _square, dpr = 1) {
        const ctx = this.canvas.getContext('2d');
        if (!ctx)
            return;
        ctx.save();
        ctx.scale(dpr, dpr);
        const squareSize = this.squareSize / dpr;
        const boardHeight = this.canvas.height / dpr;
        const fontSize = Math.max(10, squareSize * 0.18);
        const filePadding = squareSize * 0.12;
        const rankPadding = squareSize * 0.12;
        ctx.font = `500 ${fontSize}px 'Segoe UI', Arial, sans-serif`;
        const lightSquareColor = 'rgba(240, 217, 181, 0.7)';
        const darkSquareColor = 'rgba(181, 136, 99, 0.7)';
        const bottomRankIndex = orientation === 'white' ? 0 : 7;
        const leftFileIndex = orientation === 'white' ? 0 : 7;
        // Draw file letters along the bottom edge
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        for (let column = 0; column < 8; column++) {
            const boardFileIndex = orientation === 'white' ? column : 7 - column;
            const char = String.fromCharCode(97 + boardFileIndex);
            const x = column * squareSize + filePadding;
            const y = boardHeight - filePadding;
            const isLightSquare = (boardFileIndex + bottomRankIndex) % 2 === 0;
            ctx.fillStyle = isLightSquare ? lightSquareColor : darkSquareColor;
            ctx.fillText(char, x, y);
        }
        // Draw rank numbers along the left edge
        ctx.textBaseline = 'middle';
        for (let row = 0; row < 8; row++) {
            const boardRankIndex = orientation === 'white' ? row : 7 - row;
            const label = (boardRankIndex + 1).toString();
            const x = rankPadding;
            const y = boardHeight - (row + 0.5) * squareSize;
            const isLightSquare = (leftFileIndex + boardRankIndex) % 2 === 0;
            ctx.fillStyle = isLightSquare ? lightSquareColor : darkSquareColor;
            ctx.fillText(label, x, y);
        }
        ctx.restore();
    }
    drawArrows(ctx) {
        ctx.save();
        for (const arrow of this.state.arrows) {
            this.drawArrow(ctx, arrow);
        }
        ctx.restore();
    }
    drawArrow(ctx, arrow) {
        if (arrow.knightMove) {
            this.drawKnightArrow(ctx, arrow);
        }
        else {
            this.drawStraightArrow(ctx, arrow);
        }
    }
    applyArrowStyle(ctx, arrow) {
        const lineWidth = arrow.width;
        ctx.globalAlpha = arrow.opacity;
        ctx.strokeStyle = arrow.color;
        ctx.fillStyle = arrow.color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        return lineWidth;
    }
    drawStraightArrow(ctx, arrow) {
        const [fromX, fromY] = this.squareToCoords(arrow.from);
        const [toX, toY] = this.squareToCoords(arrow.to);
        // Center coordinates on squares
        const centerFromX = fromX + this.squareSize / 2;
        const centerFromY = fromY + this.squareSize / 2;
        const centerToX = toX + this.squareSize / 2;
        const centerToY = toY + this.squareSize / 2;
        // Calculate angle and distance
        const dx = centerToX - centerFromX;
        const dy = centerToY - centerFromY;
        const angle = Math.atan2(dy, dx);
        // Adjust start and end points to avoid overlapping pieces
        const offset = this.squareSize * 0.25;
        const startX = centerFromX + Math.cos(angle) * offset;
        const startY = centerFromY + Math.sin(angle) * offset;
        const endX = centerToX - Math.cos(angle) * offset;
        const endY = centerToY - Math.sin(angle) * offset;
        // Style configuration
        const lineWidth = this.applyArrowStyle(ctx, arrow);
        // Draw the line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        // Draw the arrowhead
        const arrowHeadSize = lineWidth * 3;
        const arrowAngle = Math.PI / 6; // 30 degrees
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowHeadSize * Math.cos(angle - arrowAngle), endY - arrowHeadSize * Math.sin(angle - arrowAngle));
        ctx.lineTo(endX - arrowHeadSize * Math.cos(angle + arrowAngle), endY - arrowHeadSize * Math.sin(angle + arrowAngle));
        ctx.closePath();
        ctx.fill();
    }
    drawKnightArrow(ctx, arrow) {
        const [fromX, fromY] = this.squareToCoords(arrow.from);
        const [toX, toY] = this.squareToCoords(arrow.to);
        // Center coordinates on squares
        const centerFromX = fromX + this.squareSize / 2;
        const centerFromY = fromY + this.squareSize / 2;
        const centerToX = toX + this.squareSize / 2;
        const centerToY = toY + this.squareSize / 2;
        // Calculate knight move
        const dx = centerToX - centerFromX;
        const dy = centerToY - centerFromY;
        // Determine L-shape orientation (horizontal then vertical or vertical then horizontal)
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        let cornerX, cornerY;
        // If horizontal movement is greater, go horizontally first
        if (absDx > absDy) {
            cornerX = centerToX;
            cornerY = centerFromY;
        }
        else {
            // Otherwise, go vertically first
            cornerX = centerFromX;
            cornerY = centerToY;
        }
        // Style configuration
        const lineWidth = this.applyArrowStyle(ctx, arrow);
        // Adjustment to avoid overlapping with pieces
        const offset = this.squareSize * 0.2;
        // Calculate adjusted start and end points
        let startX = centerFromX;
        let startY = centerFromY;
        let endX = centerToX;
        let endY = centerToY;
        // Adjust start point
        if (absDx > absDy) {
            // First horizontal segment
            startX += dx > 0 ? offset : -offset;
            endX += dx > 0 ? -offset : offset;
        }
        else {
            // First vertical segment
            startY += dy > 0 ? offset : -offset;
            endY += dy > 0 ? -offset : offset;
        }
        // Draw the L with two segments
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(cornerX, cornerY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        // Draw the arrowhead at the end
        const arrowHeadSize = lineWidth * 3;
        const arrowAngle = Math.PI / 6; // 30 degrees
        // Calculate the angle of the last segment
        let finalAngle;
        if (absDx > absDy) {
            // The last segment is vertical
            finalAngle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        else {
            // The last segment is horizontal
            finalAngle = dx > 0 ? 0 : Math.PI;
        }
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowHeadSize * Math.cos(finalAngle - arrowAngle), endY - arrowHeadSize * Math.sin(finalAngle - arrowAngle));
        ctx.lineTo(endX - arrowHeadSize * Math.cos(finalAngle + arrowAngle), endY - arrowHeadSize * Math.sin(finalAngle + arrowAngle));
        ctx.closePath();
        ctx.fill();
    }
    // Highlight rendering
    drawHighlights(ctx) {
        ctx.save();
        for (const highlight of this.state.highlights) {
            this.drawHighlight(ctx, highlight);
        }
        ctx.restore();
    }
    drawHighlight(ctx, highlight) {
        const [x, y] = this.squareToCoords(highlight.square);
        const color = this.resolveHighlightColor(highlight);
        const opacity = highlight.opacity ?? 0.6;
        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        // Draw a circle in the center of the square
        const centerX = x + this.squareSize / 2;
        const centerY = y + this.squareSize / 2;
        const radius = this.squareSize * 0.15;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        // Add an outline
        ctx.globalAlpha = opacity * 1.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    resolveHighlightColor(highlight) {
        if (highlight.type === 'circle') {
            return highlight.color ?? DEFAULT_CIRCLE_COLOR;
        }
        const managedType = highlight.type;
        return HIGHLIGHT_COLORS[managedType] ?? highlight.color ?? DEFAULT_CIRCLE_COLOR;
    }
    isInHighlightSequence(type) {
        return HIGHLIGHT_SEQUENCE.includes(type);
    }
    getNextHighlightType(type) {
        if (!this.isInHighlightSequence(type)) {
            return null;
        }
        const currentIndex = HIGHLIGHT_SEQUENCE.indexOf(type);
        const nextIndex = (currentIndex + 1) % HIGHLIGHT_SEQUENCE.length;
        if (nextIndex === 0) {
            return null;
        }
        return HIGHLIGHT_SEQUENCE[nextIndex];
    }
    getActiveModifier(modifiers) {
        for (const key of MODIFIER_PRIORITY) {
            if (modifiers[key]) {
                return key;
            }
        }
        return null;
    }
    resolveArrowColor(modifiers) {
        const modifier = this.getActiveModifier(modifiers);
        if (!modifier) {
            return ARROW_COLOR_BY_MODIFIER.default;
        }
        return ARROW_COLOR_BY_MODIFIER[modifier];
    }
    resolveHighlightTypeFromModifiers(modifiers) {
        const modifier = this.getActiveModifier(modifiers);
        if (!modifier) {
            return HIGHLIGHT_SEQUENCE[0];
        }
        return HIGHLIGHT_TYPE_BY_MODIFIER[modifier];
    }
    withContext(callback) {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        callback(ctx);
    }
    // Premove rendering
    drawPremove(ctx) {
        if (!this.state.premove)
            return;
        ctx.save();
        const [fromX, fromY] = this.squareToCoords(this.state.premove.from);
        const [toX, toY] = this.squareToCoords(this.state.premove.to);
        // Premove style (dashed arrow)
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 3;
        // Use setLineDash only if available (environment testing)
        if (ctx.setLineDash) {
            ctx.setLineDash([8, 4]);
        }
        ctx.lineCap = 'round';
        const centerFromX = fromX + this.squareSize / 2;
        const centerFromY = fromY + this.squareSize / 2;
        const centerToX = toX + this.squareSize / 2;
        const centerToY = toY + this.squareSize / 2;
        // Draw the dashed line
        ctx.beginPath();
        ctx.moveTo(centerFromX, centerFromY);
        ctx.lineTo(centerToX, centerToY);
        ctx.stroke();
        // Draw the start and end squares
        if (ctx.setLineDash) {
            ctx.setLineDash([]);
        }
        ctx.fillStyle = 'rgba(255, 152, 0, 0.3)';
        // Start square
        ctx.fillRect(fromX, fromY, this.squareSize, this.squareSize);
        // End square
        ctx.fillRect(toX, toY, this.squareSize, this.squareSize);
        ctx.restore();
    }
    // Methods to get the complete state
    getDrawingState() {
        return {
            arrows: this.getArrows(),
            highlights: this.getHighlights(),
            premove: this.state.premove ? { ...this.state.premove } : undefined,
        };
    }
    setDrawingState(state) {
        if (state.arrows !== undefined) {
            this.state.arrows = state.arrows.map((arrow) => this.normalizeArrow(arrow));
        }
        if (state.highlights !== undefined) {
            this.state.highlights = state.highlights.map((highlight) => ({ ...highlight }));
        }
        if (state.premove !== undefined) {
            this.state.premove = state.premove ? { ...state.premove } : undefined;
        }
    }
    // Utilities for interactions
    getSquareFromMousePosition(mouseX, mouseY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (mouseX - rect.left) * (this.canvas.width / rect.width);
        const y = (mouseY - rect.top) * (this.canvas.height / rect.height);
        if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
            return null;
        }
        return this.coordsToSquare(x, y);
    }
    // Cycle highlight colors on right-click
    cycleHighlight(square) {
        const existingIndex = this.findHighlightIndex(square);
        if (existingIndex >= 0) {
            const currentHighlight = this.state.highlights[existingIndex];
            const nextType = this.getNextHighlightType(currentHighlight.type);
            if (!nextType) {
                this.removeHighlight(square);
                return;
            }
            this.state.highlights[existingIndex].type = nextType;
            return;
        }
        // Add a new highlight starting from the first color in the cycle
        this.addHighlight(square, HIGHLIGHT_SEQUENCE[0]);
    }
    // Complete rendering of all elements
    draw(ctx) {
        // The order is important for correct layering
        this.drawHighlights(ctx);
        this.drawPremove(ctx);
        this.drawArrows(ctx);
        if (this.showSquareNames) {
            this._drawSquareNames(ctx);
        }
    }
    // Check if a point is near an arrow (for deletion)
    getArrowAt(mouseX, mouseY, tolerance = 10) {
        const rect = this.canvas.getBoundingClientRect();
        const x = mouseX - rect.left;
        const y = mouseY - rect.top;
        for (const arrow of this.state.arrows) {
            if (this.isPointNearArrow(x, y, arrow, tolerance)) {
                return { ...arrow };
            }
        }
        return null;
    }
    isPointNearArrow(x, y, arrow, tolerance) {
        const [fromX, fromY] = this.squareToCoords(arrow.from);
        const [toX, toY] = this.squareToCoords(arrow.to);
        const centerFromX = fromX + this.squareSize / 2;
        const centerFromY = fromY + this.squareSize / 2;
        const centerToX = toX + this.squareSize / 2;
        const centerToY = toY + this.squareSize / 2;
        // Calculate the distance from the point to the line
        const lineLength = Math.sqrt(Math.pow(centerToX - centerFromX, 2) + Math.pow(centerToY - centerFromY, 2));
        if (lineLength === 0)
            return false;
        const distance = Math.abs(((centerToY - centerFromY) * x -
            (centerToX - centerFromX) * y +
            centerToX * centerFromY -
            centerToY * centerFromX) /
            lineLength);
        return distance <= tolerance;
    }
    // Export/Import for persistence
    exportState() {
        return JSON.stringify(this.getDrawingState());
    }
    importState(stateJson) {
        try {
            const imported = JSON.parse(stateJson);
            this.setDrawingState(imported);
        }
        catch (error) {
            console.warn('Failed to import drawing state:', error);
        }
    }
    // Interaction methods for NeoChessBoard
    handleMouseDown(x, y, shiftKey, ctrlKey) {
        // Do not handle left-click here, arrows are now made with right-click
        return false;
    }
    handleRightMouseDown(x, y, shiftKey = false, ctrlKey = false, altKey = false) {
        const square = this.coordsToSquare(x, y);
        // Start drawing an arrow on right-click with modifiers
        this.currentAction = { type: 'drawing_arrow', startSquare: square, shiftKey, ctrlKey, altKey };
        return true;
    }
    handleMouseMove(x, y) {
        // For now, do nothing during movement
        return false;
    }
    handleMouseUp(x, y) {
        // This method is no longer used for arrows (right-click)
        this.cancelCurrentAction();
        return false;
    }
    handleRightMouseUp(x, y) {
        if (this.currentAction.type !== 'drawing_arrow') {
            this.cancelCurrentAction();
            return false;
        }
        const currentDrawingAction = this.currentAction;
        const endSquare = this.coordsToSquare(x, y);
        if (endSquare === currentDrawingAction.startSquare) {
            this.cancelCurrentAction();
            return false;
        }
        const color = this.resolveArrowColor(currentDrawingAction);
        // Check if an identical arrow already exists (same from, to, and color)
        const existingArrow = this.state.arrows.find((arrow) => arrow.from === currentDrawingAction.startSquare &&
            arrow.to === endSquare &&
            arrow.color === color);
        if (existingArrow) {
            // Remove the identical arrow
            this.removeArrow(currentDrawingAction.startSquare, endSquare);
        }
        else {
            // Add or replace the arrow with the new color
            this.addArrow(currentDrawingAction.startSquare, endSquare, color);
        }
        this.cancelCurrentAction();
        return true;
    }
    handleHighlightClick(square, shiftKey = false, ctrlKey = false, altKey = false) {
        if (!shiftKey && !ctrlKey && !altKey) {
            // Without modifiers, keep the existing cycling behavior
            this.cycleHighlight(square);
            return;
        }
        // With modifiers, apply the corresponding color directly
        const modifiers = { shiftKey, ctrlKey, altKey };
        const highlightType = this.resolveHighlightTypeFromModifiers(modifiers);
        // If a highlight already exists with the same color, remove it
        const existingIndex = this.state.highlights.findIndex((highlight) => highlight.square === square && highlight.type === highlightType);
        if (existingIndex >= 0) {
            this.removeHighlight(square);
            return;
        }
        this.addHighlight(square, highlightType);
    }
    renderPremove() {
        this.withContext((ctx) => this.drawPremove(ctx));
    }
    renderHighlights() {
        this.withContext((ctx) => this.drawHighlights(ctx));
    }
    // Methods with signatures adapted for NeoChessBoard
    addArrowFromObject(arrow) {
        this.addArrow(arrow.from, arrow.to, arrow.color, arrow.width, arrow.opacity);
    }
    addHighlightFromObject(highlight) {
        this.addHighlight(highlight.square, highlight.type, highlight.opacity);
    }
    setPremoveFromObject(premove) {
        this.setPremove(premove.from, premove.to, premove.promotion);
    }
    _drawSquareNames(ctx) {
        ctx.save();
        ctx.font = `${Math.floor(this.squareSize * 0.18)}px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto`;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const square = this.coordsToSquare(f * this.squareSize, r * this.squareSize);
                const [x, y] = this.squareToCoords(square);
                // Draw file names (a, b, c...)
                if (r === (this.orientation === 'white' ? 7 : 0)) {
                    // Bottom rank for white, top rank for black
                    const file = this.orientation === 'white' ? FILES[f] : FILES[7 - f];
                    ctx.textAlign = this.orientation === 'white' ? 'left' : 'right';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(file, x +
                        (this.orientation === 'white'
                            ? this.squareSize * 0.06
                            : this.squareSize - this.squareSize * 0.06), y + this.squareSize - this.squareSize * 0.06);
                }
                // Draw rank names (1, 2, 3...)
                if (f === (this.orientation === 'white' ? 0 : 7)) {
                    // Left file for white, right file for black
                    const rank = RANKS[7 - r];
                    ctx.textAlign = this.orientation === 'white' ? 'left' : 'right';
                    ctx.textBaseline = this.orientation === 'white' ? 'top' : 'bottom';
                    ctx.fillText(rank, x +
                        (this.orientation === 'white'
                            ? this.squareSize * 0.06
                            : this.squareSize - this.squareSize * 0.06), y +
                        (this.orientation === 'white'
                            ? this.squareSize * 0.06
                            : this.squareSize - this.squareSize * 0.06));
                }
            }
        }
        ctx.restore();
    }
    // Additional helper methods for integration with NeoChessBoard
    /**
     * Render arrows on the canvas
     */
    renderArrows() {
        this.withContext((ctx) => this.drawArrows(ctx));
    }
    /**
     * Cancel the current drawing action
     */
    cancelCurrentAction() {
        this.currentAction = { type: 'none' };
    }
    /**
     * Clear all drawings (arrows, highlights, premoves)
     */
    clearAllDrawings() {
        this.state.arrows = [];
        this.state.highlights = [];
        this.state.premove = undefined;
    }
}
