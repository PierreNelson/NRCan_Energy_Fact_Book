# MASTER PAGE BUILDING GUIDE & TEMPLATE

**Version:** 4.0 (Updated January 2026)  
**Compliance:** WCAG 2.1 AA, WET-BOEW (Web Experience Toolkit), Canada.ca Design System

---

## AI INSTRUCTIONS (STRICT)

These rules are **non-negotiable** and must be followed exactly when generating page code.

1. **NO COMMENTS:** Do not add any comments (`//`, `/* */`) to the final output code.
2. **NAMING CONVENTION:** All CSS classes must follow `.page[[PAGE_NUMBER]]-element` pattern (e.g., `.page28-title`, `.page28-chart-frame`).
3. **COMPONENT NAMING:** Component name must be `Page[[PAGE_NUMBER]]` and export must be `export default Page[[PAGE_NUMBER]];`
4. **IMPORTS:** Always include these imports exactly:
   - `useOutletContext` from `react-router-dom`
   - `Plot` from `react-plotly.js`
   - `getText` from `../utils/translations`
5. **DATA LOADING:** Use the `useEffect` hook pattern shown in `[DATA_LOADING_PATTERN]` section.
6. **LAYOUT PADDING:** Always destructure `layoutPadding` from `useOutletContext()` and use in CSS template literals.
7. **BILINGUAL:** All user-facing text must use `getText('key', lang)` for EN/FR support.
8. **TOKEN REPLACEMENT:** Replace all `[[PLACEHOLDER]]` tokens with actual values before output.

---

## REQUIRED INPUTS

Before generating a page, confirm you have:

| Input | Description | Example |
|-------|-------------|---------|
| `[[PAGE_NUMBER]]` | The page number | `28` |
| `[[DATA_FUNCTION]]` | Data loader function name | `getMajorProjectsData` |
| `[[TRANSLATION_PREFIX]]` | Translation key prefix | `page28` |
| `[[CHART_TYPE]]` | Chart type | `bar`, `pie`, `line`, `map` |
| `[[TITLE_EN]]` | English page title | `Major Energy Projects` |
| `[[TITLE_FR]]` | French page title | `Grands projets énergétiques` |
| `[[HAS_YEAR_SELECTOR]]` | Whether page has year dropdown | `true` / `false` |
| `[[HAS_SIDEBAR]]` | Whether page has sidebar/definition box | `true` / `false` |

---

## DESIGN TOKENS (IMMUTABLE VALUES)

These values are **fixed** and must not be changed.

### Colors
```
--gc-background:    #FFFFFF
--gc-text:          #333333
--gc-link:          #284162
--gc-link-hover:    #0535d2
--gc-link-visited:  #7834bc
--gc-accent:        #26374A
--gc-error:         #d3080c
--gc-red:           #A62A1E
--frame-background: #f5f5f5
--title-color:      #245e7f
```

### Typography
| Element | Font | Size (Desktop) | Size (Mobile ≤768px) | Weight |
|---------|------|----------------|----------------------|--------|
| Page Title (H1) | Lato | 50px | 37px | bold |
| Chart Title (H2) | Lato | 29px | 26px | bold |
| Subtitle | Noto Sans | 20px | 18px | normal |
| Body | Noto Sans | 20px | 18px | normal |

### Spacing (STRICT)
| Element | Property | Value |
|---------|----------|-------|
| Page title | `margin-bottom` | `25px` |
| Subtitle | `margin-bottom` | `20px` |
| Chart frame | `padding` | `20px` |
| Chart frame | `margin-bottom` | `20px` |
| Chart frame | `border-radius` | `8px` |
| Data table | `margin-top` | `20px` |
| Data table | `margin-bottom` | `0` |
| Legend | `margin-top` | `20px` |
| Legend | `margin-bottom` | `20px` |

---

## [MANDATORY_CSS_BLOCK]

Copy this CSS block **verbatim** into every page file. Replace `[[PAGE_NUMBER]]` with actual page number.

