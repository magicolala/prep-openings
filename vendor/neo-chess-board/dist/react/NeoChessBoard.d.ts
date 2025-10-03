import type { CSSProperties } from 'react';
import type { NeoChessBoard as Chessboard } from '../core/NeoChessBoard';
import type { BoardOptions, Square } from '../core/types';
export interface NeoChessProps extends Omit<BoardOptions, 'fen' | 'rulesAdapter'> {
    fen?: string;
    className?: string;
    style?: CSSProperties;
    onMove?: (e: {
        from: Square;
        to: Square;
        fen: string;
    }) => void;
    onIllegal?: (e: {
        from: Square;
        to: Square;
        reason: string;
    }) => void;
    onUpdate?: (e: {
        fen: string;
    }) => void;
}
export interface NeoChessRef {
    getBoard: () => Chessboard | null;
    addArrow: (arrow: {
        from: Square;
        to: Square;
        color?: string;
    }) => void;
    addHighlight: (square: Square, type: string) => void;
    clearArrows: () => void;
    clearHighlights: () => void;
}
export declare const NeoChessBoard: import("react").ForwardRefExoticComponent<NeoChessProps & import("react").RefAttributes<NeoChessRef>>;
