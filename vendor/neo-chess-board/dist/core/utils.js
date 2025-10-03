export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export function isWhitePiece(piece) {
    return piece === piece.toUpperCase();
}
export function sq(file, rank) {
    return (FILES[file] + RANKS[rank]);
}
export function sqToFR(square) {
    return {
        f: FILES.indexOf(square[0]),
        r: RANKS.indexOf(square[1]),
    };
}
export function parseFEN(fen) {
    const parts = fen.split(' ');
    const board = Array(8)
        .fill(null)
        .map(() => Array(8).fill(null));
    const rows = parts[0].split('/');
    for (let r = 0; r < 8; r++) {
        const row = rows[r];
        let f = 0;
        for (const char of row) {
            if (/\d/.test(char)) {
                f += parseInt(char);
            }
            else {
                board[7 - r][f] = char;
                f++;
            }
        }
    }
    return {
        board,
        turn: (parts[1] || 'w'),
        castling: parts[2] || 'KQkq',
        ep: parts[3] === '-' ? null : parts[3],
        halfmove: parseInt(parts[4] || '0'),
        fullmove: parseInt(parts[5] || '1'),
    };
}
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
