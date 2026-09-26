# Deploying the Energy Factbook (static build)

This guide is for teams who **host the built website** on a web server. You do **not** need Node.js on the server.

If you **publish or refresh data** (StatCan, SQL pipeline, CSV export), see [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md) and the publisher sections below.

## What is in the zip

**Default archive** (`python scripts/zip_website_release.py`):

- **Built site only** — the contents of the Vite **`dist/`** output, packed at the **root** of the zip (`index.html`, `assets/`, `data/`, `glossary/`, …). There is **no** `src/`, `public/`, `package.json`, or other developer-only files.
- **`DEPLOYMENT.md`** — this file, at the zip root.

Unzip into a folder and point your web server at that folder (for the URL path configured in `base` — see below). You can also upload the extracted files without an extra `dist/` subfolder.

**Optional developer handoff** (`python scripts/zip_website_release.py --full`):

- Produces a **larger** zip (`*-website-full-*.zip`) that also includes **`dist/`**, **`src/`**, **`public/`**, `package.json`, `vite.config.js`, etc., for teams who need to run `npm ci` / `npm run build` locally.

## URL base path (important)

The app is configured with a **fixed public path** in [`vite.config.js`](../vite.config.js):

```js
base: '/NRCan_Energy_Fact_Book/'
```

Built assets and routes assume the site is available at:

`https://<your-host>/NRCan_Energy_Fact_Book/`

If you deploy at a **different path**, links and lazy-loaded chunks will break until you change `base`, run `npm ci` and `npm run build`, and ship a new build.

If you deploy at the **domain root** (`https://example.com/`), you must set `base: '/'`, rebuild, and use that new `dist/`.

## Quick deploy (default zip)

1. Unzip the archive to a folder on the server (or your machine before upload). The folder should contain **`index.html`** at the top level.
2. Map that folder to URL path **`/NRCan_Energy_Fact_Book/`** on your web server (see examples below).
3. Ensure the server serves `index.html` for client-side routes (SPA fallback) under that prefix.

## nginx example

Serve the unzipped folder at `/NRCan_Energy_Fact_Book/`:

```nginx
location /NRCan_Energy_Fact_Book/ {
    alias /var/www/factbook/;
    try_files $uri $uri/ /NRCan_Energy_Fact_Book/index.html;
}
```

Adjust `/var/www/factbook/` to where you unzipped the files (the directory that contains `index.html`).

## IIS (Windows Server)

1. Create a site or application under a path such as **`/NRCan_Energy_Fact_Book`**.
2. Point the **physical path** to the folder where you unzipped the archive (the folder that contains **`index.html`**).
3. Add a **URL Rewrite** rule so requests that do not match a file are rewritten to `index.html` (typical SPA setup).

## Data-only updates (without rebuilding)

If you receive **`nrcan-energy-factbook-data-*.zip`**, it contains **`public/data/`**, **`public/glossary/`**, and **`src/utils/translations.js`** (repo-style paths).

On a server where you deployed the **default** website zip (flat `data/` and `glossary/` next to `index.html`):

- Copy new CSVs into **`data/`** and **`glossary/`** on the server, replacing existing files.

**Translations:** UI strings are **compiled into the JavaScript bundle**. Changing only `translations.js` requires a **new build** and a new website zip from the publisher. The data zip alone cannot update bundled English/French copy on a static host.

## Deep links (BrowserRouter / SPA fallback)

The app uses **BrowserRouter** with `basename` from Vite `import.meta.env.BASE_URL` (see [`App.jsx`](../src/App.jsx)). Paths are clean (`/section-1`) instead of hash-based (`/#/section-1`). [`vite.config.js`](../vite.config.js) sets `base: '/NRCan_Energy_Fact_Book/'` for GitHub Pages.

Deep links require the host to serve `index.html` for unknown paths:

- [`public/404.html`](../public/404.html) — GitHub Pages custom 404: stores the requested path in `sessionStorage` and redirects to the app base.
- [`index.html`](../index.html) — on load, restores the stored path via `history.replaceState`.
- [`public/spa-redirect.html`](../public/spa-redirect.html) — optional helper for hosts that support custom error pages.

When deploying with full rewrite rules (Azure Static Web Apps, nginx `try_files`, etc.), configure all routes to `index.html` and the 404 shim is not required.

Chrome-less nesting for a host page: see [EMBED_MODE.md](EMBED_MODE.md) (`?embed=1`).

## Security and caching

The Fact Book ships as a **static SPA**. Security headers and framing policy are enforced by the **host** (CDN, Kubernetes ingress, reverse proxy)—not by the React app itself.

**Required**

- Serve over **HTTPS** only.
- **Deny framing by default** (`X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`).
- Allow framing only with an explicit allowlist if chrome-less embed mode is approved (see [EMBED_MODE.md](EMBED_MODE.md)).

**Caching**

- Long-cache hashed assets under `/assets/` (immutable filenames from Vite).
- Enable **gzip** and/or **Brotli** at the edge.
- Do not long-cache `index.html` (short TTL or `no-cache`) so clients pick up new entry chunks.

**Data files:** charts read same-origin files under `public/data/` (or deployed `data/`). Restrict who can write those files in deploy; prefer checksummed release artifacts.

**Secrets:** pipeline SQL/cloud credentials must **never** ship in the website artifact.

### Recommended Content-Security-Policy (sketch)

Tighten further for production after measuring needed origins:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: blob:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

