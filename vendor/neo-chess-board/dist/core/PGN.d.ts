import type { Move, RulesAdapter } from './types';
/**
 * PGNRecorder
 * - If adapter exposes getPGN (chess.js), we proxy it.
 * - Else we build a light PGN from LAN (algebraic squares), with minimal SAN (no disamb/check/mate).
 * - Adds helpers to export as a downloadable .pgn file.
 */
export declare class PGNRecorder {
    private adapter?;
    private moves;
    private headers;
    constructor(adapter?: RulesAdapter | undefined);
    reset(): void;
    push(move: Move): void;
    setHeaders(h: Partial<Record<keyof typeof this.headers, string>>): void;
    setResult(res: '1-0' | '0-1' | '1/2-1/2' | '*'): void;
    getPGN(): string;
    toBlob(): Blob;
    suggestFilename(): string;
    download(filename?: string): void;
    private fmt;
}
