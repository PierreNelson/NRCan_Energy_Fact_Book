# MASTER PAGE BUILDING GUIDE & TEMPLATE

**Version:** 3.0 (Updated January 2026)  
**Compliance:** WCAG 2.1 AA, WET-BOEW (Web Experience Toolkit)

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
- **Mobile (≤768px):** "Click to interact" overlay, mode bar hidden until activated

### Window Resize Handler
```javascript
useEffect(() => {
    const handleResize = () => {
        const newWidth = window.innerWidth;
        setWindowWidth(newWidth);
        if (newWidth > 768) {
            setIsChartInteractive(true);
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Click Outside Handler (Mobile)
```javascript
useEffect(() => {
    const handleClickOutside = (event) => {
        if (windowWidth <= 768 && isChartInteractive && chartRef.current && !chartRef.current.contains(event.target)) {
            setIsChartInteractive(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
}, [isChartInteractive, windowWidth]);
```

### Mobile Overlay Pattern
```jsx
<div ref={chartRef} className="chart-container" style={{ position: 'relative' }}>
    {/* Click to Interact Overlay (Mobile Only) */}
    {windowWidth <= 768 && !isChartInteractive && (
        <div 
            onClick={() => setIsChartInteractive(true)} 
            style={{ 
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                zIndex: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.01)'
            }} 
            role="button" 
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsChartInteractive(true); } }}
        >
            <span style={{ background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 16px', borderRadius: '4px', fontSize: '14px' }}>
                {lang === 'en' ? 'Click to interact' : 'Cliquez pour interagir'}
            </span>
        </div>
    )}

    {/* Done Button (Mobile Only, when interactive) */}
    {windowWidth <= 768 && isChartInteractive && (
        <button onClick={() => { setIsChartInteractive(false); setSelectedPoints(null); }} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>
            {lang === 'en' ? 'Done' : 'Terminé'}
        </button>
    )}

    {/* Clear Selection Button */}
    {selectedPoints !== null && (
        <button onClick={() => setSelectedPoints(null)} style={{ position: 'absolute', top: 0, right: windowWidth <= 768 ? 360 : 295, zIndex: 20 }}>
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

---

## 8. Custom PNG Download with Title

```javascript
const downloadChartWithTitle = async (plotEl = null) => {
    const plotElement = plotEl || document.querySelector('.chart-container .js-plotly-plot') || chartRef.current?.querySelector('.js-plotly-plot');
    if (!plotElement) {
        alert('Could not find chart element. Please try again.');
        return;
    }

    const title = stripHtml(getText('page_title', lang));

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

    const headerRow = new TableRow({
        children: headers.map(header => new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text: header, bold: true, size: 20 })],
                alignment: AlignmentType.CENTER
            })]
        }))
    });

    const dataRows = pageData.map(yearData => new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 20 })], alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.value1 / 1000).toFixed(2), size: 20 })], alignment: AlignmentType.RIGHT })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.value2 / 1000).toFixed(2), size: 20 })], alignment: AlignmentType.RIGHT })] })
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
                {lang === 'en' ? 'Data table description' : 'Description du tableau de données'}
            </caption>
            <thead>
                <tr>
                    <th scope="col">{lang === 'en' ? 'Year' : 'Année'}</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                        {lang === 'en' ? 'Value ($ billions)' : 'Valeur (milliards $)'}
                    </th>
                </tr>
            </thead>
            <tbody>
                {pageData.map(row => (
                    <tr key={row.year}>
                        <td>{row.year}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(row.value)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
    {/* Download buttons here */}
</details>
```

---

## 11. Plotly Chart Configuration

### Standard Config Object
```javascript
config={{
    displayModeBar: windowWidth > 768 || isChartInteractive,
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

## 12. Accessibility Standards

1. **Main Container:** Must have `role="main"`, `id="main-content"`, and `tabIndex="-1"`
2. **Screen Reader Text:** Format currency as text ("4.5 billion dollars") not symbols
3. **Aria-Hidden:** Decorative elements must have `aria-hidden="true"`
4. **Language:** All text must be dynamic based on `lang` prop
5. **Table Captions:** Use `className="wb-inv"` for screen-reader-only captions
6. **Keyboard Navigation:** All interactive elements must be keyboard accessible

---

## 13. Footnotes (WET Style)

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

## 14. Page Template Summary

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
                    {/* Mobile overlay, Done button, Clear button */}
                    <Plot
                        data={[/* chart data */]}
                        layout={{/* layout config */}}
                        config={{
                            displayModeBar: windowWidth > 768 || isChartInteractive,
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