```css
.page-[[PAGE_NUMBER]] {
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${layoutPadding?.right || 15}px);
    padding-right: ${layoutPadding?.right || 15}px;
}

.page[[PAGE_NUMBER]]-container {
    width: 100%;
    padding: 15px 0 0 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    flex: 1;
    overflow: visible;
}

.page[[PAGE_NUMBER]]-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px;
    font-weight: bold;
    color: #245e7f;
    margin-top: 0;
    margin-bottom: 25px;
    position: relative;
    padding-bottom: 0.5em;
}

.page[[PAGE_NUMBER]]-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}

.page[[PAGE_NUMBER]]-subtitle {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin-top: 0;
    margin-bottom: 20px;
    line-height: 1.5;
    max-width: 65ch;
}

.page[[PAGE_NUMBER]]-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    padding-bottom: 20px;
    border-radius: 8px;
    margin-top: 0;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}

.page[[PAGE_NUMBER]]-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin-top: 0;
    margin-bottom: 5px;
}

.page[[PAGE_NUMBER]]-chart {
    width: 100%;
    height: 400px;
    position: relative;
    z-index: 1;
}

.page[[PAGE_NUMBER]]-legend {
    display: flex;
    justify-content: center;
    gap: 30px;
    margin-top: 20px;
    margin-bottom: 20px;
    font-family: Arial, sans-serif;
    position: relative;
    z-index: 10;
    background-color: #f5f5f5;
    padding: 10px 0;
}

.page[[PAGE_NUMBER]]-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.page[[PAGE_NUMBER]]-legend-color {
    width: 20px;
    height: 12px;
    display: inline-block;
}

.page[[PAGE_NUMBER]]-legend-label {
    font-size: 18px;
    color: var(--gc-text);
}

.page[[PAGE_NUMBER]]-data-table {
    margin-top: 20px;
    margin-bottom: 0;
    font-family: Arial, sans-serif;
    width: 100%;
    position: relative;
    z-index: 10;
    background-color: #f5f5f5;
}

.page[[PAGE_NUMBER]]-table-wrapper {
    display: block;
    width: 100%;
    margin: 0;
    position: relative;
    z-index: 10;
    background-color: #f5f5f5;
}

.page[[PAGE_NUMBER]]-table-wrapper details > summary {
    display: block;
    width: 100%;
    padding: 12px 15px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #333;
    list-style: none;
}

.page[[PAGE_NUMBER]]-table-wrapper details > summary::-webkit-details-marker {
    display: none;
}

.page[[PAGE_NUMBER]]-footnotes {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #555;
    margin-top: 10px;
    line-height: 1.4;
    max-width: 65ch;
}

@media (max-width: 768px) {
    .page-[[PAGE_NUMBER]] { border-right: none !important; }
    .page[[PAGE_NUMBER]]-title {
        font-size: 37px;
    }
    .page[[PAGE_NUMBER]]-subtitle {
        font-size: 18px;
    }
    .page[[PAGE_NUMBER]]-chart-title {
        font-size: 26px;
    }
    .page[[PAGE_NUMBER]]-footnotes {
        font-size: 18px;
    }
    .page[[PAGE_NUMBER]]-legend-label {
        font-size: 14px;
    }
}
```

---

## [MANDATORY_IMPORTS]

```javascript
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { get[[DATA_FUNCTION]] } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
```

---

## [MANDATORY_STATE_VARIABLES]

```javascript
const { lang, layoutPadding } = useOutletContext();
const [year, setYear] = useState(null);
const [pageData, setPageData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
const [isTableOpen, setIsTableOpen] = useState(false);
const [selectedPoints, setSelectedPoints] = useState(null);
const chartRef = useRef(null);
const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
```

---

## [MANDATORY_HELPER_FUNCTIONS]

```javascript
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

const scrollToElement = (elementId) => (e) => {
    e.preventDefault();
    document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
```

---

## [DATA_LOADING_PATTERN]

```javascript
useEffect(() => {
    get[[DATA_FUNCTION]]()
        .then(data => {
            setPageData(data);
            if (data && data.length > 0) setYear(data[data.length - 1].year);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
}, []);
```

---

## [RESIZE_HANDLER_PATTERN]

```javascript
useEffect(() => {
    const handleResize = () => {
        setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
}, []);
```

---

## [CHART_ACCESSIBILITY_PATTERN]

