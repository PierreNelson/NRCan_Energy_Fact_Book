# Page Creation Guide

This guide gives a step-by-step process for creating a new page in the NRCan Energy Factbook. It documents every common pattern so new pages are built consistently. The **data pipeline** (scripts, CSVs, metadata) is covered in a separate guide.

---

## 1. Where Pages Live and How They Are Wired

### Routing and layout

- Pages are **not** routed individually. Each **Section** (SectionOne, SectionTwo, etc.) is the route content and renders a **stack of pages** inside a single scrollable view.
- **Layout** (`src/components/Layout.jsx`) renders `<Outlet context={{ lang, layoutPadding }} />`. The Section is the Outlet’s child, so every page component must use `useOutletContext()` to get `{ lang, layoutPadding }` (or only `lang` if layout padding is not used).
- Section files (e.g. `src/components/SectionOne.jsx`) import each page and render it inside a wrapper:

```jsx
<div id="section-anchor-id" className="stacked-page-wrapper">
    <PageN />
</div>
```

The `id` is used for sidebar navigation (hash links).

### Steps to add a new page

1. **Create the page component** in `src/pages/` (e.g. `PageNN.jsx`).
2. **Import and render it** in the correct Section component:
   - Open `src/components/SectionOne.jsx` (or SectionTwo, etc.).
   - Add: `import PageNN from '../pages/PageNN';`
   - Add a wrapper in the JSX: `<div id="your-anchor-id" className="stacked-page-wrapper"><PageNN /></div>`. Use a unique, kebab-case `id` that matches the page’s topic (e.g. `employment`, `primary-energy-by-region`).
3. **Add the sidebar link** in `src/components/Sidebar.jsx`: inside the appropriate section’s NavLinks, add a link to the same section path with hash, e.g. `to="/section-1#your-anchor-id"` and label from translations.
4. **Add nav text** in `src/utils/translations.js` (e.g. `nav_employment`, `nav_primary_energy_region`) in both `en` and `fr` if the sidebar label is translated.

**Reference:** `src/App.jsx`, `src/components/Layout.jsx`, `src/components/SectionOne.jsx`, `src/components/Sidebar.jsx`.

---

## 2. Common Page Structure and Chrome

### Imports (typical)

```jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
// If the page has DOCX/CSV download:
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
```

### Context

```jsx
const { lang, layoutPadding } = useOutletContext();
```

Use `layoutPadding` when the page uses the full-bleed alignment pattern (content aligns with header); otherwise `lang` alone is fine.

### Root element

Every page’s root should be:

```jsx
<main
    id="main-content"
    tabIndex="-1"
    className="page-content page-N"
    role="main"
    aria-label={getText('pageN_title', lang)}
    style={{
        backgroundColor: 'white',
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        boxSizing: 'border-box',
    }}
>
```

Replace `page-N` with the actual page number class (e.g. `page-8`, `page-31`).

### Layout padding (when used)

For pages that extend content to the edges to align with the header, add a class in the page’s `<style>` block:

```css
.page-N {
    margin-left: -${layoutPadding?.left || 55}px;
    width: calc(100% + ${layoutPadding?.left || 55}px);
    padding-left: ${layoutPadding?.left || 55}px;
}
/* If right alignment is also used: */
.page-N {
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${layoutPadding?.right || 15}px);
    padding-right: ${layoutPadding?.right || 15}px;
}
```

**Reference:** Page 9, Page 31.

### Title

```jsx
<h1 className="pageN-title">
    {getText('pageN_title', lang)}
</h1>
```

Many pages add a red bar under the title via CSS:

```css
.pageN-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.pageN-title {
    position: relative;
    padding-bottom: 0.5em;
    /* ... other title styles */
}
```

### Subtitle

```jsx
<p className="pageN-subtitle">
    {getText('pageN_subtitle', lang)}
</p>
```

If the subtitle contains a footnote asterisk, split or render it with the same footnote-link pattern used for chart titles (see Section 12).

### Optional bullets

