# Accessibility Compliance Plan
## Contract Folder Web Application vs. CAN/ASC - EN 301 549:2024

**Date Created:** December 10, 2025  
**Standard:** CAN/ASC - EN 301 549:2024 (Accessibility requirements for ICT products and services)  
**Required Conformance:** WCAG 2.1 Level AA (Section 9 - Web)

---

## Overview

The Contract folder contains a **Dash/Plotly web application** (NRCAN Energy Factbook) that must comply with **Section 9 (Web)** of CAN/ASC - EN 301 549:2024, which mandates **WCAG 2.1 Level AA** conformance.

---

## Current Application Structure

| File | Purpose |
|------|---------|
| `app.py` | Main app with sidebar navigation |
| `pages/introduction.py` | Introduction page with text + image |
| `pages/page6.py` | Energy Overview with image |
| `pages/page11.py` | Energy Data with image |
| `assets/custom.css` | Styling |

---

## Compliance Audit & Remediation Plan

### 1. PERCEIVABLE (Section 9.1)

#### 1.1 Non-text Content (9.1.1.1) ⚠️ **NEEDS ATTENTION**

**Current Issues:**
- Images use generic `alt` text like "Page 6 Visual Content"
- Alt text does not convey the actual information in the images

**Remediation:**
```python
# Instead of:
html.Img(src=dash.get_asset_url("page6.png"), alt="Page 6 Visual Content")

# Use descriptive alt text:
html.Img(src=dash.get_asset_url("page6.png"), 
         alt="Chart showing Canada's energy production breakdown: 40% oil, 30% natural gas, 15% hydroelectric, 10% nuclear, 5% renewables")
```

#### 1.2 Time-based Media (9.1.2) ✅ **N/A**
- No audio/video content present

#### 1.3 Adaptable (9.1.3) ⚠️ **NEEDS ATTENTION**

| Requirement | Status | Action |
|------------|--------|--------|
| Info & Relationships | ⚠️ | Add proper semantic HTML structure |
| Meaningful Sequence | ⚠️ | Verify reading order matches visual order |
| Orientation | ✅ | App is responsive |
| Identify Input Purpose | ⚠️ | Add `autocomplete` attributes if forms are added |

**Remediation for Info & Relationships:**
```python
# Add proper landmark roles and ARIA
app.layout = html.Div([
    html.Header([  # Add semantic header
        sidebar()
    ], role="banner"),
    html.Main([  # Wrap content in main
        dash.page_container,
        html.Nav(id="page-navigation-footer", className="page-navigation",
                 **{"aria-label": "Page navigation"})
    ], role="main", id="wb-cont"),  # Skip link target
])
```

#### 1.4 Distinguishable (9.1.4) ⚠️ **NEEDS ATTENTION**

| Requirement | Status | Action |
|------------|--------|--------|
| Use of Color (9.1.4.1) | ⚠️ | Ensure color isn't the only way to convey info |
| Contrast Minimum (9.1.4.3) | ⚠️ | Verify 4.5:1 for text, 3:1 for large text |
| Resize Text (9.1.4.4) | ⚠️ | Use relative units (rem/em) not px |
| Images of Text (9.1.4.5) | ⚠️ | PNG images contain text - provide text alternatives |
| Reflow (9.1.4.10) | ⚠️ | Test at 320px width |
| Non-text Contrast (9.1.4.11) | ⚠️ | Verify 3:1 for UI components |
| Text Spacing (9.1.4.12) | ⚠️ | Ensure CSS doesn't prevent text spacing adjustment |
| Content on Hover/Focus (9.1.4.13) | ⚠️ | Sidebar hover behavior needs review |

**CSS Contrast Audit - Current Colors:**
```css
/* Current - needs verification */
--primary-color: #245E7F;      /* Dark blue */
--text-color: #333333;         /* Dark gray */
--background-color: #FFFFFF;   /* White */
```

**Remediation for Sidebar Hover (9.1.4.13):**
```css
/* Add ability to dismiss hover content */
.sidebar {
    /* Keep visible while focused within */
}
.sidebar:focus-within {
    width: var(--sidebar-width);
    opacity: 1;
}
```

---

### 2. OPERABLE (Section 9.2)

#### 2.1 Keyboard Accessible (9.2.1) ⚠️ **NEEDS ATTENTION**

**Current Issues:**
- Sidebar only appears on hover (not keyboard accessible)
- No skip links implemented

**Remediation:**
```python
# Add skip link at top of layout
html.A("Skip to main content", href="#main-content", 
       className="skip-link", tabIndex=0)

# Make sidebar keyboard accessible
html.Button("Toggle Navigation", id="nav-toggle", 
            className="sr-only focusable",
            **{"aria-expanded": "false", "aria-controls": "sidebar"})
```

```css
/* Skip link styling */
.skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px;
    z-index: 9999;
}
.skip-link:focus {
    top: 0;
}
```

#### 2.2 Enough Time (9.2.2) ✅ **COMPLIANT**
- No time limits in the application

#### 2.3 Seizures (9.2.3) ✅ **COMPLIANT**  
- No flashing content

#### 2.4 Navigable (9.2.4) ⚠️ **NEEDS ATTENTION**

