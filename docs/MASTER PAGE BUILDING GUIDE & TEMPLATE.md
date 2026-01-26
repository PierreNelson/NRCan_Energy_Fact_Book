# MASTER PAGE BUILDING GUIDE & TEMPLATE

**Version:** 3.0 (Updated January 2026)  
**Compliance:** WCAG 2.1 AA, WET-BOEW (Web Experience Toolkit)

---

## Code Standards

**NO COMMENTS IN CODE:** Do not add comment lines to the codebase. Code should be self-documenting through clear variable names, function names, and structure. This keeps the codebase clean and reduces maintenance overhead.

---

## Naming Conventions

### URL Hash Fragments (Navigation)

**Do NOT use page numbers in URLs.** Use descriptive section titles instead.

**URL Format:** All sections follow the pattern `/section-N#page-name`

```javascript
// WRONG - Page numbers are not meaningful to users
<NavLink to="/#page-8">Provincial GDP</NavLink>
<NavLink to="/section-2#page-24">Capital Expenditure</NavLink>

// CORRECT - Descriptive names with consistent section format
<NavLink to="/section-1#energy-overview">Energy Overview</NavLink>
<NavLink to="/section-1#provincial-gdp">Provincial GDP</NavLink>
<NavLink to="/section-2#capital-expenditure">Capital Expenditure</NavLink>
<NavLink to="/section-2#infrastructure-stock">Infrastructure Stock</NavLink>
```

**Section wrapper IDs must match the hash:**
```jsx
// SectionOne.jsx
<div id="energy-overview">
    <Page1 />
</div>
<div id="provincial-gdp">
    <Page8 />
</div>

// SectionTwo.jsx
<div id="capital-expenditure">
    <Page24 />
</div>
```

### Data Vector Naming (`data_retrieval.py` and `dataLoader.js`)

**Do NOT use page numbers in data vector names.** Use descriptive prefixes that represent the data content.

```python
# WRONG - Page numbers make vectors hard to understand and maintain
'page24_oil_gas', 'page24_electricity', 'page24_total'
'page28_total_projects', 'page28_total_value'

# CORRECT - Semantic prefixes describe the data
'capex_oil_gas', 'capex_electricity', 'capex_total'
'projects_total_count', 'projects_total_value'
```

**Standard Vector Prefixes:**
| Prefix | Data Category | Example Vectors |
|--------|--------------|-----------------|
| `capex_` | Capital expenditures | `capex_oil_gas`, `capex_electricity`, `capex_total` |
| `infra_` | Infrastructure stock | `infra_fuel_energy_pipelines`, `infra_transport` |
| `econ_` | Economic contributions | `econ_jobs`, `econ_gdp`, `econ_employment_income` |
| `asset_` | Investment by asset type | `asset_pipelines`, `asset_nuclear`, `asset_wind_solar` |
| `intl_` | International investment | `intl_cdia`, `intl_fdi` |
| `foreign_` | Foreign control | `foreign_utilities`, `foreign_oil_gas` |
| `enviro_` | Environmental protection | `enviro_oil_gas_total`, `enviro_electric_total` |
| `gdp_prov_` | Provincial GDP | `gdp_prov_ab`, `gdp_prov_on`, `gdp_prov_qc` |
| `projects_` | Major energy projects | `projects_oil_gas_value`, `projects_total_count` |
| `cleantech_` | Clean technology trends | `cleantech_hydro_value`, `cleantech_wind_count` |
| `projectsmap_` | Projects map (static) | Used for static map visualization data |

**Function Naming in `data_retrieval.py`:**
```python
# WRONG - Page numbers
def process_page24_data():
def process_page28_data():

# CORRECT - Descriptive names
def process_capital_expenditure_data():
def process_major_projects_data():
```

**Why This Matters:**
- Page numbers can change during reorganization
- Descriptive names are self-documenting
- Makes code easier to understand and maintain
- Improves searchability in the codebase

---

## 1. The Core Layout Philosophy (The Anchor System)

We use a JavaScript-driven Anchor System instead of media queries for page margins.

**Logic:** `Layout.jsx` calculates the exact pixel distance of the Canadian Flag (Left) and the Language Button (Right). These values are passed to pages via `useOutletContext`.

**Implementation:** The page wrapper "breaks out" of the parent container using negative margins (to allow full-bleed backgrounds) and then "pads in" the content using the calculated anchor values.

### The CSS Pattern (Required in every page)

```javascript
const { lang, layoutPadding } = useOutletContext();

// ... inside render ...
<style>{`
    .page-main {
        width: calc(100% + ${layoutPadding.left}px + ${layoutPadding.right}px);
        margin-left: -${layoutPadding.left}px;
        margin-right: -${layoutPadding.right}px;
        display: flex;
        flex-direction: row;
    }

    .page-container {
        padding-left: ${layoutPadding.left}px;
        padding-right: ${layoutPadding.right}px;
        width: 100%;
        box-sizing: border-box;
    }

    @media (max-width: 1100px) {
        .page-main {
            flex-direction: column;
        }
        .chart-container, .data-table-button {
            width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
        }
    }