```javascript
useEffect(() => {
    if (!chartRef.current) return;
    
    const setupChartAccessibility = () => {
        const plotContainer = chartRef.current;
        if (!plotContainer) return;

        const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
        svgElements.forEach(svg => {
            svg.setAttribute('aria-hidden', 'true');
        });

        const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
        modebarButtons.forEach(btn => {
            const dataTitle = btn.getAttribute('data-title');
            if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
                btn.setAttribute('aria-label', dataTitle);
                btn.setAttribute('role', 'button');
                btn.setAttribute('tabindex', '0');
                btn.removeAttribute('aria-hidden');
            } else {
                btn.setAttribute('aria-hidden', 'true');
                btn.setAttribute('tabindex', '-1');
            }
        });
    };

    const timer = setTimeout(setupChartAccessibility, 500);
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

---

## [PLOTLY_CONFIG_PATTERN]

```javascript
config={{
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
    scrollZoom: false,
    modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
    modeBarButtonsToAdd: [{
        name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
        icon: {
            width: 24,
            height: 24,
            path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
        },
        click: (gd) => downloadChartWithTitle(gd)
    }]
}}
```

---

## [PLOTLY_LAYOUT_PATTERN]

```javascript
layout={{
    barmode: 'group',
    hovermode: 'closest',
    clickmode: 'event',
    dragmode: windowWidth <= 768 ? false : 'zoom',
    xaxis: {
        showgrid: false,
        zeroline: false,
        tickfont: { size: windowWidth <= 480 ? 10 : 12, family: 'Arial, sans-serif' },
        automargin: true
    },
    yaxis: {
        title: { 
            text: getText('page[[PAGE_NUMBER]]_yaxis', lang), 
            font: { size: windowWidth <= 768 ? 18 : 24, family: 'Arial, sans-serif', color: '#58585a' },
            standoff: 5
        },
        rangemode: 'tozero',
        showgrid: false,
        showline: true,
        linewidth: 1,
        linecolor: '#333',
        automargin: true,
        tickfont: { size: windowWidth <= 480 ? 9 : 11, family: 'Arial, sans-serif' }
    },
    showlegend: false,
    margin: { l: 0, r: 0, t: 40, b: 60 },
    autosize: true,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)'
}}
```

---

## [MOBILE_DOUBLE_TAP_PATTERN]

For charts with click selection, use this pattern to require double-tap on mobile:

```javascript
onClick={(data) => {
    if (!data.points || data.points.length === 0) return;
    const clickedPoint = data.points[0];
    const traceIndex = clickedPoint.curveNumber;
    const pointIndex = clickedPoint.pointIndex;

    if (windowWidth <= 768) {
        const currentTime = new Date().getTime();
        const lastClick = lastClickRef.current;
        const isSamePoint = (traceIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex);
        const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
        
        lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
        
        if (!isDoubleTap) {
            return;
        }
    }

    setSelectedPoints(prev => {
        if (prev === null) {
            const newSelection = Array(3).fill(null).map(() => []);
            newSelection[traceIndex] = [pointIndex];
            return newSelection;
        }
        const newSelection = prev.map(arr => arr ? [...arr] : []);
        const currentSeriesSelection = newSelection[traceIndex] || [];
        if (currentSeriesSelection.includes(pointIndex)) {
            newSelection[traceIndex] = currentSeriesSelection.filter(i => i !== pointIndex);
        } else {
            newSelection[traceIndex] = [...currentSeriesSelection, pointIndex];
        }
        const allEmpty = newSelection.every(arr => !arr || arr.length === 0);
        return allEmpty ? null : newSelection;
    });
}}
```

---

## [YEAR_SELECTOR_PATTERN]

```jsx
<div className="page[[PAGE_NUMBER]]-year-selector">
    <label id="year-label-[[PAGE_NUMBER]]" htmlFor="year-select-[[PAGE_NUMBER]]">
        {getText('year_slider_label', lang)}
    </label>
    <select
        id="year-select-[[PAGE_NUMBER]]"
        value={year || ''}
        onChange={(e) => setYear(parseInt(e.target.value))}
        aria-labelledby="year-label-[[PAGE_NUMBER]]"
    >
        {pageData.map(d => (
            <option key={d.year} value={d.year}>{d.year}</option>
        ))}
    </select>
