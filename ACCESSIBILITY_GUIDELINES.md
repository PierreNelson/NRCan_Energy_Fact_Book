# Accessibility Guidelines for Page Components

## Overview

This document outlines how to structure React page components so that screen readers (like Windows Narrator, NVDA, JAWS, VoiceOver) can navigate through **logical reading blocks** rather than individual elements.

## The Goal

Screen readers should announce content in meaningful chunks:
1. **Navigation** - sidebar, buttons (read individually)
2. **Content Regions** - each region is read as ONE complete block

## Implementation Pattern

### 1. Page Container

Always wrap the page in a `<main>` element:

```jsx
<main 
    className="page-content page-XX" 
    role="main"
    aria-label={getPageTitle()}
    style={{ /* your styles */ }}
>
    {/* page content */}
</main>
```

### 2. Create Screen Reader Text Functions

At the top of your component (after hooks, before return), create functions that build complete text for each region:

```jsx
// Build screen reader text for [section name]
const getSectionText = () => {
    // Combine all visual text into one readable sentence/paragraph
    // - Remove HTML tags: .replace(/<br>/g, ' ')
    // - Remove newlines: .replace(/\n/g, ' ')
    // - Format currency WITHOUT $ symbol (e.g., "419.6 billion dollars")
    //   Screen readers misread "$419.6" as "four hundred nineteen dollars and sixty cents"
    return `Complete text for this section...`;
};
```

### 3. Structure Each Region

Each logical content block should follow this pattern:

```jsx
{/* REGION X: [Description] - read as one block */}
<div/section/header/aside/footer 
    role="region"
    aria-label={getRegionText()}
    style={{ /* your styles */ }}
>
    {/* Visual content - hidden from screen readers */}
    <div aria-hidden="true">
        {/* Your visual JSX here */}
    </div>
</div>
```

**Key points:**
- `role="region"` + `aria-label` = screen reader reads the label as ONE announcement
- `aria-hidden="true"` on visual children = prevents duplicate reading
- The `aria-label` contains the FULL text that should be read

### 4. Currency & Number Formatting

**For visual display:**
```jsx
const formatBillion = (val) => {
    return lang === 'en' ? `$${val.toFixed(1)} billion` : `${val.toFixed(1)} $ milliards`;
};
```

**For screen readers (no $ symbol):**
```jsx
const formatBillionSR = (val) => {
    return `${val.toFixed(1)} billion dollars`;  // Reads naturally
};
```

### 5. Slider Accessibility

```jsx
<div 
    role="region"
    aria-label={`Select Year: ${year}. Use arrow keys to change year from ${minYear} to ${maxYear}.`}
>
    <label aria-hidden="true">Select Year: {year}</label>
    <input
        type="range"
        min={minYear}
        max={maxYear}
        value={year}
        onChange={(e) => setYear(parseInt(e.target.value))}
        aria-valuemin={minYear}
        aria-valuemax={maxYear}
        aria-valuenow={year}
        aria-valuetext={`${year}`}
    />
    {/* Year tick marks - decorative */}
    <div aria-hidden="true">
        {yearsList.map(y => <span key={y}>{y}</span>)}
    </div>
</div>
```

### 6. Charts & Graphs

Charts are **visual-only**. Provide a complete text summary:

```jsx
{/* REGION: Chart Data */}
<div 
    role="region"
    aria-label={getChartDataSummary()}  // Full data as text
    style={{ /* styles */ }}
>
    <figure aria-hidden="true">
        <Plot data={...} layout={...} />
    </figure>
</div>
```

The `getChartDataSummary()` function should return something like:
```
"Stacked bar chart showing capital expenditures from 2007 to 2024. 
Categories: Oil and gas extraction, Electricity, and Other. 
In 2024, total was 60 billion dollars. Peak was 98 billion dollars in 2014."
```

### 7. Decorative Elements

Hide decorative images, icons, and visual flourishes:

