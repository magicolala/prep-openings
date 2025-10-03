/**
 * Parser for PGN annotations with arrows and circles
 * Supports %cal (arrows) and %csl (circles) extensions popular on lichess.org and chesscafe.com
 */
import type { Square, Arrow, SquareHighlight } from './types';
export interface ParsedAnnotations {
    arrows: Arrow[];
    highlights: Array<SquareHighlight & {
        color: string;
    }>;
    textComment: string;
    evaluation?: number | string;
}
export declare class PgnAnnotationParser {
    /**
     * Check if a comment contains visual annotations
     */
    static hasVisualAnnotations(comment: string): boolean;
    /**
     * Parse visual annotations from a PGN comment
     */
    static parseComment(comment: string): ParsedAnnotations;
    /**
     * Returns drawing objects from parsed annotations
     */
    static toDrawingObjects(parsed: ParsedAnnotations): {
        arrows: Arrow[];
        highlights: SquareHighlight[];
    };
    /**
     * Remove visual annotations from a comment, keeping only text
     */
    static stripAnnotations(comment: string): string;
    /**
     * Create annotation string from arrows and circles
     */
    static fromDrawingObjects(arrows: Arrow[], highlights: SquareHighlight[]): string;
    /**
     * Convert color code to hex color
     */
    static colorToHex(colorCode: string): string;
    /**
     * Convert hex color to color code
     */
    static hexToColor(hex: string): string;
    /**
     * Check if a string is a valid chess square notation
     */
    static isValidSquare(square: string): square is Square;
}