Some pages (e.g. Page 31) have a bullet list under the subtitle. Use a `<ul className="pageN-bullets" role="list">` with `<li role="listitem">` items. Bullet text can be built from translation parts (e.g. `page32_bullet1_part1`, …) and dynamic values (year, totals, etc.). Use `aria-label` on each `<li>` for the full read-out and `<span className="visual-bold">` for bold segments. **Reference:** Page 31.

---

## 3. Translations

### Convention

- All user-visible strings come from `src/utils/translations.js` via `getText(key, lang)`.
- Keys are namespaced by page: `pageN_title`, `pageN_subtitle`, `pageN_chart_title`, `pageN_footnote`, etc.
- Chart titles that include a footnote use `*` in the string where the asterisk link should go (e.g. `"Chart title with footnote*"`).
- Each key must exist in both `TRANSLATIONS.en` and `TRANSLATIONS.fr`.

### Keys a typical page needs

| Key | Purpose |
|-----|---------|
| `pageN_title` | Page title (h1) |
| `pageN_subtitle` | Subtitle paragraph |
| `pageN_chart_title` | Chart heading (may contain `*` for footnote) |
| `pageN_footnote` | Footnote text |
| `pageN_footnote_*` | Optional extra footnotes (e.g. `pageN_footnote_2024`) |
| Chart data table | Use literal or key: "Chart data table" / "Tableau de données du graphique" |
| Clear selection | "Clear selection" / "Effacer la sélection" |
| Download chart | "Download chart as PNG" / "Télécharger le graphique en PNG" |
| Showing data for | "Showing data for" / "Données affichées pour" (year dropdown) |
| Press Enter to open/close | " Press Enter to open or close." / " Appuyez sur Entrée pour ouvrir ou fermer." (table summary) |

Add new keys in both the `'en'` and `'fr'` blocks in `translations.js`, keeping the same key name.

---

## 4. Chart Frame and Plotly Modebar

### Chart wrapper

Wrap each chart in a frame and give the plot a ref:

```jsx
<div className="pageN-chart-frame">
    <h2 className="pageN-chart-title">
        {getText('pageN_chart_title', lang)}
        {/* or renderTextWithFootnoteLink(getText('pageN_chart_title', lang)) if footnote */}
    </h2>
    <div role="region" aria-label={getChartDataSummary()} tabIndex="0">
        <figure ref={chartRef} className="pageN-chart" style={{ margin: 0, position: 'relative' }}>
            <Plot ... />
        </figure>
    </div>
</div>
```

**Frame CSS** (in the page’s `<style>` block):

```css
.pageN-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
}
.pageN-chart {
    width: 100%;
    height: 400px; /* or calc() for responsive */
    position: relative;
    z-index: 1;
}
```

### Modebar (global and config)

- **Global styles** in `src/index.css` control modebar visibility, width (min-content), hiding empty groups, and download icon centering. Pages do **not** need to add modebar CSS for the standard look.
- **Per-chart config** for “single download button” charts:

```jsx
config={{
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
    scrollZoom: false,
    modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d', 'zoom2d', 'pan2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d'],
    modeBarButtonsToAdd: [{
        name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
        icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
        click: (gd) => downloadChartWithTitle(gd)
    }]
}}
```

Adjust `modeBarButtonsToRemove` if the chart type supports zoom/pan (e.g. maps may keep some tools).

### Disabling scroll and zoom in chart area

- Set **`scrollZoom: false`** in `config` to prevent scroll-zoom inside the chart.
- In **layout**, set **`dragmode: windowWidth <= 768 ? false : 'zoom'`** (or `false` for both) so that on mobile the chart does not capture drag for zoom. This avoids accidental scrolling/zooming inside the chart area.

**Reference:** Page 8, Page 27, Page 31, `src/index.css` (modebar section).

---

## 5. Custom Download Chart as PNG

### Pattern