</div>
```

Year Selector CSS (add to `[MANDATORY_CSS_BLOCK]`):

```css
.page[[PAGE_NUMBER]]-year-selector {
    display: flex;
    align-items: center;
    margin: 10px 0;
    padding: 2px 0;
    position: relative;
    z-index: 10;
}

.page[[PAGE_NUMBER]]-year-selector label {
    font-weight: bold;
    margin-right: 15px;
    font-size: 18px;
    font-family: Arial, sans-serif;
}

.page[[PAGE_NUMBER]]-year-selector select {
    padding: 8px 12px;
    font-size: 16px;
    font-family: Arial, sans-serif;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #fff;
    cursor: pointer;
    min-width: 100px;
}

.page[[PAGE_NUMBER]]-year-selector select:focus {
    outline: 2px solid #005fcc;
    outline-offset: 2px;
    border-color: #007bff;
}
```

---

## [DATA_TABLE_PATTERN]

```jsx
<div className="page[[PAGE_NUMBER]]-table-wrapper">
    <details 
        className="page[[PAGE_NUMBER]]-data-table"
        onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
    >
        <summary role="button" aria-expanded={isTableOpen}>
            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
        </summary>
        
        <div className="table-responsive" role="region" tabIndex="0">
            <table className="table table-striped table-hover">
                <caption className="wb-inv">
                    {getText('page[[PAGE_NUMBER]]_table_caption', lang)}
                </caption>
                <thead>
                    <tr>
                        <th scope="col">{lang === 'en' ? 'Year' : 'Année'}</th>
                        {/* Add column headers */}
                    </tr>
                </thead>
                <tbody>
                    {pageData.map(d => (
                        <tr key={d.year}>
                            <th scope="row">{d.year}</th>
                            {/* Add data cells with aria-label */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
            <button onClick={downloadTableAsCSV} style={{ padding: '8px 16px', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#333' }}>
                {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
            </button>
            <button onClick={downloadTableAsDocx} style={{ padding: '8px 16px', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#333' }}>
                {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
            </button>
        </div>
    </details>
</div>
```

---

## [CUSTOM_LEGEND_PATTERN]

For charts that need a custom HTML legend (instead of Plotly's built-in legend):

```jsx
<div className="page[[PAGE_NUMBER]]-legend" aria-hidden="true">
    <div className="page[[PAGE_NUMBER]]-legend-item">
        <span className="page[[PAGE_NUMBER]]-legend-color" style={{ backgroundColor: '[[COLOR_1]]' }}></span>
        <span className="page[[PAGE_NUMBER]]-legend-label">{getText('page[[PAGE_NUMBER]]_legend_1', lang)}</span>
    </div>
    <div className="page[[PAGE_NUMBER]]-legend-item">
        <span className="page[[PAGE_NUMBER]]-legend-color" style={{ backgroundColor: '[[COLOR_2]]' }}></span>
        <span className="page[[PAGE_NUMBER]]-legend-label">{getText('page[[PAGE_NUMBER]]_legend_2', lang)}</span>
    </div>
</div>
```

---

## [FOOTNOTES_PATTERN]

```jsx
<aside className="wb-fnote page[[PAGE_NUMBER]]-footnotes" role="note">
    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
    <dl>
        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
        <dd id="fn1">
            <p>{getText('page[[PAGE_NUMBER]]_footnote1', lang)}</p>
            <p className="fn-rtn">
                <a href="#fn1-rf" onClick={scrollToElement('fn1-rf')}>
                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>1
                </a>
            </p>
        </dd>
    </dl>
</aside>
```

In-content footnote reference:

```jsx
<sup id="fn1-rf">
    <a className="fn-lnk" href="#fn1" onClick={scrollToElement('fn1')}>
        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>1
    </a>
</sup>
```

---

## [DOWNLOAD_FUNCTIONS_PATTERN]

### PNG Download

```javascript
const downloadChartWithTitle = async (plotEl = null) => {
    const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
    if (!plotElement) {
        alert('Could not find chart element.');
        return;
    }

    const title = stripHtml(getText('page[[PAGE_NUMBER]]_chart_title', lang));

    try {
        if (!window.Plotly) {
            alert('Plotly library not loaded.');
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
        alert('Error downloading chart: ' + error.message);
    }
};
```

### CSV Download

```javascript
const downloadTableAsCSV = () => {
    if (!pageData || pageData.length === 0) return;

    const headers = [
        lang === 'en' ? 'Year' : 'Année',
        // Add column headers
    ];

    const rows = pageData.map(d => [
        d.year,
        // Add data values
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

```javascript
const downloadTableAsDocx = async () => {
    if (!pageData || pageData.length === 0) return;

    const title = stripHtml(getText('page[[PAGE_NUMBER]]_title', lang));
    const headers = [lang === 'en' ? 'Year' : 'Année' /* Add more */];

    const headerRow = new TableRow({
        children: headers.map(header => new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text: header, bold: true, size: 22 })],
                alignment: AlignmentType.CENTER
            })],
            shading: { fill: 'E6E6E6' }
        }))
    });

    const dataRows = pageData.map(d => new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
            // Add more cells
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
                    columnWidths: [1800, 3700, 3700],
                    rows: [headerRow, ...dataRows]
                })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, lang === 'en' ? 'chart_data.docx' : 'donnees_graphique.docx');
};
```

---

## [FULL_PAGE_TEMPLATE]

Complete template with all tokens. Replace all `[[PLACEHOLDER]]` values.

```javascript
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { get[[DATA_FUNCTION]] } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page[[PAGE_NUMBER]] = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });

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

    const scrollToElement = (elementId) => (e) => {
        e.preventDefault();
        document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        get[[DATA_FUNCTION]]()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) setYear(data[data.length - 1].year);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!chartRef.current) return;
        
        const setupChartAccessibility = () => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return;

            const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
            svgElements.forEach(svg => svg.setAttribute('aria-hidden', 'true'));

            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach(btn => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
                    btn.setAttribute('aria-label', dataTitle);
                    btn.setAttribute('role', 'button');
                    btn.setAttribute('tabindex', '0');
                    btn.removeAttribute('aria-hidden');
                } else {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };

        const timer = setTimeout(setupChartAccessibility, 500);
        const observer = new MutationObserver(setupChartAccessibility);
        if (chartRef.current) observer.observe(chartRef.current, { childList: true, subtree: true });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [pageData, lang]);

    const downloadChartWithTitle = async (plotEl = null) => {
        /* See [DOWNLOAD_FUNCTIONS_PATTERN] */
    };

    const downloadTableAsCSV = () => {
        /* See [DOWNLOAD_FUNCTIONS_PATTERN] */
    };

    const downloadTableAsDocx = async () => {
        /* See [DOWNLOAD_FUNCTIONS_PATTERN] */
    };

    if (loading) return <div>{lang === 'en' ? 'Loading...' : 'Chargement...'}</div>;
    if (error) return <div>{lang === 'en' ? 'Error: ' : 'Erreur: '}{error}</div>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-[[PAGE_NUMBER]]"
            role="main"
            aria-labelledby="page[[PAGE_NUMBER]]-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                /* INSERT [MANDATORY_CSS_BLOCK] HERE */
            `}</style>

            <div className="page[[PAGE_NUMBER]]-container">
                <header role="region" aria-label={getText('page[[PAGE_NUMBER]]_title', lang)}>
                    <h1 id="page[[PAGE_NUMBER]]-title" className="page[[PAGE_NUMBER]]-title" aria-hidden="true">
                        {getText('page[[PAGE_NUMBER]]_title', lang)}
                    </h1>
                    <h1 className="wb-inv">{stripHtml(getText('page[[PAGE_NUMBER]]_title', lang))}</h1>
                    <p className="page[[PAGE_NUMBER]]-subtitle">
                        {getText('page[[PAGE_NUMBER]]_subtitle', lang)}
                    </p>
                </header>

                <div className="page[[PAGE_NUMBER]]-chart-frame">
                    {/* INSERT [YEAR_SELECTOR_PATTERN] IF [[HAS_YEAR_SELECTOR]] */}

                    <h2 className="page[[PAGE_NUMBER]]-chart-title">
                        {getText('page[[PAGE_NUMBER]]_chart_title', lang)}
                    </h2>

                    <div role="region" aria-label={/* chart summary */} tabIndex="0">
                        <figure ref={chartRef} className="page[[PAGE_NUMBER]]-chart" style={{ margin: 0, position: 'relative' }}>
                            {selectedPoints !== null && (
                                <button onClick={() => setSelectedPoints(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>
                                    {lang === 'en' ? 'Clear' : 'Effacer'}
                                </button>
                            )}
                            <div aria-hidden="true">
                                <Plot
                                    data={/* chart data */}
                                    layout={/* INSERT [PLOTLY_LAYOUT_PATTERN] */}
                                    config={/* INSERT [PLOTLY_CONFIG_PATTERN] */}
                                    onClick={/* INSERT [MOBILE_DOUBLE_TAP_PATTERN] IF NEEDED */}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler={true}
                                />
                            </div>
                        </figure>

                        {/* INSERT [CUSTOM_LEGEND_PATTERN] IF NEEDED */}

                        {/* INSERT [DATA_TABLE_PATTERN] */}
                    </div>
                </div>

                {/* INSERT [FOOTNOTES_PATTERN] IF NEEDED */}
            </div>
        </main>
    );
};

export default Page[[PAGE_NUMBER]];
```

---

## RULES REFERENCE (QUICK LOOKUP)

### Naming Rules
| Pattern | Example |
|---------|---------|
| Component | `Page[[PAGE_NUMBER]]` → `Page28` |
| CSS class | `.page[[PAGE_NUMBER]]-element` → `.page28-title` |
| Translation key | `page[[PAGE_NUMBER]]_key` → `page28_title` |
| Data function | `get[[DATA_FUNCTION]]` → `getMajorProjectsData` |
| IDs | `page[[PAGE_NUMBER]]-element` → `page28-title` |

### Color Palette
| Use | Color |
|-----|-------|
| Page title | `#245e7f` |
| Chart title | `#333333` |
| Body text | `#333333` |
| Frame background | `#f5f5f5` |
| Red accent bar | `#A62A1E` |
| Links | `#284162` |

### Breakpoints
| Breakpoint | Behavior |
|------------|----------|
| `>768px` | Desktop: full layout, hover interactions |
| `≤768px` | Mobile: stacked layout, double-tap to select |
| `≤480px` | Small mobile: reduced font sizes |

### Z-Index Layers
| Layer | z-index |
|-------|---------|
| Chart SVG | `1` |
| Legend | `10` |
| Data table | `10` |
| Clear button | `20` |

---

## DATA VECTOR NAMING CONVENTIONS

**Do NOT use page numbers in data vector names.** Use semantic prefixes.

| Prefix | Category | Examples |
|--------|----------|----------|
| `capex_` | Capital expenditures | `capex_oil_gas`, `capex_total` |
| `infra_` | Infrastructure stock | `infra_pipelines`, `infra_transport` |
| `econ_` | Economic contributions | `econ_jobs`, `econ_gdp` |
| `intl_` | International investment | `intl_cdia`, `intl_fdi` |
| `projects_` | Major projects | `projects_total_count`, `projects_oil_gas_value` |
| `cleantech_` | Clean technology | `cleantech_hydro_value` |
| `gdp_prov_` | Provincial GDP | `gdp_prov_ab`, `gdp_prov_on` |

---

## URL HASH CONVENTIONS

**Do NOT use page numbers in URLs.** Use descriptive names.

```
WRONG:  /section-2#page-28
CORRECT: /section-2#major-projects
```

Section wrapper ID must match hash:
```jsx
<div id="major-projects">
    <Page28 />
</div>
```

---

## ACCESSIBILITY CHECKLIST

Before finalizing a page, verify:

- [ ] `role="main"` on `<main>` element
- [ ] `tabIndex="-1"` on `<main>` element
- [ ] Visual title has `aria-hidden="true"`, SR title uses `wb-inv` class
- [ ] Chart SVGs have `aria-hidden="true"` (via useEffect)
- [ ] Download button is keyboard accessible (tabindex="0")
- [ ] Data table has `<caption className="wb-inv">`
- [ ] Data cells have `aria-label` for screen reader reading
- [ ] Currency values use screen-reader-friendly format (e.g., "159 billion dollars")
- [ ] Custom legends have `aria-hidden="true"`
- [ ] Footnotes use `scrollToElement()` handlers (not raw hash links)

---