| Requirement | Status | Action |
|------------|--------|--------|
| Bypass Blocks (9.2.4.1) | ❌ | Add skip links |
| Page Titled (9.2.4.2) | ⚠️ | Add unique page titles |
| Focus Order (9.2.4.3) | ⚠️ | Verify logical focus order |
| Link Purpose (9.2.4.4) | ⚠️ | Improve navigation arrow text |
| Multiple Ways (9.2.4.5) | ⚠️ | Add sitemap or search |
| Headings and Labels (9.2.4.6) | ⚠️ | Ensure proper heading hierarchy |
| Focus Visible (9.2.4.7) | ✅ | Orange outline is good |

**Remediation for Page Titles:**
```python
# In each page file, add title meta
dash.register_page(__name__, 
                   path='/', 
                   title="Introduction - NRCAN Energy Factbook",
                   name="Introduction")
```

**Remediation for Link Purpose:**
```python
# Current (unclear):
dcc.Link(f"← {prev_page['name']}", href=prev_page['relative_path'])

# Better (clear purpose):
dcc.Link([
    html.Span("Previous: ", className="sr-only"),
    f"← {prev_page['name']}"
], href=prev_page['relative_path'], 
   **{"aria-label": f"Go to previous page: {prev_page['name']}"})
```

#### 2.5 Input Modalities (9.2.5) ✅ **MOSTLY COMPLIANT**
- No complex gestures required
- Standard pointer interactions

---

### 3. UNDERSTANDABLE (Section 9.3)

#### 3.1 Readable (9.3.1) ⚠️ **NEEDS ATTENTION**

**Remediation - Add language attribute:**
```python
# In app.py, set HTML lang attribute
app = Dash(
    __name__,
    use_pages=True,
    index_string='''
    <!DOCTYPE html>
    <html lang="en">
        <head>
            {%metas%}
            <title>{%title%}</title>
            {%favicon%}
            {%css%}
        </head>
        <body>
            {%app_entry%}
            {%config%}
            {%scripts%}
            {%renderer%}
        </body>
    </html>
    '''
)
```

#### 3.2 Predictable (9.3.2) ✅ **COMPLIANT**
- Consistent navigation across pages
- No unexpected context changes

#### 3.3 Input Assistance (9.3.3) ✅ **N/A**
- No forms or user input currently

---

### 4. ROBUST (Section 9.4)

#### 4.1 Compatible (9.4.1) ⚠️ **NEEDS ATTENTION**

| Requirement | Status | Action |
|------------|--------|--------|
| Parsing (9.4.1.1) | ⚠️ | Validate HTML output |
| Name, Role, Value (9.4.1.2) | ⚠️ | Add ARIA labels to custom controls |
| Status Messages (9.4.1.3) | ⚠️ | Add live regions for dynamic content |

**Remediation for Name, Role, Value:**
```python
# Current sidebar (missing accessible name for links)
dcc.Link(f"{page['name']}", href=page["relative_path"], className="nav-link")

# Better:
dcc.Link(f"{page['name']}", 
         href=page["relative_path"], 
         className="nav-link",
         **{"aria-current": "page" if current else None})
```

---

## Implementation Checklist

### Phase 1: Critical Fixes (High Priority)

- [ ] **Add skip link** to bypass navigation
- [ ] **Make sidebar keyboard accessible** (add toggle button)
- [ ] **Add `lang="en"`** attribute to HTML
- [ ] **Improve alt text** for all images with meaningful descriptions
- [ ] **Add unique page titles** for each route

### Phase 2: Structural Improvements

- [ ] **Add semantic landmarks** (`<header>`, `<main>`, `<nav>`, `<footer>`)
- [ ] **Verify heading hierarchy** (h1 → h2 → h3 progression)
- [ ] **Add ARIA labels** to navigation elements
- [ ] **Implement `aria-current="page"`** for active navigation

### Phase 3: Visual & Interaction Fixes

- [ ] **Audit color contrast** using a tool (WebAIM, axe DevTools)
- [ ] **Fix sidebar hover/focus behavior** (dismissible, persistent on focus)
- [ ] **Convert px units to rem/em** in CSS
- [ ] **Test at 200% zoom** and 320px viewport width

### Phase 4: Testing & Validation

- [ ] **Automated testing** with axe-core or pa11y
- [ ] **Manual keyboard testing** (Tab, Enter, Escape navigation)
- [ ] **Screen reader testing** (NVDA, JAWS, VoiceOver)
- [ ] **Create VPAT/ACR** (Voluntary Product Accessibility Template)

---

## Recommended Tools

| Tool | Purpose |
|------|---------|
| **axe DevTools** | Browser extension for automated testing |
| **WAVE** | Web accessibility evaluation tool |
| **Colour Contrast Analyser** | Check color contrast ratios |
| **NVDA** | Free Windows screen reader |
| **Lighthouse** | Chrome built-in accessibility audit |

---

## Summary

The current application has **good foundations** (focus outline, responsive design, semantic `role` attributes on navigation) but requires work in these key areas:

1. **Image accessibility** - Descriptive alt text for data visualizations
2. **Keyboard navigation** - Skip links and keyboard-accessible sidebar
3. **Page structure** - Language declaration, unique titles, proper landmarks
4. **Hover content** - Make sidebar accessible without mouse

---

## Reference

**Standard:** CAN/ASC - EN 301 549:2024 Accessibility requirements for ICT products and services (EN 301 549:2021, IDT)  
**Source:** https://accessible.canada.ca/creating-accessibility-standards/canasc-en-301-5492024-accessibility-requirements-ict-products-and-services



