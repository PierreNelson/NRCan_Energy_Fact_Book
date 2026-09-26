import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePlotlySelection from './usePlotlySelection';

describe('usePlotlySelection points mode', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggles points on desktop without double-tap', () => {
    const { result } = renderHook(() =>
      usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth: 1200 }),
    );

    act(() => {
      result.current.onPlotClick({
        points: [{ curveNumber: 0, pointIndex: 3 }],
      });
    });
    expect(result.current.selected).toEqual([[3], []]);

    act(() => {
      result.current.onPlotClick({
        points: [{ curveNumber: 0, pointIndex: 3 }],
      });
    });
    expect(result.current.selected).toBeNull();
  });

  it('requires double-tap on mobile', () => {
    const { result } = renderHook(() =>
      usePlotlySelection({ mode: 'points', traceCount: 1, windowWidth: 400 }),
    );

    act(() => {
      result.current.onPlotClick({
        points: [{ curveNumber: 0, pointIndex: 1 }],
      });
    });
    expect(result.current.selected).toBeNull();

    Date.now.mockReturnValue(1100);
    act(() => {
      result.current.onPlotClick({
        points: [{ curveNumber: 0, pointIndex: 1 }],
      });
    });
    expect(result.current.selected).toEqual([[1]]);
  });
});

describe('usePlotlySelection slices mode', () => {
  it('toggles pie slices', () => {
    const { result } = renderHook(() =>
      usePlotlySelection({ mode: 'slices', windowWidth: 1200 }),
    );

    act(() => {
      result.current.onPlotClick({
        points: [{ pointNumber: 2 }],
      });
    });
    expect(result.current.selected).toEqual([2]);
    expect(result.current.opacityFor(2)).toBe(1);
    expect(result.current.opacityFor(0)).toBe(0.3);
  });
});
