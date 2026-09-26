import { useEffect, useState } from 'react';

/**
 * Track browser / visualViewport zoom scale for responsive chart/infographic tweaks.
 * Returns { viewportScale, zoomLevel } where zoomLevel includes devicePixelRatio.
 */
export default function useViewportZoom() {
  const [viewportScale, setViewportScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const onResize = () => {
      const vvScale = window.visualViewport?.scale || 1;
      const approxZoom = window.outerWidth > 0 && window.innerWidth > 0
        ? window.outerWidth / window.innerWidth
        : 1;
      const scale = Math.max(vvScale, approxZoom);
      setViewportScale(scale);
      setZoomLevel(Math.max(scale, window.devicePixelRatio || 1));
    };

    onResize();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
    };
  }, []);

  return { viewportScale, zoomLevel };
}
