# Optional embed / chrome-less mode

Use when a host page must nest Fact Book **content** without a second FIP.

## Enable

Append `?embed=1` to the route query string, for example:

- `/section-1?embed=1`
- `/section-1?embed=1#energy-overview`

On GitHub Pages (base path `/NRCan_Energy_Fact_Book/`):

- `/NRCan_Energy_Fact_Book/section-1?embed=1`
- `/NRCan_Energy_Fact_Book/section-1?embed=1#energy-overview`

In embed mode the app does **not** mount `GCHeader` or `GCFooter` and hides the factbook sidebar.

## Remaining risks (accepted only if product approves)

- Performance: Plotly and page weight are unchanged; iframe still pays full SPA cost.
- Accessibility: nested documents need a separate a11y pass.
- Framing: host must allowlist this origin; Fact Book host should deny framing by default (see [DEPLOYMENT.md](DEPLOYMENT.md#security-and-caching)).
- Dual-mode ops: test both full FIP and embed every release.

**Default product mode remains standalone with full FIP.** Prefer a same-origin chrome-less path over iframe when possible.
