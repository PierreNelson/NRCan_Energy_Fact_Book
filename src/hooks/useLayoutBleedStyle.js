import { useMemo } from 'react';

/**
 * Full-bleed style object matching Fact Book page chrome (layoutPadding).
 * @param {{ left?: number, right?: number }} layoutPadding
 * @param {{ leftOnly?: boolean, rightOnly?: boolean }} [opts]
 */
export default function useLayoutBleedStyle(layoutPadding, opts = {}) {
  const left = layoutPadding?.left ?? 55;
  const right = layoutPadding?.right ?? 15;
  const { leftOnly = false, rightOnly = false } = opts;

  return useMemo(() => {
    if (rightOnly) {
      return {
        marginRight: `-${right}px`,
        width: `calc(100% + ${right}px)`,
        paddingRight: `${right}px`,
      };
    }
    if (leftOnly) {
      return {
        marginLeft: `-${left}px`,
        width: `calc(100% + ${left}px)`,
        paddingLeft: `${left}px`,
      };
    }
    return {
      marginLeft: `-${left}px`,
      marginRight: `-${right}px`,
      width: `calc(100% + ${left + right}px)`,
      paddingLeft: `${left}px`,
      paddingRight: `${right}px`,
    };
  }, [left, right, leftOnly, rightOnly]);
}

/**
 * CSS custom properties for bleed (use with .page-chrome in page-chrome.css).
 */
export function layoutBleedCssVars(layoutPadding) {
  const left = layoutPadding?.left ?? 55;
  const right = layoutPadding?.right ?? 15;
  return {
    '--page-bleed-left': `${left}px`,
    '--page-bleed-right': `${right}px`,
    '--page-bleed-sum': `${left + right}px`,
  };
}
