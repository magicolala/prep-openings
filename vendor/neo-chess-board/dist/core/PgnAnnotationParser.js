/**
 * Parser for PGN annotations with arrows and circles
 * Supports %cal (arrows) and %csl (circles) extensions popular on lichess.org and chesscafe.com
 */
// Regular expressions for parsing annotations
const CAL_REGEX = /%cal\s+([^%\s]+)/g;
const CSL_REGEX = /%csl\s+([^%\s]+)/g;
const VISUAL_ANNOTATION_REGEX = /%(?:cal|csl)\s+[^%\s]+/;
const SQUARE_REGEX = /^[a-h][1-8]$/;
const EVAL_REGEX = /(?:\[\s*)?%eval\s+([^\]\s}]+)(?:\s*\])?/gi;
const NUMERIC_VALUE_REGEX = /^[-+]?((\d+(?:\.\d+)?)|(?:\.\d+))$/;
const parseAnnotationValue = (value) => {
    const trimmed = value.trim();
    if (NUMERIC_VALUE_REGEX.test(trimmed)) {
        const parsed = Number(trimmed);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return trimmed;
};
// Color mapping
const COLOR_MAP = {
    R: '#ff0000', // Red
    G: '#00ff00', // Green
    Y: '#ffff00', // Yellow
    B: '#0000ff', // Blue
};
export class PgnAnnotationParser {
    /**
     * Check if a comment contains visual annotations
     */
    static hasVisualAnnotations(comment) {
        return VISUAL_ANNOTATION_REGEX.test(comment);
    }
    /**
     * Parse visual annotations from a PGN comment
     */
    static parseComment(comment) {
        // Strip outer curly braces if present
        let processingComment = comment.startsWith('{') && comment.endsWith('}')
            ? comment.substring(1, comment.length - 1)
            : comment;
        const arrows = [];
        const highlights = [];
        let evaluation;
        // Parse arrows (%cal)
        const arrowMatches = [...processingComment.matchAll(CAL_REGEX)]; // Use spread to get all matches at once
        for (const match of arrowMatches) {
            const arrowSpecs = match[1].split(',');
            for (const spec of arrowSpecs) {
                const trimmed = spec.trim();
                if (trimmed.length >= 5) {
                    const colorCode = trimmed[0];
                    const fromSquare = trimmed.slice(1, 3);
                    const toSquare = trimmed.slice(3, 5);
                    if (PgnAnnotationParser.isValidSquare(fromSquare) &&
                        PgnAnnotationParser.isValidSquare(toSquare)) {
                        arrows.push({
                            from: fromSquare,
                            to: toSquare,
                            color: PgnAnnotationParser.colorToHex(colorCode),
                        });
                    }
                }
            }
            // Remove this annotation from the processingComment
            processingComment = processingComment.replace(match[0], ' ');
        }
        // Parse circles (%csl)
        const circleMatches = [...processingComment.matchAll(CSL_REGEX)]; // Use spread to get all matches at once
        for (const match of circleMatches) {
            const circleSpecs = match[1].split(',');
            for (const spec of circleSpecs) {
                const trimmed = spec.trim();
                if (trimmed.length >= 3) {
                    const colorCode = trimmed[0];
                    const square = trimmed.slice(1, 3);
                    if (PgnAnnotationParser.isValidSquare(square)) {
                        highlights.push({
                            square,
                            type: 'circle', // Cast to avoid type issues
                            color: PgnAnnotationParser.colorToHex(colorCode),
                        });
                    }
                }
            }
            // Remove this annotation from the processingComment
            processingComment = processingComment.replace(match[0], ' ');
        }
        // Parse evaluation (%eval)
        processingComment = processingComment.replace(EVAL_REGEX, (_match, value) => {
            evaluation = parseAnnotationValue(value);
            return ' ';
        });
        // The remaining text in processingComment is the actual text comment
        let textComment = processingComment.replace(/\s+/g, ' ').trim();
        return {
            arrows,
            highlights,
            textComment: textComment || '',
            evaluation,
        };
    }
    /**
     * Returns drawing objects from parsed annotations
     */
    static toDrawingObjects(parsed) {
        return {
            arrows: parsed.arrows,
            highlights: parsed.highlights,
        };
    }
    /**
     * Remove visual annotations from a comment, keeping only text
     */
    static stripAnnotations(comment) {
        return comment
            .replace(new RegExp(VISUAL_ANNOTATION_REGEX.source, 'g'), '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Create annotation string from arrows and circles
     */
    static fromDrawingObjects(arrows, highlights) {
        const parts = [];
        if (arrows.length > 0) {
            const arrowSpecs = arrows
                .map((arrow) => `${PgnAnnotationParser.hexToColor(arrow.color)}${arrow.from}${arrow.to}`)
                .join(',');
            parts.push(`%cal ${arrowSpecs}`);
        }
        if (highlights.length > 0) {
            const circleSpecs = highlights
                .map((circle) => `${PgnAnnotationParser.hexToColor(circle.color)}${circle.square}`)
                .join(',');
            parts.push(`%csl ${circleSpecs}`);
        }
        return parts.join(' ');
    }
    /**
     * Convert color code to hex color
     */
    static colorToHex(colorCode) {
        return COLOR_MAP[colorCode] || COLOR_MAP['R']; // Default to red
    }
    /**
     * Convert hex color to color code
     */
    static hexToColor(hex) {
        for (const [code, color] of Object.entries(COLOR_MAP)) {
            if (color === hex) {
                return code;
            }
        }
        return 'R'; // Default to red
    }
    /**
     * Check if a string is a valid chess square notation
     */
    static isValidSquare(square) {
        return SQUARE_REGEX.test(square);
    }
}
