import { describe, it, expect } from 'vitest';
import { findTopicIndexForHash, groupPagesIntoTopics } from './topicGroups';

const pages = [
  { id: 'overview' },
  { id: 'topic-a-start' },
  { id: 'topic-a-child' },
  { id: 'topic-b-start' },
  { id: 'sub-heading-with-divider' },
  { id: 'topic-b-child' },
  { id: 'topic-c-start' },
];

describe('groupPagesIntoTopics', () => {
  it('splits on first page and overview anchors only', () => {
    const topics = groupPagesIntoTopics(pages, ['topic-a-start', 'topic-b-start', 'topic-c-start']);

    expect(topics).toHaveLength(4);
    expect(topics[0].id).toBe('overview');
    expect(topics[0].pages.map((p) => p.id)).toEqual(['overview']);
    expect(topics[1].pages.map((p) => p.id)).toEqual(['topic-a-start', 'topic-a-child']);
    expect(topics[2].pages.map((p) => p.id)).toEqual([
      'topic-b-start',
      'sub-heading-with-divider',
      'topic-b-child',
    ]);
    expect(topics[3].pages.map((p) => p.id)).toEqual(['topic-c-start']);
  });
});

describe('findTopicIndexForHash', () => {
  const topics = groupPagesIntoTopics(pages, ['topic-a-start', 'topic-b-start', 'topic-c-start']);

  it('finds topic by child page hash', () => {
    expect(findTopicIndexForHash(topics, 'sub-heading-with-divider')).toBe(2);
  });

  it('finds topic by entry hash', () => {
    expect(findTopicIndexForHash(topics, 'topic-b-start')).toBe(2);
  });

  it('defaults to first topic when hash is empty', () => {
    expect(findTopicIndexForHash(topics, '')).toBe(0);
  });
});
