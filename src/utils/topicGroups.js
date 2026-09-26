/**
 * Group ordered page entries into topics for lazy mounting.
 *
 * A new topic starts at:
 * - the first page in the section, or
 * - any page whose id is listed in topicAnchors (section overview links).
 *
 * Pages with page-with-title-divider that are NOT overview anchors stay in the
 * current topic (e.g. Employment within Economic contributions).
 */
export function groupPagesIntoTopics(pages, topicAnchors = []) {
  if (!pages?.length) return [];

  const anchorSet = new Set(topicAnchors);
  const topics = [];
  let current = null;

  for (const page of pages) {
    const startsTopic = !current || anchorSet.has(page.id);

    if (startsTopic) {
      if (current) topics.push(current);
      current = { id: page.id, pages: [page] };
    } else {
      current.pages.push(page);
    }
  }

  if (current) topics.push(current);
  return topics;
}

export function findTopicIndexForHash(topics, hash) {
  if (!topics.length) return 0;
  if (!hash) return 0;

  const byPage = topics.findIndex((topic) => topic.pages.some((p) => p.id === hash));
  if (byPage >= 0) return byPage;

  const byTopicId = topics.findIndex((topic) => topic.id === hash);
  return byTopicId >= 0 ? byTopicId : 0;
}