1. Get the plot DOM: `chartRef.current?.querySelector('.js-plotly-plot')`.
2. Call `window.Plotly.toImage(plotElement, { format: 'png', width: 800, height: 600, scale: 2 })`.
3. Draw the image on a canvas; add a **title line** (and optionally a **legend** if not in the plot) using the chart title text. Use `stripHtml(getText('pageN_chart_title', lang))` so the title has no HTML or asterisk.
4. Create a download link and set `link.download` to the filename; trigger click; revoke object URL if used.

### stripHtml helper

```js
const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
```

Use this before drawing the title on the canvas and in DOCX/CSV titles where needed.

### Example: download with title and legend (pie)

```js
const downloadChartWithTitle = async (chartRef, title, data) => {
    const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
    if (!plotElement) return;
    try {
        if (!window.Plotly) return;
        const imgData = await window.Plotly.toImage(plotElement, {
            format: 'png',
            width: 800,
            height: 600,
            scale: 2
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            const titleHeight = 80;
            const legendHeight = 150;
            canvas.width = img.width;
            canvas.height = img.height + titleHeight + legendHeight;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(stripHtml(title), canvas.width / 2, 50);
            ctx.drawImage(img, 0, titleHeight);
            // Optional: draw legend items here
            const link = document.createElement('a');
            link.download = lang === 'en' ? 'primary_energy_production.png' : 'production_energie_primaire.png';
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        img.src = imgData;
    } catch (error) {
        console.error('Error downloading chart:', error);
    }
};
```

### Filename format

- **Pattern:** `[chart_title_slug]_[chart|map]_[year or range].png` (EN) and equivalent French slug.
- **Examples:**
  - Single chart, no year: `primary_energy_production.png` / `production_energie_primaire.png`
  - By year: `employment_map_${year}.png` / `emploi_carte_${year}.png`
  - Chart with range in title: `capital_expenditures_chart.png` / `depenses_en_capital_graphique.png`

**Reference:** Page 4, Page 8, Page 9, Page 24, Page 27, Page 31.

---

## 6. Download DOCX and CSV; DOCX Table Widths

### CSV download

1. Build headers and rows from the same data as the visible table.
2. `const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');`
3. `const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });`
4. Create an `<a>`, set `link.href = URL.createObjectURL(blob)`, `link.download = 'page_slug_data.csv'` (or with year), `link.click()`, then `URL.revokeObjectURL(link.href)`.

Use EN/FR filenames (e.g. `employment_data.csv` / `donnees_emploi.csv`).

### DOCX download

- Use the `docx` library and `saveAs` from `file-saver`.
- **Document structure:** One section with:
  - A title `Paragraph`: centered, bold, size 28 (e.g. chart title or page title).
  - A `Table` with `rows` (header row + data rows).

**Column widths:**

- Use the `columnWidths` array on the Table. Values are in DXA (twips).
- **Common patterns:**
  - First column wider (labels): 2500 or 1500; data columns equal: 1100 or 2500.
  - Page 8 (one label column, one column per year): `columnWidths: [2500, ...allData.map(() => 1100)]`
  - Page 11 (fixed columns): `columnWidths: [1500, 2500, 2500, 2500]`
- Table width: `width: { size: 100, type: WidthType.PERCENTAGE }`.

**Filename:** Chart/page title slug + `_table.docx` (EN) or `_tableau.docx` (FR); include year when data is year-specific (e.g. `provincial_gdp_table.docx`).

**Reference:** Page 8, Page 11, Page 9.

---

## 7. Chart Accessibility (Modebar and Screen Readers)

### setupChartAccessibility and MutationObserver

Run after the chart mounts and whenever chart data or lang changes. Use a **MutationObserver** because Plotly often re-creates the modebar.