Fonts are self-hosted in the app bundle. Prefer not allowing `fonts.googleapis.com` / `fonts.gstatic.com`.

### nginx: compression + cache headers

```nginx
# Brotli/gzip (requires ngx_brotli or gzip module)
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_min_length 256;

location /NRCan_Energy_Fact_Book/assets/ {
    alias /var/www/factbook/assets/;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location = /NRCan_Energy_Fact_Book/index.html {
    alias /var/www/factbook/index.html;
    add_header Cache-Control "no-cache";
}
```

### Azure Static Web Apps

Configure `staticwebapp.config.json` at the site root for SPA fallback and optional global headers (HTTPS is automatic). Example:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/data/*", "/glossary/*"]
  },
  "globalHeaders": {
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "mimeTypes": {
    ".json": "application/json"
  }
}
```

### Kubernetes ingress (headers sketch)

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header X-Frame-Options "DENY" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
      add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
```

Allow `frame-ancestors` only for approved embed origins if chrome-less iframe hosting is required.

## Asset size and build budgets

Prefer compressed modern formats for new page assets:

- Raster heroes: WebP (or AVIF) under ~300 KB where quality allows; avoid multi‑MB PNG in `src/assets/`.
- SVG: do not embed large base64 bitmaps when a linked image works.
- Proof / reference PNGs at the repo root should not be committed.

After `npm run build`, run:

```bash
npm run check:bundle      # soft JS / Plotly chunk budget
npm run compress:assets   # lossless recompress of large PNGs (rewrites when savings exist)
npm run lighthouse:ci     # accessibility + total-byte-weight budgets (needs a built site)
```

CI also runs these gates where configured in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Build the zip yourself (publishers)

From the repository root, with Node.js installed:

```bash
python scripts/zip_website_release.py
```

This runs **`npm run build`**, then zips **only** the deployable build + **`DEPLOYMENT.md`**.

Developer handoff (includes source and `package.json`):

```bash
python scripts/zip_website_release.py --full
```

Pack an existing **`dist/`** without running npm:

```bash
python scripts/zip_website_release.py --skip-build
```

`--skip-build` requires `dist/index.html` to already exist.

---

## Deployment options and current defaults

The post-handover deployment path is **not yet finalized**. This section documents what exists today and the options to choose from.

### Current defaults (repository)

| Mechanism | Location | Behaviour |
|-----------|----------|-----------|
| **GitHub Pages** | [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | Auto-build and deploy on push to `main`; manual `workflow_dispatch` supported |
| **`homepage` in package.json** | [`package.json`](../package.json) | Points to a personal GitHub Pages URL (placeholder until org URL is confirmed) |
| **Vite `base` path** | [`vite.config.js`](../vite.config.js) | `/NRCan_Energy_Fact_Book/` — must match server URL path |
| **Static release zip** | [`scripts/zip_website_release.py`](../scripts/zip_website_release.py) | Production handoff for CCEI / internal IIS or nginx |
| **Data-only zip** | [`scripts/zip_data_release.py`](../scripts/zip_data_release.py) | CSV + glossary overlay without full rebuild |

### Options for post-handover (client to decide)

1. **CCEI static host (primary)** — Publish the website zip to internal IIS/nginx. Keep GitHub Pages for development or demo only.
2. **Azure DevOps CI/CD (primary)** — Pipeline builds on merge and deploys artifacts to CCEI; disable or manual-trigger GitHub Pages.
3. **Parallel** — Both GitHub Pages and CCEI until cutover is complete.

### Open items when a path is chosen

- Replace personal `homepage` URL with the production URL
- Set Vite `base` to match the production URL path (or `/` if served at domain root)
- Add approval gate before production deploy (if required)
- Define who runs the **data pipeline** (`eedas update` → `efb transform` → `export`) vs who publishes **website zips**
- Wire [`azure-pipelines.template.yml`](../azure-pipelines.template.yml) to the chosen agent pool and hosting target — see [EFB_MODERNIZATION_REVIEW.md §7–8](EFB_MODERNIZATION_REVIEW.md#7-sql-and-database-refresh-environment)

### Scheduled data pipeline (Azure DevOps)

The template [`azure-pipelines.template.yml`](../azure-pipelines.template.yml) optional **RefreshData** stage runs all three pipeline stages when `RunDataRefresh=true`:

```bash
python main.py eedas update --all
python main.py efb transform --all
python main.py export
```

- **Fails the job** if any stage exits non-zero (at least one source or indicator failed).
- **Retries once** after 5 minutes on failure (transient StatCan/OEE outages) — re-runs all three stages.
- Requires SQL Server credentials and `EXTERNAL_XLSX_DATA_DIR` via variable group `NRCanFactbookSecrets`.

After a pipeline run, inspect `scripts/logs/last_refresh_summary.json` and `python main.py status --failed-only`.

**Roles:**

| Role | Typical actions |
|------|-----------------|
| Data publisher | Run EEDAS update / EFB transform / export; ship data-only zip or commit CSVs |
| Website publisher | Run `npm run build`; ship website zip via `zip_website_release.py` |
| Hosting team | Deploy static zip; overlay data-only updates into `data/` and `glossary/` |

### Website build vs data-only updates

| Update type | Requires `npm run build`? | Delivery |
|-------------|---------------------------|----------|
| CSV / glossary data | No | Data-only zip → copy into deployed `data/` and `glossary/` |
| UI copy (`translations.js`) | **Yes** | New website zip |
| New pages or chart code | **Yes** | New website zip |
