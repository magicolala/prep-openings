export declare class EventBus<T extends Record<string, any>> {
    private map;
    on<K extends keyof T>(type: K, fn: (p: T[K]) => void): () => void;
    off<K extends keyof T>(type: K, fn: (p: T[K]) => void): void;
    emit<K extends keyof T>(type: K, payload: T[K]): void;
}