`}</style>
```

---

## 2. Required Imports

Every page with charts should include these imports:

```javascript
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
```

---

## 3. Standard State Variables

```javascript
const { lang, layoutPadding } = useOutletContext();
const [year, setYear] = useState(null);
const [pageData, setPageData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
const [isTableOpen, setIsTableOpen] = useState(false);
const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
const [selectedPoints, setSelectedPoints] = useState(null);  // For bar charts
const [selectedSlices, setSelectedSlices] = useState(null);  // For pie charts
const chartRef = useRef(null);
```

---

## 4. Helper Functions

### Strip HTML Tags
```javascript
const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
```

### Hex to RGBA (for dimming unselected elements)
```javascript
const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};
```

### Format Number (locale-aware)
```javascript
const formatNumber = (num) => {
    if (num === undefined || num === null) return '—';
    return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
};
```

---

## 5. Year Selector (Dropdown - NOT Slider)

Use a `<select>` dropdown instead of a range slider:

```jsx
<div className="year-selector">
    <label id="year-label" htmlFor="year-select">
        {getText('year_slider_label', lang)}
    </label>
    <select
        id="year-select"
        value={year || maxYear}
        onChange={(e) => setYear(parseInt(e.target.value))}
        aria-labelledby="year-label"
    >
        {allData.map(yearData => (
            <option key={yearData.year} value={yearData.year}>
                {yearData.year}
            </option>
        ))}
    </select>
</div>
```

### Year Selector CSS
```css
.year-selector {
    display: flex;
    align-items: center;
    margin: 10px 0;
    padding: 2px 0;
    position: relative;
    z-index: 10;
}

.year-selector label {
    font-weight: bold;
    margin-right: 15px;
    font-size: 18px;
    font-family: Arial, sans-serif;
}

.year-selector select {
    padding: 8px 12px;
    font-size: 16px;
    font-family: Arial, sans-serif;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #fff;
    cursor: pointer;
    min-width: 100px;
}

.year-selector select:hover {
    border-color: #007bff;
}

.year-selector select:focus {
    outline: 2px solid #005fcc;
    outline-offset: 2px;
    border-color: #007bff;
}
```

---

## 6. Chart Interaction System

### Desktop vs Mobile Behavior
- **Desktop (>768px):** Charts are interactive by default, mode bar visible
- **Mobile (≤768px):** Charts are interactive by default, mode bar shows on interaction

### Mobile Page Scrolling (dragmode)

On mobile devices, swiping on a chart can trigger zoom/pan instead of scrolling the page. To fix this, set `dragmode` conditionally in the layout prop:

```javascript
layout={{
    // Disable drag-to-zoom on mobile so page scrolling works naturally
    dragmode: windowWidth <= 768 ? false : 'zoom',
    // ... other layout settings
}}
```

**How it works:**
- **Desktop (>768px):** `dragmode: 'zoom'` allows click-and-drag to zoom, standard mouse behavior
- **Mobile (≤768px):** `dragmode: false` disables chart drag handling, allowing swipe gestures to scroll the page naturally

This must be applied to ALL `<Plot />` components in the codebase.

