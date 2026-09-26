import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prefetchAdjacentTopics, prefetchTopicPages } from './prefetchTopicPages';

function makeTopic(ids) {
  return {
    id: ids[0],
    pages: ids.map((id) => ({
      id,
      Component: { preload: vi.fn() },
    })),
  };
}

describe('prefetchTopicPages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('preloads entry page immediately and rest on idle', () => {
    const topic = makeTopic(['a', 'b', 'c']);

    prefetchTopicPages(topic);

    expect(topic.pages[0].Component.preload).toHaveBeenCalledTimes(1);
    expect(topic.pages[1].Component.preload).not.toHaveBeenCalled();
    expect(topic.pages[2].Component.preload).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(topic.pages[1].Component.preload).toHaveBeenCalledTimes(1);
    expect(topic.pages[2].Component.preload).toHaveBeenCalledTimes(1);
  });

  it('no-ops when topic is missing or empty', () => {
    expect(() => prefetchTopicPages(null)).not.toThrow();
    expect(() => prefetchTopicPages({ pages: [] })).not.toThrow();
  });

  it('no-ops when saveData is enabled', () => {
    const originalConnection = navigator.connection;
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    });

    const topic = makeTopic(['a', 'b']);
    prefetchTopicPages(topic);

    expect(topic.pages[0].Component.preload).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: originalConnection,
    });
  });
});

describe('prefetchAdjacentTopics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('preloads both entry pages immediately then staggers remaining pages', () => {
    const prevTopic = makeTopic(['prev-a', 'prev-b']);
    const nextTopic = makeTopic(['next-a', 'next-b', 'next-c']);

    prefetchAdjacentTopics({ prevTopic, nextTopic });

    expect(prevTopic.pages[0].Component.preload).toHaveBeenCalledTimes(1);
    expect(nextTopic.pages[0].Component.preload).toHaveBeenCalledTimes(1);
    expect(prevTopic.pages[1].Component.preload).not.toHaveBeenCalled();
    expect(nextTopic.pages[1].Component.preload).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(nextTopic.pages[1].Component.preload).toHaveBeenCalledTimes(1);
    expect(nextTopic.pages[2].Component.preload).toHaveBeenCalledTimes(1);
    expect(prevTopic.pages[1].Component.preload).toHaveBeenCalledTimes(1);
  });

  it('no-ops when saveData is enabled', () => {
    const originalConnection = navigator.connection;
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    });

    const nextTopic = makeTopic(['next-a']);
    prefetchAdjacentTopics({ nextTopic, prevTopic: null });

    expect(nextTopic.pages[0].Component.preload).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: originalConnection,
    });
  });
});
