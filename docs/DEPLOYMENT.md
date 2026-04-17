# Deploying the Energy Factbook (static build)

This guide is for teams who receive a **website release zip** (`nrcan-energy-factbook-website-*.zip`) and need to host the app on a web server. You do **not** need Node.js on the server if you deploy only the built files under **`dist/`**.

## What is in the zip

The archive contains:

- **`dist/`** — Production build from `npm run build`. **This is what the web server should serve** for a static deployment.
- **`src/`**, **`public/`**, `package.json`, `vite.config.js`, etc. — Source tree for developers who may rebuild locally.

## URL base path (important)

The app is configured with a **fixed public path** in [`vite.config.js`](../vite.config.js):

```js
base: '/NRCan_Energy_Fact_Book/'
```

Built assets and routes assume the site is available at:

`https://<your-host>/NRCan_Energy_Fact_Book/`

If you deploy at a **different path**, links and lazy-loaded chunks will break until you change `base`, run `npm ci` and `npm run build`, and ship a new build.

If you deploy at the **domain root** (`https://example.com/`), you must set `base: '/'`, rebuild, and use that new `dist/`.

## Quick deploy (static files only)

1. Unzip the archive on a machine that has the files (or upload `dist/` to the server).
2. Configure the web server so the **document root** for this app is the **`dist`** folder, exposed at path **`/NRCan_Energy_Fact_Book/`** (see examples below).
3. Ensure the server serves `index.html` for client-side routes (SPA fallback) for paths under that prefix.

The entry file is **`dist/index.html`**.

## nginx example

Serve the contents of `dist` at `/NRCan_Energy_Fact_Book/`:

```nginx
location /NRCan_Energy_Fact_Book/ {
    alias /var/www/factbook/dist/;
    try_files $uri $uri/ /NRCan_Energy_Fact_Book/index.html;
}
```

Adjust `/var/www/factbook/dist/` to where you placed `dist` on disk. Test `base` matches this location.

## IIS (Windows Server)

1. Create a site or application under a path such as **`/NRCan_Energy_Fact_Book`**.
2. Point the **physical path** to the **`dist`** folder inside your unpacked release.
3. Add a **URL Rewrite** rule so requests that do not match a file are rewritten to `index.html` (typical SPA setup).

Use the IIS URL Rewrite module and a rule similar to “rewrite to index.html for non-file requests” scoped to that application.

## Data-only updates (without rebuilding)

If you receive **`nrcan-energy-factbook-data-*.zip`**, it contains **`public/data/`**, **`public/glossary/`**, and **`src/utils/translations.js`** using repository-relative paths.

On a server where you only deployed **`dist/`**:

- Copy **`public/data/*`** over **`dist/data/`** (replace files).
- Copy **`public/glossary/*`** over **`dist/glossary/`**.

**Translations:** UI strings live in `src/utils/translations.js` and are **compiled into the JavaScript bundle**. Changing only `translations.js` requires a **new build** (`npm run build`) and a new **`dist/`**, or a new website zip from the publisher. The data zip alone cannot update bundled English/French copy on a static host.

## Security and caching

- Serve over **HTTPS** in production.
- Use normal static caching headers for hashed files under `dist/assets/`; avoid caching `index.html` aggressively if you roll out updates often.

## Build the zip yourself (publishers)

From the repository root, with Node.js installed:

```bash
python scripts/zip_website_release.py
```

This runs **`npm run build`** then zips `dist/` plus source. To pack an existing `dist/` without running npm:

```bash
python scripts/zip_website_release.py --skip-build
```

`--skip-build` requires `dist/index.html` to already exist.