```js
useEffect(() => {
    if (!chartRef.current) return;

    const setupChartAccessibility = () => {
        const plotContainer = chartRef.current;
        if (!plotContainer) return;

        const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
        svgElements.forEach(svg => {
            svg.setAttribute('aria-hidden', 'true');
        });

        const downloadBtn = plotContainer.querySelector(
            '.modebar-btn[data-title*="Download"], .modebar-btn[data-title*="Télécharger"]'
        );

        if (downloadBtn) {
            downloadBtn.setAttribute('tabindex', '0');
            downloadBtn.setAttribute('role', 'button');
            const title = downloadBtn.getAttribute('data-title');
            if (title) downloadBtn.setAttribute('aria-label', title);
            downloadBtn.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    downloadBtn.click();
                }
            };
        }

        const otherButtons = plotContainer.querySelectorAll('.modebar-btn');
        otherButtons.forEach(btn => {
            const dataTitle = btn.getAttribute('data-title');
            if (!dataTitle || (!dataTitle.includes('Download') && !dataTitle.includes('Télécharger'))) {
                btn.setAttribute('aria-hidden', 'true');
                btn.setAttribute('tabindex', '-1');
            }
        });
    };

    const observer = new MutationObserver(setupChartAccessibility);
    observer.observe(chartRef.current, { childList: true, subtree: true });
    setupChartAccessibility();

    return () => observer.disconnect();
}, [chartData, lang]);
```

### Chart region

Wrap the figure in a div that has:

- `role="region"`
- `aria-label={getChartDataSummary()}`
- `tabIndex="0"`

`getChartDataSummary()` should return a short prose summary of the chart (e.g. “Stacked bar chart showing public and private investment from 2010 to 2024. Total investment in 2024 was approximately X billion dollars.”). Provide EN and FR versions based on `lang`.

**Reference:** Page 8, Page 27, Page 31.

---

## 8. Select / Multiselect to Focus and “Clear selection” Button

### State

- **Bar/line:** `const [selectedPoints, setSelectedPoints] = useState(null);` — when not null, use an array of arrays: `[[pointIndex, ...], [pointIndex, ...]]` per trace, or the structure your Plot expects for `selectedpoints`.
- **Pie:** `const [selectedSlices, setSelectedSlices] = useState(null);` — array of slice indices (e.g. `[0, 2]`) or null.

### Plot onClick

- Read `data.points[0]` to get `curveNumber` (trace index) and `pointIndex` (or `pointNumber` for pie).
- **Mobile (e.g. windowWidth <= 768):** Use a `lastClickRef` to detect double-tap on the same point: if the same point is clicked again within ~300 ms, toggle it; otherwise do nothing (hover only).
- **Desktop:** Toggle the point/slice in/out of the selection; if the selection becomes empty, set state to `null`.

### Plotly trace options

- **selectedpoints:** Set to the array of selected point indices for that trace (e.g. `selectedPoints[traceIndex]` or the slice indices for pie).
- **selected / unselected:** Use to style selected vs unselected (e.g. `marker.opacity: 1` vs `0.3`, or for pie `pull` larger for selected slices).

### Clear selection button

When `selectedPoints !== null` (or `selectedSlices !== null`), render a button **above** the chart:

```jsx
{selectedPoints !== null && (
    <div style={{ marginBottom: 8 }}>
        <button
            type="button"
            onClick={() => setSelectedPoints(null)}
            style={{
                padding: '6px 12px',
                backgroundColor: '#26374a',
                border: '1px solid #26374a',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'Arial, sans-serif',
                fontSize: 14,
                color: '#fff'
            }}
        >
            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
        </button>
    </div>
)}
```

**Reference:** Page 4, Page 8, Page 9, Page 24, Page 27, Page 31, Page 32.

---

## 9. Pie Charts: Custom Labels and “Labels Follow Category When Year Changes”

### Custom labels

- **text:** Optional array of strings to show (can include HTML for bold).
- **texttemplate:** e.g. `'%{label}<br><b>%{percent:.0%}</b>'` for outside; `'%{percent:.0%}'` for inside.
- **textinfo:** `'label+percent'` (outside) or `'percent'` (inside).
- **textposition:** `'outside'` or `'inside'`.
- **textfont / outsidetextfont / insidetextfont:** size, family (e.g. `'Arial, sans-serif'`), color (e.g. `'#221e1f'` for outside, `'#ffffff'` for inside).
- **pull:** Array of numbers (e.g. `0.02` for all; increase for selected slice, e.g. `0.08`).
- **hole:** `0` or `0.55` for donut.
- **sort:** `false` so order matches data.