```jsx
{/* Decorative image */}
<img src="/assets/decorative.png" alt="" aria-hidden="true" />

{/* Decorative quotation marks */}
<span aria-hidden="true">❝</span>

{/* Background images */}
<div aria-hidden="true" style={{ backgroundImage: 'url(...)' }} />
```

## Complete Page Template

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';

const PageXX = () => {
    const { lang } = useOutletContext();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load data
        loadData().then(d => {
            setData(d);
            setLoading(false);
        });
        // Prefetch next page
        import('./PageXX_Next');
    }, []);

    if (loading) return <div>Loading...</div>;

    // ===== ACCESSIBILITY: Screen Reader Text Functions =====
    
    const getTitleText = () => {
        return getText('pageXX_title', lang);
    };

    const getSection1Text = () => {
        // Build complete text for section 1
        return `...`;
    };

    const getSection2Text = () => {
        // Build complete text for section 2
        return `...`;
    };

    // Helper: Format currency for screen readers (no $ symbol)
    const formatCurrencySR = (val) => {
        const b = (val / 1000).toFixed(1);
        return `${b} billion dollars`;
    };

    return (
        <main 
            className="page-content page-XX" 
            role="main"
            aria-label={getTitleText()}
            style={{ /* styles */ }}
        >
            {/* REGION 1: Title */}
            <header 
                role="region"
                aria-label={getTitleText()}
            >
                <h1 aria-hidden="true">{getText('pageXX_title', lang)}</h1>
            </header>

            {/* REGION 2: Main Content */}
            <section 
                role="region"
                aria-label={getSection1Text()}
            >
                <div aria-hidden="true">
                    {/* Visual content */}
                </div>
            </section>

            {/* REGION 3: Supporting Info */}
            <aside 
                role="region"
                aria-label={getSection2Text()}
            >
                <div aria-hidden="true">
                    {/* Visual content */}
                </div>
            </aside>

            {/* REGION 4: Footer */}
            <footer 
                role="region"
                aria-label={getFooterText()}
            >
                <p aria-hidden="true">{/* Visual footer */}</p>
            </footer>
        </main>
    );
};

export default PageXX;
```

## 200% Zoom Compliance (WCAG 1.4.4)

The page must remain readable and functional when the user zooms their browser to 200%.

### Key Principle: CSS Media Queries

**Use CSS Media Queries** to create a responsive layout that:
- At 100% zoom: Shows the original side-by-side layout
- At 125%+ zoom: Switches to a stacked (column) layout that scrolls

When you zoom to 200%, your browser treats it as if the screen width is halved. A 1920px screen at 200% zoom behaves like a 960px screen. Media queries detect this and apply different styles.

### Required Pattern: Dynamic Layout with Media Queries

```jsx
<main style={{ overflow: 'auto', flex: '1' }}>
    {/* CSS with Media Queries */}
    <style>{`
        /* Default: Side-by-side layout for 100% zoom */
        .content-row {
            display: flex;
            flex-direction: row;
            flex: 1;
        }
        
        .chart-column {
            flex: 0 0 58%;
            height: calc(100vh - 200px);
        }
        
        .text-column {
            flex: 0 0 40%;
            padding-left: 20px;
        }

        /* MEDIA QUERY: When zoomed in (125%+), stack vertically */
        /* Breakpoint of 1500px ensures stacking starts at ~125% zoom on 1920px screens */
        @media (max-width: 1500px) {
            .content-row {
                flex-direction: column;
                height: auto;
            }
            
            .chart-column {
                width: 100%;
                flex: none;
                height: 600px;
                margin-bottom: 30px;
            }
            
            .text-column {
                width: 100%;
                flex: none;
                padding-left: 20px;
            }
        }
    `}</style>

    <div className="content-row">
        <div className="chart-column">
            <Plot ... />
        </div>
        <aside className="text-column">
            <p>...</p>
        </aside>
    </div>
