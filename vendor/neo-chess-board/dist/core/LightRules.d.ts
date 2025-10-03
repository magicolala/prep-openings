import type { RulesAdapter, Move, Square, Color } from './types';
export declare class LightRules implements RulesAdapter {
    private state;
    setFEN(f: string): void;
    getFEN(): string;
    turn(): Color;
    pieceAt(square: Square): string | null;
    movesFrom(square: Square): Move[];
    move({ from, to, promotion }: {
        from: Square;
        to: Square;
        promotion?: Move['promotion'];
    }): {
        ok: boolean;
        reason: string;
        fen?: undefined;
        state?: undefined;
    } | {
        ok: boolean;
        fen: string;
        state: any;
        reason?: undefined;
    };
}