### Layout switch at higher zoom (smaller viewport)

- Use a breakpoint (e.g. `windowWidth <= 768` or `useCompactLayout`).
- **Compact (inside):** `textposition: 'inside'`, `textinfo: 'percent'`, `texttemplate: '%{percent:.0%}'`, smaller `textfont`, white text.
- **Wide (outside):** `textposition: 'outside'`, `textinfo: 'label+percent'`, label + bold percent, larger font.

This gives “labels on pie” at small viewports and “labels outside / legend-like” at larger.

### Labels follow category when year changes

- Chart data must be **derived from the selected year**. In a `useMemo`, take the dataset for the **current year** (e.g. `currentYearData` or `dataByYear[year]`), then build trace `values`, `labels`, `text`, and `hovertext` from that.
- Dependencies should include `year`, `lang`, `windowWidth`, and the data for that year. When the user changes the year, the same categories keep the same order and label positions; only values and percentages change.

Example pattern:

```js
const chartData = useMemo(() => {
    if (!currentYearData) return null;
    return createChartData(currentYearData, selectedSlices);
}, [currentYearData, selectedSlices, lang, windowWidth]);
// where currentYearData = allData.find(d => d.year === year) || allData[allData.length - 1]
```

**Reference:** Page 4, Page 9, Page 16, Page 48, Page 49.

---

## 10. Year Dropdown

### State and refs

```js
const [year, setYear] = useState(null); // or latest year
const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
const yearDropdownRef = useRef(null);
const yearButtonRef = useRef(null);
```

### Click outside to close

```js
useEffect(() => {
    const handleClickOutside = (event) => {
        if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
            setIsYearDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

### Trigger button

- Shows current year; `aria-pressed={isYearDropdownOpen}`; `onClick` toggles `isYearDropdownOpen`.
- When a year is chosen in the list: `setYear(yearData.year)`, `setIsYearDropdownOpen(false)`, then `setTimeout(() => yearButtonRef.current?.focus(), 0)`.

### Dropdown list

- List of **buttons** (one per year), e.g. `[...allData].sort((a, b) => b.year - a.year).map((yearData) => (...))`.
- Each button: `aria-pressed={year === yearData.year}`, `aria-label={yearData.year.toString()}`, `onClick` to set year and close.
- Style: full width, left-aligned, padding 10px 15px, border-bottom 1px solid #eee, background #f0f9ff when selected. Include a fake “radio” circle (filled when selected) for visual consistency.

### Screen reader

- A live region: `<div role="status" className="wb-inv" aria-live="polite">` with text like `{year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}`.

**Reference:** Page 8, Page 9.

---

## 11. Data Table (Chart Data Table) and Screen Reader Navigation

### Wrapper and toggle

```jsx
<div className="pageN-table-wrapper">
    <details
        className="pageN-data-table"
        onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
    >
        <summary role="button" aria-expanded={isTableOpen}>
            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
        </summary>
        ...
    </details>
