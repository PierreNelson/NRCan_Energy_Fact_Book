# AGENTS.md — NRCan Energy Factbook

Guidance for coding agents (OpenAI Codex, Cursor, etc.) working in this repository. Used with [Symphony](https://github.com/openai/symphony) + Linear for parallel issue execution.

## Stack

- **Framework:** React 19, Vite 7, React Router 7 (`HashRouter`)
- **Charts:** Plotly (`react-plotly.js`, `plotly.js-dist-min`)
- **Styling:** Component-local `<style>` blocks and [`src/index.css`](src/index.css) (Canada.ca-aligned tokens: `--gc-text`, `--gc-accent`, etc.)
- **Data:** Static assets under `public/`; Python scripts under `scripts/` for data retrieval (separate from the Vite app)

## Commands

| Command | Purpose |
|--------|---------|
| `npm ci` | Clean install (use in fresh clones / CI-style workspaces) |
| `npm run dev` | Local dev server |
| `npm run build` | Production build — **must pass before PR / Human Review** |
| `npm run lint` | ESLint — run when changing `.js` / `.jsx` |

## Layout (pages)

- **Page components:** [`src/pages/Page*.jsx`](src/pages) — one file per factbook page where possible.
- **Sections:** [`src/components/SectionOne.jsx`](src/components/SectionOne.jsx) … `SectionSix.jsx` lazy-load pages for each sidebar section; [`SectionTest.jsx`](src/components/SectionTest.jsx) for test layouts.
- **Routing:** [`src/App.jsx`](src/App.jsx) — `HashRouter` routes: `/`, `section-1` … `section-6`, `section-test`, `Glossary`.
- **Navigation:** [`src/components/Sidebar.jsx`](src/components/Sidebar.jsx) — adding a page often requires a sidebar entry and matching route/section imports.
- **Translations:** [`src/utils/translations.js`](src/utils/translations.js) — `getText('key', lang)`; add **English and French** keys for user-visible copy.
- **Glossary:** [`src/components/Glossary.jsx`](src/components/Glossary.jsx) for term definitions.

## Branching (Symphony / Linear)

- **One issue → one branch:** `linear/ENG-123-short-slug` (use your team’s issue prefix).
- **Base:** Always branch from latest `origin/main`; use the `pull` skill before implementation.
- **Parallel builds:** Assign different page files to different issues when possible. Shared files (`Sidebar.jsx`, `App.jsx`, `translations.js`, `index.css`) cause merge conflicts if edited concurrently — coordinate in the Linear issue or serialize those changes.

## Definition of done (typical page task)

1. Implement or update the relevant `PageNN.jsx` (and sidebar/route/translations if required).
2. `npm run build` succeeds.
3. `npm run lint` clean for touched files (or fix new violations).
4. No secrets committed; use `.env` only locally (see `.gitignore`).

## Remote

- Default GitHub remote for clones: `https://github.com/pierrenelson/NRCan_Energy_Fact_Book.git` — use your fork or org URL in Symphony `WORKFLOW.md` if different.