### Window Resize Handler
```javascript
useEffect(() => {
    const handleResize = () => {
        const newWidth = window.innerWidth;
        setWindowWidth(newWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Clear Selection Button

The Clear button must be positioned at `right: 295` to avoid overlapping with the Plotly modebar buttons (zoom controls, download PNG button). This ensures both the Clear button and modebar remain accessible and usable.

```jsx
<div ref={chartRef} className="chart-container" style={{ position: 'relative' }}>
    {selectedPoints !== null && (
        <button onClick={() => setSelectedPoints(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>
            {lang === 'en' ? 'Clear' : 'Effacer'}
        </button>
    )}

    <Plot ... />
</div>
```

---

## 7. Single/Multi-Select Click Behavior

### Bar Charts - onClick Handler
```javascript
onClick={(data) => {
    if (data.points && data.points.length > 0) {
        const clickedPoint = data.points[0];
        const seriesIndex = clickedPoint.curveNumber;
        const pointIndex = clickedPoint.pointIndex;

        setSelectedPoints(prev => {
            if (prev === null) {
                const newSelection = Array(3).fill(null).map(() => []);
                newSelection[seriesIndex] = [pointIndex];
                return newSelection;
            }
            const newSelection = prev.map(arr => arr ? [...arr] : []);
            const currentSeriesSelection = newSelection[seriesIndex] || [];
            if (currentSeriesSelection.includes(pointIndex)) {
                newSelection[seriesIndex] = currentSeriesSelection.filter(i => i !== pointIndex);
            } else {
                newSelection[seriesIndex] = [...currentSeriesSelection, pointIndex];
            }
            const allEmpty = newSelection.every(arr => !arr || arr.length === 0);
            return allEmpty ? null : newSelection;
        });
    }
}}
```

### Pie Charts - onClick Handler
```javascript
onClick={(data) => {
    if (data.points && data.points.length > 0) {
        const sliceIndex = data.points[0].pointNumber ?? data.points[0].pointIndex;
        if (sliceIndex === undefined) return;

        setSelectedSlices(prev => {
            if (prev === null) return [sliceIndex];
            if (prev.includes(sliceIndex)) {
                const newSelection = prev.filter(i => i !== sliceIndex);
                return newSelection.length === 0 ? null : newSelection;
            }
            return [...prev, sliceIndex];
        });
    }
}}
```

### Visual Dimming (Bar Chart Example)
```javascript
marker: { 
    color: colors.oil_gas,
    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[0]?.includes(i) ? 1 : 0.3)
}
```

### Visual Dimming (Pie Chart Example)
```javascript
marker: {
    colors: (() => {
        if (selectedSlices === null) return baseColors;
        return baseColors.map((color, i) => 
            selectedSlices.includes(i) ? color : hexToRgba(color, 0.3)
        );
    })()
}
```

### Mobile Double-Tap Pattern for Hover Labels

On mobile devices, single tap immediately triggers the selection/focus behavior, causing hover labels to disappear instantly. To fix this, implement a "Single Tap to Hover, Double Tap to Select" pattern.

**Required Ref:**
```javascript
const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
// For pie charts/maps: useRef({ time: 0, index: null });
```

**Updated onClick Handler (Bar Charts):**
```javascript
onClick={(data) => {
    if (!data.points || data.points.length === 0) return;
    const clickedPoint = data.points[0];
    const traceIndex = clickedPoint.curveNumber;
    const pointIndex = clickedPoint.pointIndex;

    // Mobile: require double-tap to select (single tap shows hover only)
    if (windowWidth <= 768) {
        const currentTime = new Date().getTime();
        const lastClick = lastClickRef.current;
        const isSamePoint = (traceIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex);
        const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
        
        lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
        
        if (!isDoubleTap) {
            return; // Single tap: show hover label only
        }
    }

    // Selection logic continues here...
    setSelectedPoints(prev => {
        // ... existing selection logic
    });
}}
```

**Updated onClick Handler (Pie Charts/Maps):**
```javascript
onClick={(data) => {
    if (!data.points || data.points.length === 0) return;
    const sliceIndex = data.points[0].pointNumber ?? data.points[0].pointIndex;
    if (sliceIndex === undefined) return;

    // Mobile: require double-tap to select (single tap shows hover only)
    if (windowWidth <= 768) {
        const currentTime = new Date().getTime();
        const lastClick = lastClickRef.current;
        const isSamePoint = (sliceIndex === lastClick.index);
        const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
        
        lastClickRef.current = { time: currentTime, index: sliceIndex };
        
        if (!isDoubleTap) {
            return; // Single tap: show hover label only
        }
    }

    // Selection logic continues here...
    setSelectedSlices(prev => {
        // ... existing selection logic
    });
}}
```

**Behavior Summary:**
- **Desktop**: Single click selects/focuses elements (unchanged)
- **Mobile (≤768px)**:
  - **Single tap**: Shows hover label only (no selection)
  - **Double tap** (same point within 300ms): Triggers selection/focus

---

## 8. Custom PNG Download with Title

**IMPORTANT:** The downloaded PNG should use the **chart title**, not the page title. If the chart has a dynamic title (e.g., with year range), construct it the same way as the displayed chart title.

**Chart Title Examples:**
- Static chart title: `getText('page31_chart_title', lang)`
- Dynamic with year range: `` `${getText('page27_chart_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}` ``
- With year and subtitle: `` `${getText('page37_chart_title', lang)} (${year}, ${getText('page37_chart_subtitle', lang)})` ``

```javascript
const downloadChartWithTitle = async (plotEl = null) => {
    const plotElement = plotEl || document.querySelector('.chart-container .js-plotly-plot') || chartRef.current?.querySelector('.js-plotly-plot');
    if (!plotElement) {
        alert('Could not find chart element. Please try again.');
        return;
    }

    // Use chart title (not page title) for downloaded image
    const title = stripHtml(chartTitle); // or getText('pageXX_chart_title', lang)

    try {
        if (!window.Plotly) {
            alert('Plotly library not loaded. Please refresh the page and try again.');
            return;
        }

        const imgData = await window.Plotly.toImage(plotElement, {
            format: 'png',
            width: 1200,
            height: 800,
            scale: 2
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            const titleHeight = 80;
            canvas.width = img.width;
            canvas.height = img.height + titleHeight;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#333333';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(title, canvas.width / 2, 50);

            ctx.drawImage(img, 0, titleHeight);

            const link = document.createElement('a');
            link.download = lang === 'en' ? `chart_${year}.png` : `graphique_${year}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        img.src = imgData;
    } catch (error) {
        console.error('Error downloading chart:', error);
        alert('Error downloading chart: ' + error.message);
    }
};
```

---

## 9. Data Table Downloads (CSV & DOCX)

### CSV Download
```javascript
const downloadTableAsCSV = () => {
    if (!pageData || pageData.length === 0) return;

    const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
    const headers = [
        lang === 'en' ? 'Year' : 'Année',
        `Category 1 ${unitHeader}`,
        `Category 2 ${unitHeader}`,
        `Total ${unitHeader}`
    ];

    const rows = pageData.map(yearData => [
        yearData.year,
        (yearData.value1 / 1000).toFixed(2),
        (yearData.value2 / 1000).toFixed(2),
        (yearData.total / 1000).toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = lang === 'en' ? 'chart_data.csv' : 'donnees_graphique.csv';
    link.click();
    URL.revokeObjectURL(link.href);
};
```

### DOCX Download

**Important Configuration:**
- **Text size:** Use `size: 22` for all cell text (11pt in Word)
- **Title size:** Use `size: 28` for the document title (14pt in Word)
- **Header shading:** Add `shading: { fill: 'E6E6E6' }` to header cells for visual distinction
- **Column widths:** Always specify `columnWidths` array in twips (1440 twips = 1 inch). Common patterns:
  - 3 columns: `[1800, 3700, 3700]`
  - 5 columns: `[1200, 2000, 2000, 2000, 1800]`
  - 7 columns: `[1200, 1300, 1300, 1300, 1300, 1300, 1300]`
  - 8 columns: `[1100, 1150, 1150, 1150, 1150, 1150, 1150, 1150]`

```javascript
const downloadTableAsDocx = async () => {
    if (!pageData || pageData.length === 0) return;

    const title = stripHtml(getText('page_title', lang));
    const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';

    const headers = [
        lang === 'en' ? 'Year' : 'Année',
        `Category 1 ${unitHeader}`,
        `Category 2 ${unitHeader}`
    ];

    // Header row with shading for visual distinction
    const headerRow = new TableRow({
        children: headers.map(header => new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text: header, bold: true, size: 22 })],
                alignment: AlignmentType.CENTER
            })],
            shading: { fill: 'E6E6E6' }
        }))
    });

    // Data rows
    const dataRows = pageData.map(yearData => new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.value1 / 1000).toFixed(2), size: 22 })], alignment: AlignmentType.RIGHT })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.value2 / 1000).toFixed(2), size: 22 })], alignment: AlignmentType.RIGHT })] })
        ]
    }));

    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({
                    children: [new TextRun({ text: title, bold: true, size: 28 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 300 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    columnWidths: [1800, 3700, 3700], // Adjust based on number of columns
                    rows: [headerRow, ...dataRows]
                })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, lang === 'en' ? 'chart_data.docx' : 'donnees_graphique.docx');
};
```

### Download Buttons in Data Table
```jsx
<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
    <button
        onClick={() => downloadTableAsCSV()}
        style={{
            padding: '8px 16px',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            color: '#333'
        }}
    >
        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
    </button>
    <button
        onClick={() => downloadTableAsDocx()}
        style={{
            padding: '8px 16px',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            color: '#333'
        }}
    >
        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
    </button>
</div>
```

---

## 10. Data Table Structure (WET Compliant)

**IMPORTANT:** WET guidelines advise against merged cells (`rowSpan`/`colSpan` spanning data) as they cause accessibility issues like double-reading. Use the pattern below to avoid merged cells while maintaining a clean visual layout.

### 10.1 Table Structure for Multi-Level Headers

For tables with grouped columns (e.g., categories with sub-columns for value/count):

```jsx
<details 
    className="data-table-wrapper"
    onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
>
    <summary role="button" aria-expanded={isTableOpen}>
        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
        {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
    </summary>
    <div className="table-responsive" role="region" style={{ overflowX: 'auto' }}>
        <table className="table table-striped table-hover">
            <caption className="wb-inv">
                {lang === 'en' 
                    ? 'Data by year (values in billions of dollars, project counts)' 
                    : 'Données par année (valeurs en milliards de dollars, nombre de projets)'}
            </caption>
            <thead>
                {/* ROW 1: Category group headers + Empty spacer for Year column */}
                <tr>
                    {/* Empty cell instead of rowSpan - avoids merged cell issues */}
                    <td style={{ borderBottom: 'none' }} aria-hidden="true"></td>
                    <th scope="colgroup" colSpan={2} className="text-center" style={{ fontWeight: 'bold' }}>
                        {category1Label}
                    </th>
                    <th scope="colgroup" colSpan={2} className="text-center" style={{ fontWeight: 'bold' }}>
                        {category2Label}
                    </th>
                </tr>
                {/* ROW 2: Sub-headers + Year header */}
                <tr>
                    <th scope="col" className="text-center" style={{ fontWeight: 'bold', borderTop: 'none' }}>
                        {lang === 'en' ? 'Year' : 'Année'}
                    </th>
                    <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right' }}>
                        <span aria-hidden="true">{headerUnitValueVisual}</span>
                        <span className="wb-inv">{headerUnitValueSR}</span>
                    </th>
                    <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right' }}>
                        <span aria-hidden="true">{headerUnitProjectsVisual}</span>
                        <span className="wb-inv">{headerUnitProjectsSR}</span>
                    </th>
                    {/* Repeat for other categories... */}
                </tr>
            </thead>
            <tbody>
                {pageData.map(d => (
                    <tr key={d.year}>
                        {/* Row header for year */}
                        <th scope="row" className="text-center" style={{ fontWeight: 'bold' }}>
                            {d.year}
                        </th>
                        {/* Data cells with aria-label for controlled reading */}
                        <td 
                            className="text-right" 
                            style={{ textAlign: 'right' }} 
                            aria-label={`${d.year}, ${category1Label}, ${lang === 'en' ? 'value' : 'valeur'}: ${d.cat1_value} ${cellUnitValueSR}`}
                        >
                            {d.cat1_value}
                        </td>
                        <td 
                            className="text-right" 
                            style={{ textAlign: 'right' }} 
                            aria-label={`${d.year}, ${category1Label}, ${lang === 'en' ? 'count' : 'nombre'}: ${d.cat1_count} ${cellUnitCountSR}`}
                        >
                            {d.cat1_count}
                        </td>
                        {/* Repeat for other categories... */}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
    {/* Download buttons here */}
</details>
```

### 10.2 Simple Table Structure (Single-Level Headers)

For simpler tables without grouped columns:

```jsx
<table className="table table-striped table-hover">
    <caption className="wb-inv">
        {lang === 'en' ? 'Data table description' : 'Description du tableau de données'}
    </caption>
    <thead>
        <tr>
            <th scope="col" className="text-center" style={{ fontWeight: 'bold' }}>
                {lang === 'en' ? 'Year' : 'Année'}
            </th>
            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right' }}>
                <span aria-hidden="true">{headerUnitVisual}</span>
                <span className="wb-inv">{headerUnitSR}</span>
            </th>
        </tr>
    </thead>
    <tbody>
        {pageData.map(d => (
            <tr key={d.year}>
                <th scope="row" className="text-center" style={{ fontWeight: 'bold' }}>{d.year}</th>
                <td 
                    className="text-right" 
                    style={{ textAlign: 'right' }}
                    aria-label={`${d.year}, ${categoryLabel}: ${d.value} ${cellUnitSR}`}
                >
                    {d.value}
                </td>
            </tr>
        ))}
    </tbody>
</table>
```

---

## 11. Plotly Chart Configuration

### Standard Config Object
```javascript
config={{
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
    scrollZoom: false,
    modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
    modeBarButtonsToAdd: [{
        name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
        icon: { ... },
        click: () => downloadChartWithTitle()
    }]
}}
```

### Pie Chart Specific Layout
```javascript
layout={{
    showlegend: true,
    legend: { orientation: windowWidth <= 480 ? 'h' : 'v', x: windowWidth <= 480 ? 0.5 : 1.02, xanchor: windowWidth <= 480 ? 'center' : 'left' },
    clickmode: 'event',
    dragmode: false,
    margin: { l: 20, r: 20, t: 20, b: 20 }
}}
```

---

## 12. Accessibility Standards (WCAG 2.1 AA Compliance)

### 12.1 Main Container Requirements
```jsx
<main id="main-content" tabIndex="-1" className="page-content page-main" role="main">
```
- `role="main"` - identifies the main content area
- `id="main-content"` - allows skip-to-content links
- `tabIndex="-1"` - allows programmatic focus

### 12.2 Currency Formatting for Screen Readers

Screen readers may mispronounce currency symbols (e.g., "$159B" reads as "dollar 159 b"). Always provide screen-reader-friendly alternatives.

```javascript
// Helper function for screen-reader currency formatting
const formatBillionSR = (num) => {
    if (num === undefined || num === null) return '';
    const rounded = Math.round(num);
    return lang === 'en' 
        ? `${rounded} billion dollars` 
        : `${rounded} milliards de dollars`;
};

// Visual display helper (keeps $ symbol)
const formatBillion = (num) => {
    if (num === undefined || num === null) return '—';
    return `$${Math.round(num)}B`;
};
```

### 12.3 Hiding Visual Elements from Screen Readers

Use `aria-hidden="true"` on decorative or redundant visual content that shouldn't be read by screen readers.

**When to use:**
- Decorative icons or images
- Visual legends (provide text alternatives)
- Bold/styled text that duplicates content in aria-label
- Chart visual elements (provide summary instead)

### 12.4 Screen Reader-Only Text (`wb-inv` class)

The WET `wb-inv` class makes content invisible to sighted users but accessible to screen readers.

```jsx
// Screen reader-only chart title
<h2 className="wb-inv">{stripHtml(getText('chart_title', lang))}</h2>

// Screen reader-only table caption
<caption className="wb-inv">
    {lang === 'en' ? 'Data table description' : 'Description du tableau'}
</caption>

// Screen reader-only instructions
<span className="wb-inv">
    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
</span>
```

### 12.5 Chart Accessibility Pattern

Charts need special handling to:
1. Hide the complex SVG graphics from screen readers (prevent reading individual shapes)
2. Provide an accessible summary of the chart data
3. Make the modebar download button focusable and accessible to screen readers

#### Required useEffect for Chart Accessibility

Add this useEffect to make the Plotly modebar button accessible while hiding chart graphics:

```javascript
// Make Plotly modebar accessible while hiding chart graphics from screen readers
useEffect(() => {
    if (!chartRef.current) return;
    
    const setupChartAccessibility = () => {
        const plotContainer = chartRef.current;
        if (!plotContainer) return;

        // Hide the chart SVG graphics from screen readers
        const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
        svgElements.forEach(svg => {
            svg.setAttribute('aria-hidden', 'true');
        });

            // Process modebar buttons - hide all except download button
            // Other buttons (zoom, pan, etc.) aren't useful for screen reader users
            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach(btn => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
                    // Make download button accessible
                    btn.setAttribute('aria-label', dataTitle);
                    btn.setAttribute('role', 'button');
                    btn.setAttribute('tabindex', '0');
                    btn.removeAttribute('aria-hidden');
                } else {
                    // Hide other buttons from screen readers (zoom, pan, etc. aren't useful without vision)
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };

    // Run after a short delay to ensure Plotly has rendered
    const timer = setTimeout(setupChartAccessibility, 500);
    
    // Also set up a MutationObserver to handle dynamic changes
    const observer = new MutationObserver(setupChartAccessibility);
    if (chartRef.current) {
        observer.observe(chartRef.current, { childList: true, subtree: true });
    }

    return () => {
        clearTimeout(timer);
        observer.disconnect();
    };
}, [pageData, lang]);
```

#### Chart HTML Structure

```jsx
// Provide accessible summary of chart data
const getChartSummary = () => {
    const dataPoints = pageData.map(d => `${d.year}: ${formatNumber(d.value)}`).join(', ');
    return lang === 'en'
        ? `Chart showing trends from ${minYear} to ${maxYear}. Data points: ${dataPoints}.`
        : `Graphique montrant les tendances de ${minYear} à ${maxYear}. Données: ${dataPoints}.`;
};

// Chart structure - DO NOT use aria-hidden on figure (handled by useEffect)
<div className="chart-wrapper">
    {/* Visual title (hidden from SR) */}
    <h2 className="chart-title" aria-hidden="true">{getText('chart_title', lang)}</h2>
    
    {/* SR-only title */}
    <h2 className="wb-inv">{stripHtml(getText('chart_title', lang))}</h2>
    
    {/* Accessible region with chart summary */}
    <div role="region" aria-label={getChartSummary()}>
        {/* Figure without aria-hidden - useEffect handles SVG hiding */}
        <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
            <Plot ... />
        </figure>
    </div>
</div>
```

**Important:** 
- Do NOT add `aria-hidden="true"` to the `<figure>` element - the useEffect selectively hides only the SVG graphics
- This allows the Plotly modebar (including the PNG download button) to remain accessible
- The screen reader will focus the actual Plotly modebar button when users Tab through the page

### 12.6 Dynamic Chart Titles with Year Ranges

Chart titles that include year ranges **MUST** be computed dynamically from the data rather than hardcoded in translation strings. This ensures titles automatically update when new data is added.

**Translation String Pattern:**
Use a `_prefix` suffix for the translation key and store only the text before the year range:

```javascript
// translations.js - English
'page_chart_title_prefix': 'Trends in Major Energy Projects, ',

// translations.js - French  
'page_chart_title_prefix': 'Tendances des grands projets énergétiques, ',
```

**Component Implementation:**
Construct the full title by appending the year range from the data:

```javascript
const years = pageData.map(d => d.year);
const minYear = years.length > 0 ? Math.min(...years) : 2021;
const maxYear = years.length > 0 ? Math.max(...years) : 2024;

// Dynamic chart title
const chartTitle = `${getText('page_chart_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;

// Use chartTitle in JSX and downloads
<h2>{chartTitle}</h2>
```

**Why This Matters:**
- Hardcoded years like "2007-2025" become outdated when new data is added
- Dynamic titles automatically reflect the actual data range
- Consistent pattern across all pages ensures maintainability

### 12.7 Bullet Point Accessibility Pattern

For narrative text with bolded values, use `aria-label` on the list item and `aria-hidden` on visual content to prevent duplicate reading.

```jsx
<ul className="page-bullets">
    <li aria-label={lang === 'en' 
        ? `In 2024, there were 300 major energy projects worth 159 billion dollars announced, under review, or approved.`
        : `En 2024, il y avait 300 grands projets énergétiques d'une valeur de 159 milliards de dollars annoncés, à l'étude ou approuvés.`
    }>
        <span aria-hidden="true">
            In 2024, there were <strong>300</strong> major energy projects 
            (announced, under review, or approved) worth <strong>$159B</strong>.
        </span>
    </li>
</ul>
```

**Key points:**
- `aria-label` contains the full text with screen-reader-friendly number formatting
- Visual `<span aria-hidden="true">` wraps content with `<strong>` tags
- Screen readers read the `aria-label`, not the visual content
- Include ALL text in aria-label (parenthetical content is often skipped otherwise)

### 12.7 Data Table Accessibility Pattern

Tables must use the correct header pattern for WET/WCAG compliance while providing clear screen reader output.

**Key Principles:**

1. **Use proper `<th>` tags with `scope` attributes** - Required for WCAG 1.3.1 compliance
2. **Avoid merged cells (`rowSpan`)** - WET advises against merged cells as they cause double-reading issues
3. **Use `aria-label` on data cells** - Provides complete control over what the screen reader says for each cell

**The Solution:**

For tables with grouped column headers (e.g., categories with value/count sub-columns):

```jsx
<table className="table table-striped table-hover">
    <caption className="wb-inv">
        {lang === 'en' 
            ? 'Data by year (values in billions of dollars, project counts)' 
            : 'Données par année (valeurs en milliards de dollars, nombre de projets)'}
    </caption>
    <thead>
        {/* ROW 1: Category headers + Empty spacer (instead of rowSpan) */}
        <tr>
            <td style={{ borderBottom: 'none' }} aria-hidden="true"></td>
            <th scope="colgroup" colSpan={2} className="text-center" style={{ fontWeight: 'bold' }}>
                {category1Label}
            </th>
            <th scope="colgroup" colSpan={2} className="text-center" style={{ fontWeight: 'bold' }}>
                {category2Label}
            </th>
        </tr>
        {/* ROW 2: Sub-headers + Year header */}
        <tr>
            <th scope="col" className="text-center" style={{ fontWeight: 'bold', borderTop: 'none' }}>
                {lang === 'en' ? 'Year' : 'Année'}
            </th>
            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right' }}>
                <span aria-hidden="true">{headerUnitValueVisual}</span>
                <span className="wb-inv">{headerUnitValueSR}</span>
            </th>
            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right' }}>
                <span aria-hidden="true">{headerUnitCountVisual}</span>
                <span className="wb-inv">{headerUnitCountSR}</span>
            </th>
            {/* Repeat for category2... */}
        </tr>
    </thead>
    <tbody>
        {pageData.map(d => (
            <tr key={d.year}>
                {/* Row header */}
                <th scope="row" className="text-center" style={{ fontWeight: 'bold' }}>{d.year}</th>
                
                {/* Data cells with aria-label for controlled reading */}
                <td 
                    className="text-right" 
                    style={{ textAlign: 'right' }}
                    aria-label={`${d.year}, ${category1Label}, ${lang === 'en' ? 'value' : 'valeur'}: ${d.cat1_value} ${cellUnitValueSR}`}
                >
                    {d.cat1_value}
                </td>
                <td 
                    className="text-right" 
                    style={{ textAlign: 'right' }}
                    aria-label={`${d.year}, ${category1Label}, ${lang === 'en' ? 'count' : 'nombre'}: ${d.cat1_count} ${cellUnitCountSR}`}
                >
                    {d.cat1_count}
                </td>
                {/* Repeat for category2... */}
            </tr>
        ))}
    </tbody>
</table>
```

**Why this works:**

1. **No merged cells** - The Year column uses an empty `<td aria-hidden="true">` in row 1 with `borderBottom: 'none'`, and the actual `<th>` in row 2 with `borderTop: 'none'`. This looks like a merged cell visually but screen readers see simple unmerged cells.

2. **Proper `<th>` with `scope`** - Satisfies WCAG 1.3.1 requirement that headers be programmatically identified:
   - `scope="colgroup"` for category group headers
   - `scope="col"` for sub-column headers  
   - `scope="row"` for year row headers

3. **`aria-label` on data cells** - Completely overrides the screen reader's default reading behavior. Each cell announces exactly: "Year, Category, type: value unit" (e.g., "2024, Oil and gas, value: 296 billion dollars")

**Key points:**
- Do NOT use `rowSpan` on the Year header - use the empty cell + border trick instead
- `aria-label` takes precedence over cell content for screen readers
- Header sub-columns should have visual units (`aria-hidden`) and SR-friendly units (`wb-inv`)

### 12.8 Custom Legend Accessibility

Custom HTML legends should be hidden from screen readers (chart summary provides the information).

```jsx
<div className="custom-legend" aria-hidden="true">
    <div className="legend-group">
        <div className="legend-group-title">Category A</div>
        <div className="legend-items">
            <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#1f77b4' }}></span>
                <span>Item 1</span>
            </div>
            {/* More items... */}
        </div>
    </div>
</div>
```

### 12.9 Sidebar/Definition Box Accessibility

Content in sidebars that provides important context MUST be readable by screen readers.

```jsx
<div className="sidebar">
    <div className="sidebar-title">{getText('sidebar_title', lang)}</div>
    {/* This paragraph must NOT have aria-hidden */}
    <p>{getText('sidebar_important_text', lang)}</p>
    <p>
        Minimum capital thresholds: 
        <strong>$50M</strong> for oil and gas,
        <strong>$25M</strong> for electricity.
    </p>
</div>
```

**Warning:** Do not accidentally add `aria-hidden="true"` to important informational content like threshold values or definitions.

---

## 13. Data Retrieval Best Practices (`data_retrieval.py`)

### 13.1 Dynamic Future Dates for StatCan API URLs

**IMPORTANT:** Never hardcode future end dates in StatCan API URLs. Hardcoded dates like `endDate=20301231` will cause the script to fail after that date passes.

**Solution:** Use the `get_future_end_date()` helper function to generate dates dynamically:

```python
from datetime import datetime, timedelta

def get_future_end_date(years_ahead=2):
    """
    Generate a future end date for StatCan API requests.
    
    StatCan URLs use future end dates to ensure all available data is returned.
    The API returns whatever data exists up to the current date, regardless of 
    the end date specified. Using a dynamic future date (today + N years) ensures:
    - New data is automatically included when StatCan publishes it
    - The script doesn't stop working after a hardcoded date passes
    
    Args:
        years_ahead: Number of years into the future (default: 2)
    
    Returns:
        Date string in YYYYMMDD format (e.g., "20280125" for 2 years from Jan 25, 2026)
    """
    future_date = datetime.now() + timedelta(days=365 * years_ahead)
    return future_date.strftime("%Y%m%d")
```

**Usage in URL functions:**

```python
# WRONG - Hardcoded date will eventually expire
def get_data_url():
    return "https://www150.statcan.gc.ca/...&endDate=20301231&..."

# CORRECT - Dynamic date that always works
def get_data_url():
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/...&endDate={end_date}&..."
```

**Why this matters:**
- StatCan API ignores future dates and returns all available data up to today
- Using `today + 2 years` ensures the URL remains valid indefinitely
- New data is automatically included without code changes

---

## 14. Footnotes (WET Style)

```jsx
<aside className="wb-fnote" role="note">
    <h2 className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
    <dl>
        <dt>*</dt>
        <dd id="fn1">
            <p>{getText('footnote_text', lang)}</p>
        </dd>
    </dl>
</aside>
```

---

## 15. Page Template Summary

```javascript
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getPageData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const PageTemplate = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    
    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    const formatNumber = (num) => {
        if (num === undefined || num === null) return '—';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    // Resize handler
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            setWindowWidth(newWidth);
            if (newWidth > 768) setIsChartInteractive(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Click outside handler (mobile)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (windowWidth <= 768 && isChartInteractive && chartRef.current && !chartRef.current.contains(event.target)) {
                setIsChartInteractive(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChartInteractive, windowWidth]);

    // Data loading
    useEffect(() => {
        getPageData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) setYear(data[data.length - 1].year);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Download functions
    const downloadChartWithTitle = async () => { /* ... */ };
    const downloadTableAsCSV = () => { /* ... */ };
    const downloadTableAsDocx = async () => { /* ... */ };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <main id="main-content" tabIndex="-1" className="page-content page-main" role="main">
            <style>{`
                .page-main {
                    width: calc(100% + ${layoutPadding.left}px + ${layoutPadding.right}px);
                    margin-left: -${layoutPadding.left}px;
                    margin-right: -${layoutPadding.right}px;
                }
                .page-container {
                    padding-left: ${layoutPadding.left}px;
                    padding-right: ${layoutPadding.right}px;
                    width: 100%;
                    box-sizing: border-box;
                }
            `}</style>

            <div className="page-container">
                <header>
                    <h1>{getText('page_title', lang)}</h1>
                </header>

                {/* Year Selector Dropdown */}
                <div className="year-selector">
                    <label htmlFor="year-select">{getText('year_slider_label', lang)}</label>
                    <select id="year-select" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                        {pageData.map(d => <option key={d.year} value={d.year}>{d.year}</option>)}
                    </select>
                </div>

                {/* Chart with interaction controls */}
                <div ref={chartRef} className="chart-container" style={{ position: 'relative' }}>
                    {/* Clear button positioned at right: 295 to avoid modebar overlap */}
                    <Plot
                        data={[/* chart data */]}
                        layout={{/* layout config */}}
                        config={{
                            displayModeBar: true,
                            displaylogo: false,
                            responsive: true
                        }}
                        onClick={(data) => {/* selection handler */}}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '500px' }}
                    />
                </div>

                {/* Data Table with CSV/DOCX downloads */}
                <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                    <summary>{lang === 'en' ? 'Chart data table' : 'Tableau de données'}</summary>
                    <table>{/* table content */}</table>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button onClick={downloadTableAsCSV}>Download CSV</button>
                        <button onClick={downloadTableAsDocx}>Download DOCX</button>
                    </div>
                </details>

                {/* Footnotes */}
                <aside className="wb-fnote" role="note">
                    <h2 className="wb-inv">Footnotes</h2>
                    <dl><dt>*</dt><dd><p>{getText('footnote', lang)}</p></dd></dl>
                </aside>
            </div>
        </main>
    );
};

export default PageTemplate;
```

---

