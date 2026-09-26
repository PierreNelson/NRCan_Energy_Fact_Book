import { lazy } from 'react';

/**
 * React.lazy wrapper that exposes importFn as Component.preload for idle prefetch.
 * Caches the dynamic import promise so preload() and lazy mount share one fetch.
 */
export function lazyWithPreload(importFn) {
  let promise;

  const load = () => {
    if (!promise) {
      promise = importFn();
    }
    return promise;
  };

  const Component = lazy(load);
  Component.preload = load;
  return Component;
}