</main>
```

### How it works (on 1920px screen)

| Zoom Level | Effective Viewport | Media Query | Layout |
|------------|-------------------|-------------|--------|
| 100% | ~1600px (minus sidebar) | `(max-width: 1500px)` = false | Side-by-side (row) |
| 125% | ~1280px | `(max-width: 1500px)` = true | **Stacked (column)** |
| 150% | ~1067px | `(max-width: 1500px)` = true | **Stacked (column)** |
| 200% | ~800px | `(max-width: 1500px)` = true | **Stacked (column)** |

### Why 1500px Breakpoint?

Using 1500px ensures:
1. **No squishing at intermediate zooms**: Content stacks before it gets squeezed
2. **Original layout at 100%**: On typical 1920px screens, content area is ~1600px
3. **Early transition**: Stacking begins around 125% zoom, preventing overlap issues at 150-175%

### Special Handling for Plotly Charts

For charts with text annotations (like pie charts), add responsive annotation sizing:

```jsx
const [windowWidth, setWindowWidth] = useState(window.innerWidth);

useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
}, []);

// In annotations useMemo:
const isZoomed = windowWidth < 1500;
const labelFontSize = isZoomed ? 14 : 19;
const margin = isZoomed 
    ? { l: 120, r: 100, t: 80, b: 100 }
    : { l: 240, r: 180, t: 140, b: 180 };
```

### What to Include in the Media Query

- `flex-direction: column` - Stack elements vertically
- `width: 100%` - Elements take full width
- `height: auto` or generous fixed height for charts (600px+)
- Smaller font sizes for chart annotations
- Removed horizontal margins (`margin-left: 0 !important`)
- Adjusted chart margins for more chart visibility

### Testing 200% Zoom

1. Open the page in Chrome/Edge on a 1920px screen
2. Press **Ctrl + +** (or Cmd + +) multiple times to test each zoom level
3. Verify:
   - At 100%: Side-by-side layout, no scrollbars needed
   - At 125%: Layout switches to stacked
   - At 150%: Stacked layout, no overlapping
   - At 200%: Stacked layout, vertical scrolling to see all content
4. Press **Ctrl + 0** to reset to 100%

## Testing with Windows Narrator

1. Press **Win + Ctrl + Enter** to start Narrator
2. Press **Caps Lock + Right Arrow** to move through regions
3. Each region should read its COMPLETE content as ONE announcement
4. Verify:
   - Numbers read naturally (e.g., "419.6 billion dollars" not "$419 and 60 cents")
   - No duplicate content
   - Decorative elements are skipped
   - Slider announces current value and range

## Checklist for New Pages

- [ ] Wrap page in `<main role="main" aria-label={...} style={{ overflow: 'auto' }}>`
- [ ] **Add CSS media query in `<style>` block for 200% zoom compliance**
- [ ] **Default layout: side-by-side using `flex-direction: row`**
- [ ] **Media query (`@media max-width: 1200px`): switch to `flex-direction: column`**
- [ ] Create `getXxxText()` functions for each region
- [ ] Use `role="region"` + `aria-label` on content blocks
- [ ] Add `aria-hidden="true"` to visual children
- [ ] Format currency without `$` symbol in screen reader text
- [ ] Hide decorative images with `aria-hidden="true"` or empty `alt=""`
- [ ] Add proper ARIA attributes to sliders/inputs
- [ ] Test with Windows Narrator
- [ ] **Test at 100% zoom - original side-by-side layout**
- [ ] **Test at 200% zoom - stacked layout with vertical scrolling**
- [ ] Verify French translations work correctly

## Language Considerations

All screen reader text must work in both English and French:

```jsx
const getSliderText = () => {
    if (lang === 'en') {
        return `Select Year: ${year}. Use arrow keys to change year from ${minYear} to ${maxYear}.`;
    } else {
        return `Sélectionner l'année: ${year}. Utilisez les touches fléchées pour changer l'année de ${minYear} à ${maxYear}.`;
    }
};
```

---

*Last updated: December 2024*