</div>
```

### Horizontal scroll sync

- **Refs:** `topScrollRef`, `tableScrollRef`.
- **Top scroll bar:** A div with `ref={topScrollRef}`, `overflowX: 'auto'`, `overflowY: 'hidden'`, and a child spacer div whose width is set to the table’s `scrollWidth`. Sync scrollLeft of top bar and table container in both directions. Show top bar only when `table.offsetWidth > containerWidth`. Use `ResizeObserver` on the table and container to update the spacer width and visibility.

```js
useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;
    if (!topScroll || !tableScroll) return;

    const syncScrollbars = () => {
        const table = tableScroll.querySelector('table');
        if (!table) return;
        const scrollWidth = table.offsetWidth;
        const containerWidth = tableScroll.clientWidth;
        const topSpacer = topScroll.firstElementChild;
        if (topSpacer) topSpacer.style.width = `${scrollWidth}px`;
        if (scrollWidth > containerWidth) {
            topScroll.style.display = 'block';
            topScroll.style.opacity = '1';
        } else {
            topScroll.style.display = 'none';
        }
    };

    const handleTopScroll = () => { if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft; };
    const handleTableScroll = () => { if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft; };

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll);
    const observer = new ResizeObserver(() => requestAnimationFrame(syncScrollbars));
    const tableElement = tableScroll.querySelector('table');
    if (tableElement) observer.observe(tableElement);
    observer.observe(tableScroll);
    syncScrollbars();

    return () => {
        topScroll.removeEventListener('scroll', handleTopScroll);
        tableScroll.removeEventListener('scroll', handleTableScroll);
        observer.disconnect();
    };
}, [isTableOpen, windowWidth]);
```

### Table semantics

- **Caption:** `<caption className="wb-inv">` with a full descriptive sentence (e.g. “Energy sector direct nominal GDP by province/territory, 2019–2024 (millions of dollars)”).
- **Headers:** Use `<th scope="col">` and `<th scope="row">`. For unit headers (e.g. “($ millions)”), provide a visible span and a `wb-inv` span for “millions of dollars”.
- **Cells:** Add `aria-label={\`${rowLabel}, ${colLabel}: ${value} ${unit}\`}` on each `<td>` so screen reader users get full context.

**Reference:** Page 8, Page 27, Page 31.

---

## 12. Footnote Section and Linked Footnote Buttons

### Footnote block

```jsx
<aside className="wb-fnote" role="note">
    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
    <dl>
        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
        <dd id="fn-asterisk-pageN" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                <a href="#fn-asterisk-rf-pageN" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                </a>
                <p style={{ margin: 0 }}>{getText('pageN_footnote', lang)}</p>
            </div>
        </dd>
    </dl>
</aside>
```

Replace `pageN` with your page number. The return link targets `#fn-asterisk-rf-pageN` (the in-page reference span).

### Scroll handlers

```js
const scrollToFootnote = (e) => {
    e.preventDefault();
    document.getElementById('fn-asterisk-pageN')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const scrollToRef = (e) => {
    e.preventDefault();
    document.getElementById('fn-asterisk-rf-pageN')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
```

### Link from chart title (Option A: renderTextWithFootnoteLink)

If the chart title string contains `*`, split and inject the link:

```js
const renderTextWithFootnoteLink = (text) => {
    if (!text) return null;
    if (!text.includes('*')) return text;
    const parts = text.split('*');
    return parts.map((part, index) => (
        <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
                <span id="fn-asterisk-rf-pageN" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                    <a className="fn-lnk" href="#fn-asterisk-pageN" onClick={scrollToFootnote}>
                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                        <span aria-hidden="true">*</span>
                    </a>
                </span>
            )}
        </React.Fragment>
    ));
};
```

Use it for the chart title: `{renderTextWithFootnoteLink(getText('pageN_chart_title', lang))}`.

**Option B:** Some pages place the asterisk link manually next to the title with the same `id` and `href` conventions.

**Reference:** Page 24, Page 31, Page 33.

---

## 13. How to Build Each Chart Type

### Bar (single or grouped)

- **Trace:** `type: 'bar'`, `x`, `y`, `name`, `marker: { color }`.
- **Layout:** `barmode: 'group'`, `bargap`, `bargroupgap`, xaxis/yaxis (tickvals, showgrid, zeroline, etc.). Use `hovertext` and `hoverinfo: 'text'` for custom tooltips.
- **Selection:** Use `selectedpoints` and `marker.opacity` in selected/unselected; handle `onClick` and “Clear selection” as in Section 8.

**Reference:** Page 27, Page 24, Page 43.

### Pie

- **Trace:** `type: 'pie'`, `values`, `labels`, `text` / `texttemplate` / `textinfo`, `textposition`, `textfont` / `outsidetextfont` / `insidetextfont`, `marker.colors`, `marker.line`, `hole`, `sort: false`, `pull`.
- **Layout:** useCompactLayout for inside vs outside (Section 9). Optional `selectedpoints` and pull for selected slices.

**Reference:** Page 4, Page 9, Page 16, Page 48, Page 49, Page 52.

### Line / Scatter

- **Trace:** `type: 'scatter'`, `mode: 'lines'` or `'lines+markers'`, `x`, `y`, `name`, `line`, `marker`.
- **Layout:** Standard cartesian (xaxis, yaxis), `dragmode`, `scrollZoom: false` in config.

**Reference:** Page 11, Page 28.

### Choropleth + Scattergeo (map)

- **Choropleth:** `type: 'choropleth'`, `locationmode: 'geojson-id'`, `locations` (GeoJSON feature names), `z`, `text` for hover, `hoverinfo: 'text'`, `geojson` URL, `featureidkey: 'properties.name'`.
- **Labels:** Second trace `type: 'scattergeo'`, `mode: 'text'`, `lat`, `lon`, `text` (e.g. province abbrev + value). Use centroid coordinates; optional `highZoomOffsets` per region for small viewports.
- **Layout:** `geo: { scope, projection, center }`.

**Reference:** Page 8, Page 33.

### Stacked bar

- Same as bar with **`barmode: 'stack'`** and multiple traces. Control stacking order with trace order or `legendrank`. Use same selection pattern as grouped bar if needed.

**Reference:** Page 27, Page 25Stacked, Page 28Stacked.

---

## 14. Checklist and File Touch List

### Checklist

- [ ] Add page component to the correct Section (`src/components/SectionX.jsx`).
- [ ] Add sidebar link and nav text (`Sidebar.jsx`, `translations.js`).
- [ ] Add all translation keys (EN and FR) for title, subtitle, chart title, footnotes, table, buttons.
- [ ] Implement main/chrome: `<main>`, title, subtitle, optional bullets.
- [ ] Add chart frame + `<Plot>` with correct ref and layout.
- [ ] Implement download PNG (and filename convention).
- [ ] Set modebar config and `setupChartAccessibility` + MutationObserver.
- [ ] If table: details/summary, top-scroll sync, caption, aria-labels on cells.
- [ ] If footnotes: footnote block, title link (renderTextWithFootnoteLink or manual), scrollToFootnote / scrollToRef.
- [ ] If year dropdown: state, refs, click-outside, trigger, list, wb-inv status.
- [ ] If select/focus: selected state, onClick (with double-tap on mobile), Clear selection button.
- [ ] Pie-specific: useCompactLayout and year-driven data so labels follow category.

### File touch list

| File | When |
|------|------|
| `src/pages/PageNN.jsx` | New page component. |
| `src/components/SectionX.jsx` | Import and render `<PageNN />` in a wrapper with unique `id`. |
| `src/components/Sidebar.jsx` | Add NavLink to section and hash (e.g. `#your-anchor-id`). |
| `src/utils/translations.js` | Add all `pageN_*` and any `nav_*` keys in EN and FR. |
| `src/index.css` | Only if you need page-specific modebar/chart overrides (rare). |

---

## 15. Reference Pages Summary

| Topic | Example pages |
|-------|----------------|
| Routing, Section, context | App.jsx, Layout.jsx, SectionOne.jsx |
| Full structure, layout padding | Page 9, Page 31 |
| Pie, labels, year-driven data | Page 4, Page 9, Page 16, Page 48 |
| Download PNG + legend on canvas | Page 4 |
| setupChartAccessibility | Page 8, Page 27, Page 31 |
| Year dropdown | Page 8, Page 9 |
| Data table, scroll sync, aria-labels | Page 8 |
| DOCX column widths | Page 8, Page 11 |
| Footnotes, renderTextWithFootnoteLink | Page 24, Page 31 |
| Bar + selection | Page 27 |
| Map (choropleth + scattergeo) | Page 8, Page 33 |

Use these pages as the source for copying and adapting snippets when building a new page.
