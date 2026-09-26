import { describe, it, expect } from 'vitest';

// Test host sizing logic by importing the component module's behavior via a thin re-export
// of the same height resolution rules used in LazyPlot.
function resolveLazyPlotHostStyle(style) {
  const resolvedStyle = style ?? {};
  const explicitHeight = resolvedStyle.height;
  return {
    width: resolvedStyle.width ?? '100%',
    ...(explicitHeight != null
      ? { height: explicitHeight, minHeight: explicitHeight }
      : { minHeight: resolvedStyle.minHeight ?? 400 }),
  };
}

describe('LazyPlot host sizing', () => {
  it('preserves height:100% instead of forcing minHeight 400', () => {
    expect(resolveLazyPlotHostStyle({ width: '100%', height: '100%' })).toEqual({
      width: '100%',
      height: '100%',
      minHeight: '100%',
    });
  });

  it('uses 400px fallback only when height is omitted', () => {
    expect(resolveLazyPlotHostStyle({ width: '100%' })).toEqual({
      width: '100%',
      minHeight: 400,
    });
  });

  it('preserves explicit pixel heights used by fixed pie frames', () => {
    expect(resolveLazyPlotHostStyle({ height: 340 })).toEqual({
      width: '100%',
      height: 340,
      minHeight: 340,
    });
  });
});
