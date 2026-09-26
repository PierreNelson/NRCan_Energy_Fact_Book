function shouldSkipPrefetch() {
  return typeof navigator !== 'undefined' && navigator.connection?.saveData === true;
}

function preloadPage(page) {
  page?.Component?.preload?.();
}

function preloadEntryPage(topic) {
  if (!topic?.pages?.length) return;
  preloadPage(topic.pages[0]);
}

function preloadRemainingPages(topic) {
  if (!topic?.pages?.length) return;
  topic.pages.slice(1).forEach(preloadPage);
}

function scheduleIdle(callback, timeout = 3000) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout });
    return;
  }
  setTimeout(callback, 300);
}

/**
 * Prefetch one topic: entry page immediately, remaining pages on idle.
 */
export function prefetchTopicPages(topic) {
  if (!topic?.pages?.length || shouldSkipPrefetch()) return;

  preloadEntryPage(topic);

  scheduleIdle(() => {
    preloadRemainingPages(topic);
  });
}

/**
 * Prefetch next and previous topics with staggered priority:
 * 1. Both entry pages immediately
 * 2. Remaining next-topic pages on idle
 * 3. Remaining prev-topic pages on a chained idle callback
 */
export function prefetchAdjacentTopics({ nextTopic, prevTopic }) {
  if (shouldSkipPrefetch()) return;

  preloadEntryPage(nextTopic);
  preloadEntryPage(prevTopic);

  scheduleIdle(() => {
    preloadRemainingPages(nextTopic);
    scheduleIdle(() => {
      preloadRemainingPages(prevTopic);
    }, 5000);
  });
}
