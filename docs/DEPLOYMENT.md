# Deploying the Energy Factbook (static build)

This guide is for teams who receive a **website release zip** and need to host the app on a web server. You do **not** need Node.js on the server.

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

## Security and caching

- Serve over **HTTPS** in production.
- Use normal static caching headers for hashed files under `assets/`; avoid caching `index.html` aggressively if you roll out updates often.

## Large images

Some background images under `assets/` can be large (for example hero images). Consider compressing or resizing source assets before the next `npm run build` if page load is a concern.

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
