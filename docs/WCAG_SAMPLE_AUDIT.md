# WCAG 2.1 AA sample manual audit

Automated CI (axe, Lighthouse accessibility category, chart audits) catches regressions but does **not** replace a human spot-check before release. Complete this checklist once per major release.

**Related client inventory:** [Energy-Fact-Book-Review-Change-Inventory.pdf](client/Energy-Fact-Book-Review-Change-Inventory.pdf) (what changed for the codebase review). Embed mode notes: [EMBED_MODE.md](EMBED_MODE.md).

## Sample pages (EN and FR each)

| # | Route | Why included |
|---|--------|----------------|
| 1 | `/section-1` (Energy overview) | Section landing + stacked topics |
| 2 | `/section-1#economic-contributions` → Employment chart | Pie chart + spoken summary |
| 3 | `/section-1#energy-production` → Primary energy by region | Horizontal bar + data table |
| 4 | `/section-2#capital-expenditure` | Multi-series bar chart |
| 5 | `/section-5#clean-technology-economy` | Infographic + capsule layout |
| 6 | `/section-6#world-proved-crude-reserves` | Infographic + in-frame pie |
| 7 | `/section-4#energy-use` | Multiple charts on one topic |
| 8 | `/Glossary` | Long prose, links, search/filter if present |
| 9 | `/section-1?embed=1` | Chrome-less embed mode |
| 10 | Any page with Word export + footnotes | Tab order through footnote bodies |

Toggle language with the header control; repeat critical checks in French.

## Keyboard checks

- [ ] Skip link moves focus to main content
- [ ] Sidebar opens via toggle (not hover-only); active section expanded
- [ ] Tab reaches chart title → spoken summary region → data table summary → table cells (when open)
- [ ] Plotly PNG download control is focusable and labeled
- [ ] Topic/section change moves focus to new page heading (not bottom nav)
- [ ] No keyboard trap in sidebar, mega-menu, or chart data tables

## Screen reader checks (NVDA or JAWS)

- [ ] One `main` landmark per view; page title and `lang` correct
- [ ] Chart regions read full data enumeration (not title-only)
- [ ] Infographics read full numeric `aria-label`
- [ ] Headings and footnotes not hidden behind `aria-hidden`
- [ ] Data tables expose headers when `<details>` is open

## Visual / contrast (spot)

- [ ] Focus rings visible on links, buttons, chart regions
- [ ] Text meets contrast on GC header, sidebar, and chart labels at 100% and 200% zoom

## Release sign-off

| Field | Value |
|-------|--------|
| Release / tag | |
| Date | |
| Tester | |
| Browser + AT | |
| EN pass | ☐ |
| FR pass | ☐ |
| Issues filed (Linear/GitHub) | |
| Approved for deploy | ☐ |

If any item fails, file a defect before production deploy. Re-run automated suite locally:

```bash
npm run lint && npm test && npm run test:a11y-routes && npm run audit:charts && npm run audit:sr-content && npm run audit:chart-summaries && npm run build && npm run check:bundle
```
