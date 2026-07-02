import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getPetroleumEmploymentByRegionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

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

const PAGE105_HIGH_ZOOM_MIN = 1.09;

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

const Page105 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [highBrowserZoom, setHighBrowserZoom] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const reportingYear = pageData?.reportingYear ?? null;
    const regionPcts = pageData?.regionPcts ?? {};
    const directTotal = pageData?.directTotal ?? null;
    const indirectTotal = pageData?.indirectTotal ?? null;
    const topIndirect = pageData?.topIndirect ?? [];

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    useEffect(() => {
        getPetroleumEmploymentByRegionData()
            .then(setPageData)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const formatJobsShort = (n) => {
        if (n == null || Number.isNaN(n)) return '\u2014';
        if (lang === 'en' && n >= 1000) return `${Math.round(n / 1000)}K`;
        return Math.round(n).toLocaleString(locale);
    };

    const narrativePct = (v) => {
        if (v == null || Number.isNaN(v)) return '\u2014';
        const s = v.toLocaleString(locale);
        return lang === 'en' ? `${s}%` : `${s}\u00a0%`;
    };

    const textVars = useMemo(() => {
        const provinceName = (key) => getText(`page105_region_${key}_full`, lang);
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
    }, [lang, reportingYear, directTotal, indirectTotal, topIndirect]);

    const directRowLabel = getText('page105_row_direct', lang);
    const indirectRowLabel = getText('page105_row_indirect', lang);
    const plotYDirectLabel = highBrowserZoom ? getText('page105_row_direct_compact', lang) : directRowLabel;
    const plotYIndirectLabel = highBrowserZoom ? getText('page105_row_indirect_compact', lang) : indirectRowLabel;

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
        return `${formatJobsShort(n)} ${getText('page105_jobs_word', lang)}`;
    };

    const formatPctCell = (v) => {
        if (v == null) return '\u2014';
        const s = v.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
        return lang === 'en' ? `${s}%` : `${s}\u00a0%`;
    };

    const formatJobsTableCell = (n) => n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');

    const regionLabel = (key) => getText(`page105_region_${key}`, lang);
    const regionFullName = (key) => getText(`page105_region_${key}_full`, lang);

    const fileSlugBase = `${stripHtml(getText('page105_export_slug', lang))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'petroleum-employment-by-region'}-${reportingYear ?? 'latest'}`;

    const barPctFontBase = windowWidth <= 480 ? 16 : 20;
    const barPctFontLarge = windowWidth <= 480 ? 22 : 26;
    /** Leader-line callout labels (direct + indirect rows) at 100% zoom. */
    const calloutFontSize = windowWidth <= 480 ? 14 : 16;

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    const plotTraces = REGION_ORDER.map((key, traceIndex) => {
        const base = REGION_COLORS[key];
        const shares = regionPcts[key] ?? {};
        const d = shares.direct ?? 0;
        const ind = shares.indirect ?? 0;
        const markerColor =
            selectedPoints === null
                ? base
                : [0, 1].map((pointIndex) => {
                      const isSelected = selectedPoints.some(
                          (p) => p.traceIndex === traceIndex && p.pointIndex === pointIndex
                      );
                      return isSelected ? base : hexToRgba(base, 0.28);
                  });
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

    const chartAriaParts = REGION_ORDER.map((k) => {
        const r = regionPcts[k] ?? {};
        const nm = getText(`page105_region_${k}_full`, lang);
        return `${nm}: ${formatPctCell(r.direct)} ${getText('page105_aria_direct', lang)}, ${formatPctCell(r.indirect)} ${getText('page105_aria_indirect', lang)}`;
    });
    const chartAria =
        substitute(getText('page105_chart_aria_prefix', lang), textVars) +
        chartAriaParts.join('. ') +
        '.';

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const tick = () => {
            setHighBrowserZoom(getPageZoomScale() >= PAGE105_HIGH_ZOOM_MIN);
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

    useEffect(() => {
        if (!chartRef.current) return;
        const setupChartAccessibility = () => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return;
            plotContainer.querySelectorAll('.main-svg, .svg-container svg').forEach((svg) => {
                svg.setAttribute('aria-hidden', 'true');
            });
            plotContainer.querySelectorAll('.modebar-btn').forEach((btn) => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || /charger/i.test(dataTitle))) {
                    btn.setAttribute('aria-label', dataTitle);
                    btn.setAttribute('role', 'button');
                    btn.setAttribute('tabindex', '0');
                    btn.removeAttribute('aria-hidden');
                    btn.onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            btn.click();
                        }
                    };
                } else {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };
        const timer = setTimeout(setupChartAccessibility, 500);
        const observer = new MutationObserver(setupChartAccessibility);
        observer.observe(chartRef.current, { childList: true, subtree: true });
        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [lang, selectedPoints, highBrowserZoom]);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll) return;
        let isSyncingTop = false;
        let isSyncingTable = false;
        const syncTopToTable = () => {
            if (isSyncingTable) return;
            isSyncingTop = true;
            tableScroll.scrollLeft = topScroll.scrollLeft;
            requestAnimationFrame(() => {
                isSyncingTop = false;
            });
        };
        const syncTableToTop = () => {
            if (isSyncingTop) return;
            isSyncingTable = true;
            topScroll.scrollLeft = tableScroll.scrollLeft;
            requestAnimationFrame(() => {
                isSyncingTable = false;
            });
        };
        const updateTopScrollWidth = () => {
            const table = tableScroll.querySelector('table');
            if (table && topScroll.firstChild) {
                topScroll.firstChild.style.width = `${table.scrollWidth}px`;
            }
        };
        topScroll.addEventListener('scroll', syncTopToTable);
        tableScroll.addEventListener('scroll', syncTableToTop);
        updateTopScrollWidth();
        const resizeObserver = new ResizeObserver(updateTopScrollWidth);
        const table = tableScroll.querySelector('table');
        if (table) resizeObserver.observe(table);
        return () => {
            topScroll.removeEventListener('scroll', syncTopToTable);
            tableScroll.removeEventListener('scroll', syncTableToTop);
            resizeObserver.disconnect();
        };
    }, [isTableOpen]);

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = stripHtml(substitute(getText('page105_chart_heading', lang), textVars));
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1100,
                height: 520,
                scale: 2
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 72;
                const legendBlock = 88;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendBlock;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 46);
                ctx.drawImage(img, 0, titleHeight);
                ctx.font = '20px Arial';
                let rowY = titleHeight + img.height + 22;
                LEGEND_ROWS.forEach((row) => {
                    let rowW = 0;
                    row.forEach((key) => {
                        const lab = regionLabel(key);
                        rowW += 26 + ctx.measureText(lab).width + 28;
                    });
                    let lx = (canvas.width - rowW) / 2;
                    row.forEach((key) => {
                        const lab = regionLabel(key);
                        ctx.fillStyle = REGION_COLORS[key];
                        ctx.fillRect(lx, rowY - 12, 20, 12);
                        ctx.fillStyle = '#333333';
                        ctx.fillText(lab, lx + 26, rowY);
                        lx += 26 + ctx.measureText(lab).width + 28;
                    });
                    rowY += 30;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileSlugBase}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error(err);
        }
    };

    const downloadTableAsCSV = () => {
        const h1 = getText('page105_table_col_region', lang);
        const h2 = getText('page105_table_col_direct_pct', lang);
        const h3 = getText('page105_table_col_indirect_pct', lang);
        const headers = [h1, h2, h3];
        const rows = REGION_ORDER.map((k) => {
            const r = regionPcts[k] ?? {};
            return [regionLabel(k), r.direct ?? '', r.indirect ?? ''];
        });
        const totalRow = [
            getText('page105_table_total_jobs_row', lang),
            formatJobsTableCell(directTotal),
            formatJobsTableCell(indirectTotal)
        ];
        const csvContent = [headers.join(','), ...rows.map((row) => row.join(',')), totalRow.join(',')].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: stripHtml(substitute(getText('page105_chart_heading', lang), textVars)),
                                    bold: true,
                                    size: 28
                                })
                            ]
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [3200, 2400, 2400],
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    children: [
                                                        new TextRun({
                                                            text: getText('page105_table_col_region', lang),
                                                            bold: true
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [
                                                        new TextRun({
                                                            text: getText('page105_table_col_direct_pct', lang),
                                                            bold: true
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [
                                                        new TextRun({
                                                            text: getText('page105_table_col_indirect_pct', lang),
                                                            bold: true
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                ...REGION_ORDER.map(
                                    (k) =>
                                        new TableRow({
                                            children: [
                                                new TableCell({
                                                    children: [
                                                        new Paragraph({
                                                            children: [new TextRun({ text: regionLabel(k) })]
                                                        })
                                                    ]
                                                }),
                                                new TableCell({
                                                    children: [
                                                        new Paragraph({
                                                            alignment: AlignmentType.CENTER,
                                                            children: [
                                                                new TextRun({
                                                                    text: String((regionPcts[k] ?? {}).direct ?? '')
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                }),
                                                new TableCell({
                                                    children: [
                                                        new Paragraph({
                                                            alignment: AlignmentType.CENTER,
                                                            children: [
                                                                new TextRun({
                                                                    text: String((regionPcts[k] ?? {}).indirect ?? '')
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                ),
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    children: [
                                                        new TextRun({
                                                            text: getText('page105_table_total_jobs_row', lang),
                                                            bold: true
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [
                                                        new TextRun({
                                                            text: formatJobsTableCell(directTotal),
                                                            bold: true
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [
                                                        new TextRun({
                                                            text: formatJobsTableCell(indirectTotal),
                                                            bold: true
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

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

    const handleChartClick = (data) => {
        if (!data.points || data.points.length === 0) return;
        const pt = data.points[0];
        const traceIndex = pt.curveNumber;
        const pointIndex = pt.pointIndex;
        if (traceIndex === undefined || pointIndex === undefined) return;
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const same = last.traceIndex === traceIndex && last.pointIndex === pointIndex;
            const doubleTap = same && now - last.time < 300;
            lastClickRef.current = { time: now, traceIndex, pointIndex };
            if (!doubleTap) return;
        }
        setSelectedPoints((prev) => {
            const key = { traceIndex, pointIndex };
            if (prev === null) return [key];
            const idx = prev.findIndex((p) => p.traceIndex === traceIndex && p.pointIndex === pointIndex);
            if (idx >= 0) {
                const next = prev.filter((_, i) => i !== idx);
                return next.length === 0 ? null : next;
            }
            return [...prev, key];
        });
    };

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

    if (loading) {
        return (
            <main id="main-content" className="page-content page-105" role="main" style={{ backgroundColor: '#ffffff' }}>
                <p>{lang === 'en' ? 'Loading petroleum employment data…' : 'Chargement des données sur l\'emploi pétrolier…'}</p>
            </main>
        );
    }

    if (error || !pageData) {
        return (
            <main id="main-content" className="page-content page-105" role="main" style={{ backgroundColor: '#ffffff' }}>
                <p role="alert">{error || (lang === 'en' ? 'Petroleum employment data is unavailable.' : 'Les données sur l\'emploi pétrolier ne sont pas disponibles.')}</p>
            </main>
        );
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-105"
            role="main"
            aria-labelledby="page105-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-105.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-105 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .page105-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                .page-105 p.page105-intro {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #332f30;
                    line-height: 1.5;
                    max-width: 80ch;
                    margin: 0 0 16px 0;
                }
                .page-105 p.page105-intro-emphasis {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 30px;
                    font-weight: bold;
                    color: #423330;
                    line-height: 1.45;
                    max-width: 80ch;
                    margin: 0 0 18px 0;
                }
                .page-105 .page105-intro-direct,
                .page-105 .page105-intro-alberta {
                    color: #000000;
                    font-weight: bold;
                }
                .page105-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 20px;
                    margin-bottom: 0;
                    box-sizing: border-box;
                    overflow: visible;
                }
                .page105-chart-heading {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 16px 0;
                }
                .page105-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .page105-chart {
                    width: 100%;
                    position: relative;
                    margin-bottom: 0 !important;
                }
                .page105-chart-totals {
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
                .page105-chart-totals span {
                    font-variant-numeric: tabular-nums;
                }
                .page105-segment-strips {
                    margin-top: 12px;
                    margin-bottom: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .page105-segment-strip {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                }
                .page105-segment-strip-kicker {
                    display: block;
                    font-size: 15px;
                    font-weight: bold;
                    margin-bottom: 8px;
                    line-height: 1.35;
                }
                .page105-segment-strip-list {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 10px 20px;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .page105-segment-strip-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    flex: 0 1 auto;
                    min-width: 0;
                    font-size: 15px;
                    line-height: 1.35;
                    white-space: nowrap;
                }
                .page105-segment-strip-swatch {
                    width: 14px;
                    height: 14px;
                    flex-shrink: 0;
                    border: 1px solid rgba(0, 0, 0, 0.12);
                }
                .page105-segment-strip-pct {
                    font-variant-numeric: tabular-nums;
                }
                .page105-legend-wrap {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    width: 100%;
                }
                .page105-legend-grid {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px 0;
                    font-family: 'Noto Sans', sans-serif;
                }
                .page105-legend-row {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 12px 28px;
                }
                .page105-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .page105-legend-swatch {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                }
                .page105-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .page105-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                .page105-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                    list-style: none;
                }
                .page105-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }
                .page105-table-wrapper details > summary::marker {
                    display: none;
                    content: '';
                }
                .page105-table-wrapper details > summary:hover {
                    background-color: #404040 !important;
                }
                .page105-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }
                .page105-table-wrapper .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }
                .page105-table-wrapper .table-responsive table th,
                .page105-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }
                .page105-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }
                .page105-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }
                .page105-download-buttons button:hover {
                    background: #404040 !important;
                }
                @media (max-width: 768px) {
                    .page-105 p.page105-intro { font-size: 18px; }
                    .page-105 p.page105-intro-emphasis { font-size: 24px; }
                    .page105-chart-heading { font-size: 26px; }
                    .page105-legend-label { font-size: 16px; }
                    .page105-chart-totals { font-size: 16px; }
                    .page105-segment-strip-kicker,
                    .page105-segment-strip-item {
                        font-size: 14px;
                    }
                }
                @media (max-width: 480px) {
                    .page105-legend-label { font-size: 14px; }
                    .page105-segment-strip-list {
                        gap: 8px 14px;
                    }
                    .page105-segment-strip-item {
                        font-size: 13px;
                    }
                }
            `}</style>

            <div className="page105-container">
                <h1 id="page105-main-title" className="wb-inv">
                    {substitute(getText('page105_aria_page', lang), textVars)}
                </h1>
                <header>
                    <p className="page105-intro">
                        <span>{getText('page105_p1a', lang)}</span>
                        <strong className="page105-intro-direct">{substitute(getText('page105_p1b', lang), textVars)}</strong>
                        <span>{substitute(getText('page105_p1c', lang), textVars)}</span>
                    </p>
                    <p className="page105-intro-emphasis">
                        {substitute(getText('page105_p1d', lang), textVars)}
                        {getText('page105_p1e', lang)}
                    </p>
                    <p className="page105-intro">
                        <strong className="page105-intro-alberta">{substitute(getText('page105_p2a', lang), textVars)}</strong>
                        <span>{substitute(getText('page105_p2b', lang), textVars)}</span>
                    </p>
                </header>

                <div className="page105-chart-frame">
                    <h2 className="page105-chart-heading">{substitute(getText('page105_chart_heading', lang), textVars)}</h2>
                    <div className="page105-chart-block">
                        <div role="region" aria-label={chartAria} tabIndex="0">
                            {selectedPoints !== null && (
                                <div style={{ marginBottom: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPoints(null)}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
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
                            <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                                <div aria-hidden="true">
                                    <Plot
                                        key={highBrowserZoom ? 'page105-plot-highzoom' : 'page105-plot-default'}
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
                                        config={{
                                            displayModeBar: true,
                                            displaylogo: false,
                                            responsive: true,
                                            scrollZoom: false,
                                            modeBarButtonsToRemove: [
                                                'pan2d',
                                                'select2d',
                                                'lasso2d',
                                                'zoom2d',
                                                'zoomIn2d',
                                                'zoomOut2d',
                                                'autoScale2d',
                                                'resetScale2d',
                                                'toImage'
                                            ],
                                            modeBarButtonsToAdd: [
                                                {
                                                    name: getText('page105_download_chart', lang),
                                                    icon: {
                                                        width: 24,
                                                        height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                                    },
                                                    click: (gd) => downloadChartWithTitle(gd)
                                                }
                                            ]
                                        }}
                                        className="page105-chart"
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler={true}
                                        onClick={handleChartClick}
                                    />
                                </div>
                            </figure>

                            {highBrowserZoom && (
                                <div className="page105-chart-totals">
                                    <span>
                                        <strong>{directRowLabel}:</strong> {formatJobsAnnotation(directTotal)}
                                    </span>
                                    <span>
                                        <strong>{indirectRowLabel}:</strong> {formatJobsAnnotation(indirectTotal)}
                                    </span>
                                </div>
                            )}

                            {highBrowserZoom && (
                                <div className="page105-segment-strips">
                                    <div className="page105-segment-strip">
                                        <span className="page105-segment-strip-kicker" id="page105-highzoom-direct">
                                            {getText('page105_row_direct', lang)}
                                        </span>
                                        <ul
                                            className="page105-segment-strip-list"
                                            role="list"
                                            aria-labelledby="page105-highzoom-direct"
                                        >
                                            {allSharesDirect.map((s) => (
                                                <li
                                                    key={s.key}
                                                    className="page105-segment-strip-item"
                                                    role="listitem"
                                                    aria-label={`${regionFullName(s.key)}, ${formatPctCell(s.v)}`}
                                                >
                                                    <span
                                                        className="page105-segment-strip-swatch"
                                                        style={{ backgroundColor: REGION_COLORS[s.key] }}
                                                        aria-hidden="true"
                                                    />
                                                    <span aria-hidden="true">{regionLabel(s.key)}</span>
                                                    <span className="page105-segment-strip-pct" aria-hidden="true">
                                                        {formatPctCell(s.v)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="page105-segment-strip">
                                        <span className="page105-segment-strip-kicker" id="page105-highzoom-indirect">
                                            {getText('page105_row_indirect', lang)}
                                        </span>
                                        <ul
                                            className="page105-segment-strip-list"
                                            role="list"
                                            aria-labelledby="page105-highzoom-indirect"
                                        >
                                            {allSharesIndirect.map((s) => (
                                                <li
                                                    key={s.key}
                                                    className="page105-segment-strip-item"
                                                    role="listitem"
                                                    aria-label={`${regionFullName(s.key)}, ${formatPctCell(s.v)}`}
                                                >
                                                    <span
                                                        className="page105-segment-strip-swatch"
                                                        style={{ backgroundColor: REGION_COLORS[s.key] }}
                                                        aria-hidden="true"
                                                    />
                                                    <span aria-hidden="true">{regionLabel(s.key)}</span>
                                                    <span className="page105-segment-strip-pct" aria-hidden="true">
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
                            <div className="page105-legend-wrap" aria-hidden="true">
                                <div className="page105-legend-grid">
                                    {LEGEND_ROWS.map((row, ri) => (
                                        <div key={ri} className="page105-legend-row">
                                            {row.map((key) => (
                                                <div key={key} className="page105-legend-item">
                                                    <span
                                                        className="page105-legend-swatch"
                                                        style={{ backgroundColor: REGION_COLORS[key] }}
                                                    />
                                                    <span className="page105-legend-label">{regionLabel(key)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="page105-table-wrapper">
                        <details className="page105-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {getText('page105_table_summary', lang)}
                                <span className="wb-inv">{getText('page105_table_toggle_sr', lang)}</span>
                            </summary>

                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    display: windowWidth <= 768 ? 'none' : 'block'
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }} />
                            </div>
                            <div
                                ref={tableScrollRef}
                                className="table-responsive"
                                role="region"
                                tabIndex="0"
                                aria-label={getText('page105_table_aria', lang)}
                            >
                                <table className="table table-bordered table-striped table-hover" style={{ marginTop: '15px' }}>
                                    <caption className="wb-inv">{getText('page105_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <th
                                                scope="col"
                                                style={{
                                                    position: 'sticky',
                                                    left: 0,
                                                    backgroundColor: '#f8f9fa',
                                                    zIndex: 2,
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    borderRight: '2px solid #dee2e6'
                                                }}
                                            >
                                                {getText('page105_table_col_region', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{ fontWeight: 'bold', textAlign: 'center', verticalAlign: 'bottom' }}
                                            >
                                                {getText('page105_table_col_direct_pct', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{ fontWeight: 'bold', textAlign: 'center', verticalAlign: 'bottom' }}
                                            >
                                                {getText('page105_table_col_indirect_pct', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {REGION_ORDER.map((k) => (
                                            <tr key={k}>
                                                <th
                                                    scope="row"
                                                    style={{
                                                        position: 'sticky',
                                                        left: 0,
                                                        zIndex: 1,
                                                        fontWeight: 'bold',
                                                        textAlign: 'center',
                                                        borderRight: '2px solid #dee2e6',
                                                        backgroundColor: '#fff'
                                                    }}
                                                >
                                                    {regionLabel(k)}
                                                </th>
                                                <td style={{ textAlign: 'center' }}>{(regionPcts[k] ?? {}).direct ?? '\u2014'}</td>
                                                <td style={{ textAlign: 'center' }}>{(regionPcts[k] ?? {}).indirect ?? '\u2014'}</td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <th
                                                scope="row"
                                                style={{
                                                    position: 'sticky',
                                                    left: 0,
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    borderRight: '2px solid #dee2e6',
                                                    backgroundColor: '#f8f9fa'
                                                }}
                                            >
                                                {getText('page105_table_total_jobs_row', lang)}
                                            </th>
                                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                                {formatJobsTableCell(directTotal)}
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                                {formatJobsTableCell(indirectTotal)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="page105-download-buttons">
                                <button type="button" onClick={downloadTableAsCSV}>
                                    {getText('page105_download_csv', lang)}
                                </button>
                                <button type="button" onClick={() => downloadTableAsDocx()}>
                                    {getText('page105_download_docx', lang)}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page105;
