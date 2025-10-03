import type { MutableRefObject } from 'react';
import { NeoChessBoard as Chessboard } from '../core/NeoChessBoard';
import type { BoardOptions, Square } from '../core/types';
import type { NeoChessRef } from './NeoChessBoard';
export type UpdatableBoardOptions = Omit<BoardOptions, 'fen' | 'rulesAdapter'>;
export interface UseNeoChessBoardOptions {
    fen?: string;
    options?: UpdatableBoardOptions;
    onMove?: (event: {
        from: Square;
        to: Square;
        fen: string;
    }) => void;
    onIllegal?: (event: {
        from: Square;
        to: Square;
        reason: string;
    }) => void;
    onUpdate?: (event: {
        fen: string;
    }) => void;
}
export interface UseNeoChessBoardResult {
    containerRef: MutableRefObject<HTMLDivElement | null>;
    boardRef: MutableRefObject<Chessboard | null>;
    isReady: boolean;
    api: NeoChessRef;
}
export declare function useNeoChessBoard({ fen, options, onMove, onIllegal, onUpdate, }: UseNeoChessBoardOptions): UseNeoChessBoardResult;
