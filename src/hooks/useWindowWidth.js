import { useEffect, useState } from 'react';

/**
 * Track window.innerWidth with a resize listener.
 */
export default function useWindowWidth(initial = typeof window !== 'undefined' ? window.innerWidth : 1200) {
  const [windowWidth, setWindowWidth] = useState(initial);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return windowWidth;
}
