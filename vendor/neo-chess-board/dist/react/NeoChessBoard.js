import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef, useImperativeHandle, useMemo } from 'react';
import { useNeoChessBoard } from './useNeoChessBoard';
export const NeoChessBoard = forwardRef(({ fen, className, style, onMove, onIllegal, onUpdate, size, ...restOptions }, ref) => {
    const options = useMemo(() => {
        const typedOptions = restOptions;
        if (typeof size === 'number') {
            return { ...typedOptions, size };
        }
        return typedOptions;
    }, [restOptions, size]);
    const computedStyle = useMemo(() => {
        if (typeof size !== 'number' || Number.isNaN(size) || size <= 0) {
            return style;
        }
        const roundedSize = Math.round(size);
        const sizeStyles = {
            width: '100%',
            maxWidth: `${roundedSize}px`,
            maxHeight: `${roundedSize}px`,
            aspectRatio: '1 / 1',
        };
        return style ? { ...sizeStyles, ...style } : sizeStyles;
    }, [size, style]);
    const { containerRef, api } = useNeoChessBoard({
        fen,
        options,
        onMove,
        onIllegal,
        onUpdate,
    });
    useImperativeHandle(ref, () => api, [api]);
    return _jsx("div", { ref: containerRef, className: className, style: computedStyle });
});
NeoChessBoard.displayName = 'NeoChessBoard';
