import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getPetroleumEmploymentByRegionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';

const REGION_ORDER = ['bc', 'alta', 'sask', 'man', 'ont', 'que', 'maritimes', 'nl'];

/** Segments below this share (%) get leader-line callouts; wider segments label inside the bar. */
const CALLOUT_THRESHOLD = 6;

const LEGEND_ROWS = [
    ['bc', 'sask', 'ont', 'maritimes'],
    ['alta', 'man', 'que', 'nl']
];

const REGION_COLORS = {
    bc: '#7EBAE4',
    alta: '#4A3728',
    sask: '#4A5D6A',
    man: '#A8A8A8',
    ont: '#E7893C',
    que: '#6B8494',
    maritimes: '#B8956A',
    nl: '#3D9A9A'
};

const petroleum_sector_employment_HIGH_ZOOM_MIN = 1.09;

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const getPageZoomScale = () => {
    if (typeof window === 'undefined') return 1;
    const vv = window.visualViewport;
    const iw = window.innerWidth || 0;
    const cw = typeof document !== 'undefined' ? document.documentElement?.clientWidth || iw : iw;

    if (vv) {
        if (typeof vv.scale === 'number' && vv.scale > 1.02) {
            return Math.min(vv.scale, 4);
        }
        if (vv.width > 0 && iw > 0) {
            const sIw = iw / vv.width;
            if (sIw >= 1.08 && sIw <= 4) return sIw;
        }
        if (vv.width > 0 && cw > 0) {
            const sCw = cw / vv.width;
            if (sCw >= 1.08 && sCw <= 4) return sCw;
        }
    }

    if (iw > 0 && typeof window.outerWidth === 'number' && window.outerWidth > 0) {
        const r = window.outerWidth / iw;
        if (r >= 1.08) return Math.min(r, 4);
    }

    return 1;
};

