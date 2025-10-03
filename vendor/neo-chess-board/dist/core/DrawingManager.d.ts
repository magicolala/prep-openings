import type { Square, Arrow, SquareHighlight, HighlightType, DrawingState, Premove } from './types';
type ArrowInput = Pick<Arrow, 'from' | 'to'> & Partial<Omit<Arrow, 'from' | 'to'>>;
export declare class DrawingManager {
    private state;
    private readonly canvas;
    private squareSize;
    private orientation;
    private showSquareNames;
    /**
     * Tracks the current user interaction state
     */
    private currentAction;
    constructor(canvas: HTMLCanvasElement);
    updateDimensions(): void;
    setOrientation(orientation: 'white' | 'black'): void;
    setShowSquareNames(show: boolean): void;
    addArrow(fromOrArrow: Square | ArrowInput, to?: Square, color?: string, width?: number, opacity?: number): void;
    private normalizeArrow;
    private findArrowIndex;
    removeArrow(from: Square, to: Square): void;
    clearArrows(): void;
    getArrows(): Arrow[];
    addHighlight(square: Square, type?: HighlightType | string, opacity?: number): void;
    private getDefaultHighlightOpacity;
    private findHighlightIndex;
    removeHighlight(square: Square): void;
    clearHighlights(): void;
    /**
     * Get the pixel coordinates of the top-left corner of a square
     * @param square The square in algebraic notation (e.g., 'a1', 'h8')
     * @returns An object with x and y coordinates
     */
    private getSquareCoordinates;
    /**
     * Get the size of a square in pixels
     */
    private getSquareSize;
    /**
     * Get the center point of a square in pixels
     */
    private getSquareCenter;
    getHighlights(): SquareHighlight[];
    setPremove(from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): void;
    clearPremove(): void;
    getPremove(): Premove | undefined;
    squareToCoords(square: Square): [number, number];
    coordsToSquare(x: number, y: number): Square;
    private isKnightMove;
    renderSquareNames(orientation: 'white' | 'black', _square: number, dpr?: number): void;
    drawArrows(ctx: CanvasRenderingContext2D): void;
    private drawArrow;
    private applyArrowStyle;
    private drawStraightArrow;
    private drawKnightArrow;
    drawHighlights(ctx: CanvasRenderingContext2D): void;
    private drawHighlight;
    private resolveHighlightColor;
    private isInHighlightSequence;
    private getNextHighlightType;
    private getActiveModifier;
    private resolveArrowColor;
    private resolveHighlightTypeFromModifiers;
    private withContext;
    drawPremove(ctx: CanvasRenderingContext2D): void;
    getDrawingState(): DrawingState;
    setDrawingState(state: Partial<DrawingState>): void;
    getSquareFromMousePosition(mouseX: number, mouseY: number): Square | null;
    cycleHighlight(square: Square): void;
    draw(ctx: CanvasRenderingContext2D): void;
    getArrowAt(mouseX: number, mouseY: number, tolerance?: number): Arrow | null;
    private isPointNearArrow;
    exportState(): string;
    importState(stateJson: string): void;
    handleMouseDown(x: number, y: number, shiftKey: boolean, ctrlKey: boolean): boolean;
    handleRightMouseDown(x: number, y: number, shiftKey?: boolean, ctrlKey?: boolean, altKey?: boolean): boolean;
    handleMouseMove(x: number, y: number): boolean;
    handleMouseUp(x: number, y: number): boolean;
    handleRightMouseUp(x: number, y: number): boolean;
    handleHighlightClick(square: Square, shiftKey?: boolean, ctrlKey?: boolean, altKey?: boolean): void;
    renderPremove(): void;
    renderHighlights(): void;
    addArrowFromObject(arrow: Arrow): void;
    addHighlightFromObject(highlight: SquareHighlight): void;
    setPremoveFromObject(premove: Premove): void;
    clearAll: () => void;
    private _drawSquareNames;
    /**
     * Render arrows on the canvas
     */
    renderArrows(): void;
    /**
     * Cancel the current drawing action
     */
    cancelCurrentAction(): void;
    /**
     * Clear all drawings (arrows, highlights, premoves)
     */
    clearAllDrawings(): void;
}
export {};
