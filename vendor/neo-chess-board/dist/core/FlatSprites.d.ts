import type { Theme } from './types';
export declare class FlatSprites {
    private size;
    private colors;
    private sheet;
    constructor(size: number, colors: Theme);
    getSheet(): HTMLCanvasElement | OffscreenCanvas;
    private rr;
    private build;
    private draw;
}