const PetroleumEmploymentByRegion = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [highBrowserZoom, setHighBrowserZoom] = useState(false);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
        isSelected,
        hasSelection,
    } = usePlotlySelection({ mode: 'points', traceCount: REGION_ORDER.length, windowWidth });
    const chartRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const reportingYear = pageData?.reportingYear ?? null;
    const regionPcts = pageData?.regionPcts ?? {};
    const directTotal = pageData?.directTotal ?? null;
    const indirectTotal = pageData?.indirectTotal ?? null;
    const topIndirect = useMemo(() => pageData?.topIndirect ?? [], [pageData]);

    useEffect(() => {
        getPetroleumEmploymentByRegionData()
            .then(setPageData)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const formatJobsShort = useCallback((n) => {
        if (n == null || Number.isNaN(n)) return '\u2014';
        if (lang === 'en' && n >= 1000) return `${Math.round(n / 1000)}K`;
        return Math.round(n).toLocaleString(locale);
    }, [lang, locale]);

    const narrativePct = useCallback((v) => {
        if (v == null || Number.isNaN(v)) return '\u2014';
        const s = v.toLocaleString(locale);
        return lang === 'en' ? `${s}%` : `${s}\u00a0%`;
    }, [lang, locale]);

    const textVars = useMemo(() => {
        const provinceName = (key) => getText(`petroleum_sector_employment_region_${key}_full`, lang);
        const top = topIndirect;
        return {
            year: reportingYear ?? '',
            directJobs: formatJobsShort(directTotal),
            indirectJobs: formatJobsShort(indirectTotal),
            province1: top[0] ? provinceName(top[0].key) : '',
            share1: top[0] ? narrativePct(top[0].share) : '',
            province2: top[1] ? provinceName(top[1].key) : '',
            share2: top[1] ? narrativePct(top[1].share) : '',
            province3: top[2] ? provinceName(top[2].key) : '',
            share3: top[2] ? narrativePct(top[2].share) : '',
            province4: top[3] ? provinceName(top[3].key) : '',
            share4: top[3] ? narrativePct(top[3].share) : '',
            province5: top[4] ? provinceName(top[4].key) : '',
            share5: top[4] ? narrativePct(top[4].share) : ''
        };
    }, [lang, reportingYear, directTotal, indirectTotal, topIndirect, formatJobsShort, narrativePct]);

    const directRowLabel = getText('petroleum_sector_employment_row_direct', lang);
    const indirectRowLabel = getText('petroleum_sector_employment_row_indirect', lang);
    const plotYDirectLabel = highBrowserZoom ? getText('petroleum_sector_employment_row_direct_compact', lang) : directRowLabel;
    const plotYIndirectLabel = highBrowserZoom ? getText('petroleum_sector_employment_row_indirect_compact', lang) : indirectRowLabel;

    // X-axis ticks are percentage scale (0%–100%); keep sizes moderate per request.
    const tickFontX = {
        size: highBrowserZoom
            ? windowWidth <= 480
                ? 10
                : 11
            : windowWidth <= 480
              ? 12
              : windowWidth <= 768
                ? 13
                : 14,
        family: 'Arial, sans-serif'
    };
    // Y-axis = row names (not %); larger for readability.
    const tickFontY = {
        size: highBrowserZoom
            ? windowWidth <= 480
                ? 13
                : 14
            : windowWidth <= 480
              ? 15
              : windowWidth <= 768
                ? 16
                : 17,
        family: 'Arial, sans-serif'
    };

    const formatJobsAnnotation = (n) => {
        if (n == null || Number.isNaN(n)) return '\u2014';
        return `${formatJobsShort(n)} ${getText('petroleum_sector_employment_jobs_word', lang)}`;
    };

    const formatPctCell = (v) => {
        if (v == null) return '\u2014';
        const s = v.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
        return lang === 'en' ? `${s}%` : `${s}\u00a0%`;
    };

    const formatJobsTableCell = (n) => {
        if (n == null || Number.isNaN(n)) return '\u2014';
        return n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const regionLabel = (key) => getText(`petroleum_sector_employment_region_${key}`, lang);
    const regionFullName = (key) => getText(`petroleum_sector_employment_region_${key}_full`, lang);

    const chartHeading = substitute(getText('petroleum_sector_employment_chart_heading', lang), textVars);
    const exportChartTitle = stripHtml(chartHeading);
    const fileSlugBase = `${stripHtml(getText('petroleum_sector_employment_export_slug', lang))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'petroleum-employment-by-region'}-${reportingYear ?? 'latest'}`;

    const tableColumns = useMemo(() => [
        { key: 'region', header: getText('petroleum_sector_employment_table_col_region', lang), align: 'left' },
        { key: 'direct', header: getText('petroleum_sector_employment_table_col_direct_pct', lang), align: 'num' },
        { key: 'indirect', header: getText('petroleum_sector_employment_table_col_indirect_pct', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => {
        if (!pageData) return [];
        const rows = REGION_ORDER.map((k) => {
            const r = regionPcts[k] ?? {};
            return {
                region: regionLabel(k),
                direct: r.direct ?? null,
                indirect: r.indirect ?? null,
            };
        });
        rows.push({
            region: getText('petroleum_sector_employment_table_total_jobs_row', lang),
            direct: directTotal,
            indirect: indirectTotal,
            isTotal: true,
        });
        return rows;
    }, [pageData, regionPcts, lang, directTotal, indirectTotal]);

    const barPctFontBase = windowWidth <= 480 ? 16 : 20;
    const barPctFontLarge = windowWidth <= 480 ? 22 : 26;
    /** Leader-line callout labels (direct + indirect rows) at 100% zoom. */
    const calloutFontSize = windowWidth <= 480 ? 14 : 16;

    const plotTraces = REGION_ORDER.map((key, traceIndex) => {
        const base = REGION_COLORS[key];
        const shares = regionPcts[key] ?? {};
        const d = shares.direct ?? 0;
        const ind = shares.indirect ?? 0;
        const markerColor =
            selectedPoints === null
                ? base
                : [0, 1].map((pointIndex) => (
                    isSelected(traceIndex, pointIndex) ? base : hexToRgba(base, 0.28)
                ));
        const textInside = (v) => (v >= CALLOUT_THRESHOLD ? formatPctCell(v).replace('\u00a0', ' ') : '');
        const full = regionFullName(key);
        const showBarPctLabels = !highBrowserZoom;
        return {
            type: 'bar',
            orientation: 'h',
            name: regionLabel(key),
            x: [d, ind],
            y: [plotYDirectLabel, plotYIndirectLabel],
            marker: { color: markerColor },
            text: showBarPctLabels ? [textInside(d), textInside(ind)] : ['', ''],
            textposition: showBarPctLabels ? 'inside' : 'none',
            insidetextanchor: 'middle',
            textfont: {
                family: 'Arial, sans-serif',
                size: [
                    d >= 20 ? barPctFontLarge : barPctFontBase,
                    ind >= 20 ? barPctFontLarge : barPctFontBase
                ],
                color: '#ffffff'
            },
            hovertext: [
                `<b>${full}</b><br>${directRowLabel}: ${formatPctCell(d)}`,
                `<b>${full}</b><br>${indirectRowLabel}: ${formatPctCell(ind)}`
            ],
            hoverinfo: 'text'
        };
    });

    const formatShareSpoken = (value) => {
        if (value == null) return '\u2014';
        const spoken = value.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
        return `${spoken} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const chartSummary = joinChartSummary({
        intro: lang === 'en'
            ? `Horizontal stacked bar chart of direct and indirect petroleum employment by region for ${reportingYear}`
            : `Graphique à barres empilées horizontales de l'emploi pétrolier direct et indirect par région pour ${reportingYear}`,
        body: summarizeByCategory({
            categories: REGION_ORDER.map((key) => regionFullName(key)),
            series: [
                { name: directRowLabel, values: REGION_ORDER.map((key) => regionPcts[key]?.direct), format: formatShareSpoken },
                { name: indirectRowLabel, values: REGION_ORDER.map((key) => regionPcts[key]?.indirect), format: formatShareSpoken },
            ],
            lang,
        }),
    });
    const chartAria = `${exportChartTitle}. ${chartSummary}`;

    useEffect(() => {
        const tick = () => {
            setHighBrowserZoom(getPageZoomScale() >= petroleum_sector_employment_HIGH_ZOOM_MIN);
        };
        tick();
        const vv = window.visualViewport;
        if (vv) {
            vv.addEventListener('resize', tick);
            vv.addEventListener('scroll', tick);
        }
        window.addEventListener('resize', tick);
        return () => {
            if (vv) {
                vv.removeEventListener('resize', tick);
                vv.removeEventListener('scroll', tick);
            }
            window.removeEventListener('resize', tick);
        };
    }, []);

    

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        width: 1100,
        height: 520,
        legendItems: REGION_ORDER.map((key) => ({
            label: regionLabel(key),
            color: REGION_COLORS[key],
        })),
    }),
        [REGION_COLORS, REGION_ORDER, exportChartTitle, fileSlugBase, regionLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('petroleum_sector_employment_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const chartHeight = highBrowserZoom
        ? windowWidth <= 480
            ? 260
            : windowWidth <= 768
              ? 300
              : 340
        : windowWidth <= 480
          ? 220
          : windowWidth <= 768
            ? 260
            : 300;
    const xMax = 118;
    const xTickVals = [0, 20, 40, 60, 80, 100];
    const xTickText =
        lang === 'en'
            ? ['0%', '20%', '40%', '60%', '80%', '100%']
            : ['0\u00a0%', '20\u00a0%', '40\u00a0%', '60\u00a0%', '80\u00a0%', '100\u00a0%'];

    const plotTopMargin = highBrowserZoom ? 16 : 52;
    const plotLeftMargin = highBrowserZoom ? 58 : 158;
    const plotRightMargin = highBrowserZoom ? 8 : 112;
    const plotBottomMargin = 48;
    const barGap = highBrowserZoom ? 0.52 : 0.35;

    const calloutThreshold = CALLOUT_THRESHOLD;

    const plotHeightPx = chartHeight - plotTopMargin - plotBottomMargin;
    const yBandPx = plotHeightPx / 2;
    const barThicknessPx = yBandPx / (1 + barGap);
    const barHalfPx = barThicknessPx / 2;
    const gapPx = barGap * barThicknessPx;
    const calloutFontH = calloutFontSize + 2;
    /** Sit in the lower half of the inter-bar gap — just above the indirect bar, below the direct bar. */
    const indirectAyBase = Math.round(
        barHalfPx + Math.max(2, (gapPx - calloutFontH) * 0.28) - 7
    );
    const NL_CALLOUT_ANGLE_DEG = 20;

    const estimateLabelHalfWidthPct = (text, fontSize) => {
        const digits = String(text).replace(/\D/g, '').length || 1;
        const unit = fontSize >= 16 ? 2.2 : 2.0;
        return Math.max(2.4, digits * unit + 0.8);
    };

    const labelSpan = (it) => {
        const hw = it.halfW;
        return [it.anchorX - hw, it.anchorX + hw];
    };

    const labelsOverlap = (a, b) => {
        const [aL, aR] = labelSpan(a);
        const [bL, bR] = labelSpan(b);
        return aL < bR - 0.35 && bL < aR - 0.35;
    };

    const collectSmallSegmentCallouts = (rowKey, fontSize) => {
        const raw = [];
        let acc = 0;
        REGION_ORDER.forEach((key) => {
            const shares = regionPcts[key] ?? {};
            const v = shares[rowKey] ?? 0;
            const segStart = acc;
            acc += v;
            if (v > 0 && v < calloutThreshold) {
                raw.push({
                    regionKey: key,
                    segStart,
                    segEnd: segStart + v,
                    cx: segStart + v / 2,
                    v,
                    text: formatPctCell(v).replace(/\u00a0/g, ' ')
                });
            }
        });

        return raw.map((it) => ({
            ...it,
            halfW: estimateLabelHalfWidthPct(it.text, fontSize),
            anchorX: it.cx,
            xanchor: 'center'
        }));
    };

    const assignCalloutSlots = (items, ayTiers, maxTier = ayTiers.length - 1) => {
        const sorted = [...items].sort((a, b) => a.anchorX - b.anchorX);
        const placed = [];

        sorted.forEach((it) => {
            let tier = 0;
            for (let t = 0; t <= maxTier; t += 1) {
                const conflict = placed.some((p) => p.tier === t && labelsOverlap(it, p));
                if (!conflict) {
                    tier = t;
                    break;
                }
                tier = t;
            }
            tier = Math.min(tier, maxTier);
            placed.push({ ...it, tier, ay: ayTiers[tier] });
        });

        for (let pass = 0; pass < 2; pass += 1) {
            for (let i = 1; i < placed.length; i += 1) {
                const prev = placed[i - 1];
                const curr = placed[i];
                if (prev.tier === curr.tier && labelsOverlap(prev, curr)) {
                    const nextTier = Math.min(curr.tier + 1, maxTier);
                    curr.tier = nextTier;
                    curr.ay = ayTiers[nextTier];
                }
            }
        }

        return placed;
    };

    const calloutToAnnotation = (it, yCat, fontSize) => ({
        x: it.anchorX,
        y: yCat,
        xref: 'x',
        yref: 'y',
        text: `<b>${it.text}</b>`,
        showarrow: true,
        arrowhead: 0,
        arrowsize: 1,
        arrowwidth: 1.5,
        arrowcolor: '#333333',
        ax: it.ax ?? 0,
        ay: it.ay,
        axref: 'pixel',
        ayref: 'pixel',
        font: { color: '#333333', size: fontSize, family: 'Arial, sans-serif' },
        xanchor: 'center',
        yanchor: 'bottom',
        cliponaxis: false
    });

    const directAyTiers = [-28, -40, -52, -64];
    const indirectAyTiers = [
        -indirectAyBase,
        -(indirectAyBase + 6),
        -(indirectAyBase + 12)
    ];

    const buildDirectCallouts = () =>
        assignCalloutSlots(
            collectSmallSegmentCallouts('direct', calloutFontSize),
            directAyTiers,
            directAyTiers.length - 1
        ).map((it) => {
            if (it.regionKey === 'nl') {
                const angleRad = (NL_CALLOUT_ANGLE_DEG * Math.PI) / 180;
                it.ax = Math.round(Math.abs(it.ay) * Math.tan(angleRad));
            }
            return calloutToAnnotation(it, directRowLabel, calloutFontSize);
        });

    const buildIndirectCallouts = () =>
        assignCalloutSlots(
            collectSmallSegmentCallouts('indirect', calloutFontSize),
            indirectAyTiers,
            indirectAyTiers.length - 1
        ).map((it) => {
            if (it.regionKey === 'nl') {
                const angleRad = (NL_CALLOUT_ANGLE_DEG * Math.PI) / 180;
                it.ax = Math.round(Math.abs(it.ay) * Math.tan(angleRad));
            }
            return calloutToAnnotation(it, indirectRowLabel, calloutFontSize);
        });

    const pctCalloutAnnotations = highBrowserZoom
        ? []
        : [...buildDirectCallouts(), ...buildIndirectCallouts()];

    const jobTotalAnnotations = highBrowserZoom
        ? []
        : [
              {
                  x: 101,
                  y: directRowLabel,
                  xref: 'x',
                  yref: 'y',
                  text: `<b>${formatJobsAnnotation(directTotal)}</b>`,
                  showarrow: false,
                  xanchor: 'left',
                  yanchor: 'middle',
                  font: { family: 'Arial, sans-serif', size: 18, color: '#333333' }
              },
              {
                  x: 101,
                  y: indirectRowLabel,
                  xref: 'x',
                  yref: 'y',
                  text: `<b>${formatJobsAnnotation(indirectTotal)}</b>`,
                  showarrow: false,
                  xanchor: 'left',
                  yanchor: 'middle',
                  font: { family: 'Arial, sans-serif', size: 18, color: '#333333' }
              }
          ];

    const allSharesDirect = REGION_ORDER.map((key) => ({
        key,
        v: (regionPcts[key] ?? {}).direct ?? 0
    }));
    const allSharesIndirect = REGION_ORDER.map((key) => ({
        key,
        v: (regionPcts[key] ?? {}).indirect ?? 0
    }));

    const pageChromeProps = {
        tabIndex: '-1',
        className: 'page-content page-105 petroleum-employment-by-region page-chrome page-chrome--bleed',
        'aria-labelledby': 'petroleum-employment-by-region-main-title',
        style: { backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) },
    };

    if (loading) {
        return (
            <PageShell {...pageChromeProps}>
                <PageStatus
                    lang={lang}
                    loading
                    loadingMessage={lang === 'en' ? 'Loading petroleum employment data…' : 'Chargement des données sur l\'emploi pétrolier…'}
                />
            </PageShell>
        );
    }

    if (error || !pageData) {
        return (
            <PageShell {...pageChromeProps}>
                <PageStatus
                    lang={lang}
                    error={error || (lang === 'en' ? 'Petroleum employment data is unavailable.' : 'Les données sur l\'emploi pétrolier ne sont pas disponibles.')}
                />
            </PageShell>
        );
    }

    return (
        <PageShell {...pageChromeProps}>
            <style>{`
.page-105.petroleum-employment-by-region {
}
.petroleum-employment-by-region-container {
    width: 100%;
    padding: 15px 0 40px 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}
.page-105 p.petroleum-employment-by-region-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    line-height: 1.5;
    max-width: 80ch;
    margin: 0 0 16px 0;
}
.page-105 p.petroleum-employment-by-region-intro-emphasis {
    font-family: 'Noto Sans', sans-serif;
    font-size: 30px;
    font-weight: bold;
    color: #423330;
    line-height: 1.45;
    max-width: 80ch;
    margin: 0 0 18px 0;
}
.page-105 .petroleum-employment-by-region-intro-direct,
.page-105 .petroleum-employment-by-region-intro-alberta {
    color: #000000;
    font-weight: bold;
}
.petroleum-employment-by-region-chart-frame {
    margin-top: 20px;
    margin-bottom: 0;
}
.petroleum-employment-by-region-chart-heading {
    color: var(--gc-text);
    margin: 0 0 16px 0;
}
.petroleum-employment-by-region-chart-block {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
}
.petroleum-employment-by-region-chart {
    width: 100%;
    position: relative;
    margin-bottom: 0 !important;
}
.petroleum-employment-by-region-chart-totals {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 20px;
    margin-top: 10px;
    margin-bottom: 2px;
    font-family: 'Noto Sans', sans-serif;
    font-size: 17px;
    line-height: 1.4;
    color: var(--gc-text);
}
.petroleum-employment-by-region-chart-totals span {
    font-variant-numeric: tabular-nums;
}
.petroleum-employment-by-region-segment-strips {
    margin-top: 12px;
    margin-bottom: 4px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.petroleum-employment-by-region-segment-strip {
    font-family: 'Noto Sans', sans-serif;
    color: var(--gc-text);
}
.petroleum-employment-by-region-segment-strip-kicker {
    display: block;
    font-size: 15px;
    font-weight: bold;
    margin-bottom: 8px;
    line-height: 1.35;
}
.petroleum-employment-by-region-segment-strip-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 20px;
    list-style: none;
    margin: 0;
    padding: 0;
}
.petroleum-employment-by-region-segment-strip-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 0 1 auto;
    min-width: 0;
    font-size: 15px;
    line-height: 1.35;
    white-space: nowrap;
}
.petroleum-employment-by-region-segment-strip-swatch {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 0.12);
}
.petroleum-employment-by-region-segment-strip-pct {
    font-variant-numeric: tabular-nums;
}
.petroleum-employment-by-region-legend-wrap {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    margin-bottom: 20px;
    width: 100%;
}
.petroleum-employment-by-region-legend-grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px 0;
    font-family: 'Noto Sans', sans-serif;
}
.petroleum-employment-by-region-legend-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px 28px;
}
.petroleum-employment-by-region-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
}
.petroleum-employment-by-region-legend-swatch {
    width: 22px;
    height: 14px;
    flex-shrink: 0;
}
.petroleum-employment-by-region-legend-label {
    font-size: 18px;
    color: var(--gc-text);
}
.petroleum-employment-by-region-table-wrapper {
    display: block;
    width: 100%;
    margin-top: 20px;
    margin-bottom: 0;
}
@media (max-width: 768px) {
    .page-105 p.petroleum-employment-by-region-intro { font-size: 18px; }
    .page-105 p.petroleum-employment-by-region-intro-emphasis { font-size: 24px; }
    .petroleum-employment-by-region-chart-heading { font-size: 26px; }
    .petroleum-employment-by-region-legend-label { font-size: 16px; }
    .petroleum-employment-by-region-chart-totals { font-size: 16px; }
    .petroleum-employment-by-region-segment-strip-kicker,
    .petroleum-employment-by-region-segment-strip-item {
        font-size: 14px;
    }
}
@media (max-width: 480px) {
    .petroleum-employment-by-region-legend-label { font-size: 14px; }
    .petroleum-employment-by-region-segment-strip-list {
        gap: 8px 14px;
    }
    .petroleum-employment-by-region-segment-strip-item {
        font-size: 13px;
    }
}
            `}</style>

            <div className="petroleum-employment-by-region-container">
                <h1 id="petroleum-employment-by-region-main-title" className="wb-inv">
                    {substitute(getText('petroleum_sector_employment_aria_page', lang), textVars)}
                </h1>
                <header>
                    <p className="petroleum-employment-by-region-intro">
                        <span>{getText('petroleum_sector_employment_p1a', lang)}</span>
                        <strong className="petroleum-employment-by-region-intro-direct">{substitute(getText('petroleum_sector_employment_p1b', lang), textVars)}</strong>
                        <span>{substitute(getText('petroleum_sector_employment_p1c', lang), textVars)}</span>
                    </p>
                    <p className="petroleum-employment-by-region-intro-emphasis">
                        {substitute(getText('petroleum_sector_employment_p1d', lang), textVars)}
                        {getText('petroleum_sector_employment_p1e', lang)}
                    </p>
                    <p className="petroleum-employment-by-region-intro">
                        <strong className="petroleum-employment-by-region-intro-alberta">{substitute(getText('petroleum_sector_employment_p2a', lang), textVars)}</strong>
                        <span>{substitute(getText('petroleum_sector_employment_p2b', lang), textVars)}</span>
                    </p>
                </header>

                <div className="petroleum-employment-by-region-chart-frame page-chrome-chart-frame">
                    <h2 className="petroleum-employment-by-region-chart-heading page-chrome-chart-title">{chartHeading}</h2>
                    <div className="petroleum-employment-by-region-chart-block">
                        <div role="region" aria-label={chartAria} tabIndex="0">
                            {hasSelection && <ClearSelectionButton lang={lang} onClick={clearSelection} />}
                            <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                                <div aria-hidden="true">
                                    <Plot
                                        key={highBrowserZoom ? 'petroleum-employment-by-region-plot-highzoom' : 'petroleum-employment-by-region-plot-default'}
                                        data={plotTraces}
                                        layout={{
                                            barmode: 'stack',
                                            bargap: barGap,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 16, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            xaxis: {
                                                range: [0, xMax],
                                                tickmode: 'array',
                                                tickvals: xTickVals,
                                                ticktext: xTickText,
                                                showgrid: true,
                                                zeroline: false,
                                                tickfont: tickFontX,
                                                automargin: true
                                            },
                                            yaxis: {
                                                type: 'category',
                                                categoryorder: 'array',
                                                categoryarray: [plotYIndirectLabel, plotYDirectLabel],
                                                showgrid: false,
                                                tickfont: tickFontY,
                                                automargin: true
                                            },
                                            showlegend: false,
                                            margin: { l: plotLeftMargin, r: plotRightMargin, t: plotTopMargin, b: 48 },
                                            autosize: true,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            annotations: [...pctCalloutAnnotations, ...jobTotalAnnotations]
                                        }}
                                        config={plotConfig}
                                        className="petroleum-employment-by-region-chart"
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler={true}
                                        onClick={handleChartClick}
                                    />
                                </div>
                            </figure>

                            {highBrowserZoom && (
                                <div className="petroleum-employment-by-region-chart-totals">
                                    <span>
                                        <strong>{directRowLabel}:</strong> {formatJobsAnnotation(directTotal)}
                                    </span>
                                    <span>
                                        <strong>{indirectRowLabel}:</strong> {formatJobsAnnotation(indirectTotal)}
                                    </span>
                                </div>
                            )}

                            {highBrowserZoom && (
                                <div className="petroleum-employment-by-region-segment-strips">
                                    <div className="petroleum-employment-by-region-segment-strip">
                                        <span className="petroleum-employment-by-region-segment-strip-kicker" id="petroleum-employment-by-region-highzoom-direct">
                                            {getText('petroleum_sector_employment_row_direct', lang)}
                                        </span>
                                        <ul
                                            className="petroleum-employment-by-region-segment-strip-list"
                                            role="list"
                                            aria-labelledby="petroleum-employment-by-region-highzoom-direct"
                                        >
                                            {allSharesDirect.map((s) => (
                                                <li
                                                    key={s.key}
                                                    className="petroleum-employment-by-region-segment-strip-item"
                                                    role="listitem"
                                                    aria-label={`${regionFullName(s.key)}, ${formatShareSpoken(s.v)}`}
                                                >
                                                    <span
                                                        className="petroleum-employment-by-region-segment-strip-swatch"
                                                        style={{ backgroundColor: REGION_COLORS[s.key] }}
                                                        aria-hidden="true"
                                                    />
                                                    <span aria-hidden="true">{regionLabel(s.key)}</span>
                                                    <span className="petroleum-employment-by-region-segment-strip-pct" aria-hidden="true">
                                                        {formatPctCell(s.v)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="petroleum-employment-by-region-segment-strip">
                                        <span className="petroleum-employment-by-region-segment-strip-kicker" id="petroleum-employment-by-region-highzoom-indirect">
                                            {getText('petroleum_sector_employment_row_indirect', lang)}
                                        </span>
                                        <ul
                                            className="petroleum-employment-by-region-segment-strip-list"
                                            role="list"
                                            aria-labelledby="petroleum-employment-by-region-highzoom-indirect"
                                        >
                                            {allSharesIndirect.map((s) => (
                                                <li
                                                    key={s.key}
                                                    className="petroleum-employment-by-region-segment-strip-item"
                                                    role="listitem"
                                                    aria-label={`${regionFullName(s.key)}, ${formatShareSpoken(s.v)}`}
                                                >
                                                    <span
                                                        className="petroleum-employment-by-region-segment-strip-swatch"
                                                        style={{ backgroundColor: REGION_COLORS[s.key] }}
                                                        aria-hidden="true"
                                                    />
                                                    <span aria-hidden="true">{regionLabel(s.key)}</span>
                                                    <span className="petroleum-employment-by-region-segment-strip-pct" aria-hidden="true">
                                                        {formatPctCell(s.v)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!highBrowserZoom && (
                            <div className="petroleum-employment-by-region-legend-wrap" aria-hidden="true">
                                <div className="petroleum-employment-by-region-legend-grid">
                                    {LEGEND_ROWS.map((row, ri) => (
                                        <div key={ri} className="petroleum-employment-by-region-legend-row">
                                            {row.map((key) => (
                                                <div key={key} className="petroleum-employment-by-region-legend-item">
                                                    <span
                                                        className="petroleum-employment-by-region-legend-swatch"
                                                        style={{ backgroundColor: REGION_COLORS[key] }}
                                                    />
                                                    <span className="petroleum-employment-by-region-legend-label">{regionLabel(key)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="petroleum-employment-by-region-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [3200, 2400, 2400],
                                fontSize: 20,
                            }}
                            caption={getText('petroleum_sector_employment_table_caption', lang)}
                            tableAriaLabel={getText('petroleum_sector_employment_table_aria', lang)}
                            renderCell={(raw, { row, colIndex }) => {
                                if (row?.isTotal) {
                                    const text = colIndex === 0
                                        ? String(raw ?? '')
                                        : formatJobsTableCell(raw);
                                    return <strong>{text}</strong>;
                                }
                                if (colIndex === 0) return String(raw ?? '');
                                if (raw == null || Number.isNaN(raw)) return '\u2014';
                                return String(raw);
                            }}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default PetroleumEmploymentByRegion;
