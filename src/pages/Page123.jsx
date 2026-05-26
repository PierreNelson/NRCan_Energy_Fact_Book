import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import page123BgUrl from '../assets/page123_bg.png';

const CANADA_CAPSULE = '#423330';

/** World proved natural gas reserves: top five + Canada rank/share by year (placeholder series). */
const DATA_BY_YEAR = {
    2020: {
        totalTcf: 7320,
        totalTcm: 207,
        top: [
            { key: 'russia', pct: 24 },
            { key: 'iran', pct: 15 },
            { key: 'qatar', pct: 12 },
            { key: 'usa', pct: 7 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 11, pct: 2.8 }
    },
    2021: {
        totalTcf: 7400,
        totalTcm: 209,
        top: [
            { key: 'russia', pct: 23 },
            { key: 'iran', pct: 15 },
            { key: 'qatar', pct: 12 },
            { key: 'usa', pct: 7 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 11, pct: 2.9 }
    },
    2022: {
        totalTcf: 7480,
        totalTcm: 211,
        top: [
            { key: 'russia', pct: 23 },
            { key: 'iran', pct: 16 },
            { key: 'qatar', pct: 11 },
            { key: 'usa', pct: 8 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 10, pct: 2.9 }
    },
    2023: {
        totalTcf: 7550,
        totalTcm: 213,
        top: [
            { key: 'russia', pct: 22 },
            { key: 'iran', pct: 16 },
            { key: 'qatar', pct: 11 },
            { key: 'usa', pct: 8 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 10, pct: 3 }
    },
    2024: {
        totalTcf: 7604,
        totalTcm: 215,
        top: [
            { key: 'russia', pct: 22 },
            { key: 'iran', pct: 16 },
            { key: 'qatar', pct: 11 },
            { key: 'usa', pct: 8 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 10, pct: 3 }
    }
};

const YEAR_KEYS = Object.keys(DATA_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b);
const YEARS_ASC = YEAR_KEYS;
const YEARS_DESC = [...YEAR_KEYS].reverse();
const PAGE123_DEFAULT_YEAR = YEAR_KEYS[YEAR_KEYS.length - 1];

const RESERVE_COLUMN_KEYS = ['russia', 'iran', 'qatar', 'usa', 'turkmenistan', 'canada'];

const pctFromBundle = (bundle, key) => {
    if (key === 'canada') return bundle.canada.pct;
    const it = bundle.top.find((i) => i.key === key);
    return it != null ? it.pct : '';
};

const formatCapsulePct = (pct, lang) => {
    const dec = pct % 1 === 0 ? 0 : 1;
    return Number(pct).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
    });
};

const pctWithUnit = (pct, lang) => {
    const s = formatCapsulePct(pct, lang);
    return lang === 'en' ? `${s}%` : `${s}\u00a0%`;
};

const formatReserveTotal = (n, lang) =>
    n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 });

const tablePctCell = (v, lang) => {
    if (v === '' || v == null) return '\u2014';
    return formatCapsulePct(v, lang);
};

const Page123 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(PAGE123_DEFAULT_YEAR);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const detailsRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const countryLabel = (key) =>
        key === 'turkmenistan'
            ? getText('page123_country_turkmenistan', lang)
            : getText(`page122_country_${key}`, lang);

    const bundle = DATA_BY_YEAR[year] || DATA_BY_YEAR[PAGE123_DEFAULT_YEAR];
    const yearSpanLabel = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;

    const historicalRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y];
                return {
                    year: y,
                    totalTcf: b.totalTcf,
                    totalTcm: b.totalTcm,
                    pcts: RESERVE_COLUMN_KEYS.map((k) => pctFromBundle(b, k))
                };
            }),
        []
    );

    const capsuleAriaParts = [
        ...bundle.top.map((row, i) => {
            const r = i + 1;
            const nm = countryLabel(row.key);
            return lang === 'en'
                ? `Rank ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} percent`
                : `Rang ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} pour cent`;
        }),
        lang === 'en'
            ? `Rank ${bundle.canada.rank}, ${countryLabel('canada')}, ${formatCapsulePct(bundle.canada.pct, lang)} percent`
            : `Rang ${bundle.canada.rank}, ${countryLabel('canada')}, ${formatCapsulePct(bundle.canada.pct, lang)} pour cent`
    ];
    const capsuleAria =
        (lang === 'en'
            ? `World proved natural gas reserves for ${year}: `
            : `Réserves mondiales prouvées de gaz naturel pour ${year} : `) +
        capsuleAriaParts.join('. ') +
        '.';

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (isTableOpen && detailsRef.current) {
            setTimeout(() => detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [isTableOpen]);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll) return undefined;

        const syncScrollbars = () => {
            const table = tableScroll.querySelector('table');
            if (!table) return;
            const scrollWidth = table.offsetWidth;
            const containerWidth = tableScroll.clientWidth;
            const topSpacer = topScroll.firstElementChild;
            if (topSpacer) topSpacer.style.width = `${scrollWidth}px`;
            topScroll.style.display = scrollWidth > containerWidth ? 'block' : 'none';
            if (scrollWidth > containerWidth) topScroll.style.opacity = '1';
        };

        const handleTopScroll = () => {
            if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft;
        };
        const handleTableScroll = () => {
            if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft;
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        const observer = new ResizeObserver(() => window.requestAnimationFrame(syncScrollbars));
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

    const renderCapsuleRow = (rank, key, pct, maxPct, isCanada) => {
        const rawRatio = maxPct > 0 ? pct / maxPct : 1;
        const barWidthPct = 70 + 20 * rawRatio;
        const name = countryLabel(key);
        return (
            <div
                key={`${key}-${rank}-${isCanada ? 'ca' : 'top'}-${year}`}
                className={`page108-capsule-row ${isCanada ? 'page108-capsule-row-canada' : ''}`}
            >
                <div className="page108-capsule-bar-wrap">
                    <div className="page108-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="page108-capsule-bar-text">
                            {rank} {name}
                        </span>
                    </div>
                </div>
                <div className="page108-capsule-connector" />
                <div className="page108-capsule-pill">
                    <span className="page108-capsule-pill-text">{pctWithUnit(pct, lang)}</span>
                </div>
            </div>
        );
    };

    const renderCapsuleBlock = () => {
        const maxPct = bundle.top[0]?.pct || 1;
        const els = bundle.top.map((row, index) =>
            renderCapsuleRow(index + 1, row.key, row.pct, maxPct, false)
        );
        els.push(
            <div key="ellipsis" className="page108-capsule-row page123-capsule-ellipsis" aria-hidden="true">
                <span>...</span>
            </div>
        );
        els.push(renderCapsuleRow(bundle.canada.rank, 'canada', bundle.canada.pct, maxPct, true));
        return els;
    };

    const downloadCsv = () => {
        const yCol = stripHtml(getText('page108_table_col_year', lang));
        const tcfCol = stripHtml(getText('page123_table_col_total_tcf', lang));
        const tcmCol = stripHtml(getText('page123_table_col_total_tcm', lang));
        const headers = [
            yCol,
            tcfCol,
            tcmCol,
            ...RESERVE_COLUMN_KEYS.map((k) => `${stripHtml(countryLabel(k))} (%)`)
        ];
        const rows = historicalRows.map((row) => [
            row.year,
            formatReserveTotal(row.totalTcf, lang),
            formatReserveTotal(row.totalTcm, lang),
            ...row.pcts.map((p) => (p === '' ? '' : formatCapsulePct(p, lang)))
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, lang === 'en' ? 'world_natural_gas_proved_reserves.csv' : 'reserves_prouvees_gaz_naturel.csv');
    };

    const downloadDocx = async () => {
        const title = stripHtml(getText('page123_doc_title', lang));
        const yCol = getText('page108_table_col_year', lang);
        const tcfCol = getText('page123_table_col_total_tcf', lang);
        const tcmCol = getText('page123_table_col_total_tcm', lang);
        const countryHeaders = RESERVE_COLUMN_KEYS.map((k) => `${stripHtml(countryLabel(k))} (%)`);

        const headerRow = new TableRow({
            children: [yCol, tcfCol, tcmCol, ...countryHeaders].map(
                (header) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 22 })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: { fill: 'E6E6E6' }
                    })
            )
        });

        const dataRows = historicalRows.map(
            (row) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(row.year), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: formatReserveTotal(row.totalTcf, lang), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: formatReserveTotal(row.totalTcm, lang), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        ...row.pcts.map(
                            (p) =>
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            children: [
                                                new TextRun({
                                                    text: p === '' ? '\u2014' : formatCapsulePct(p, lang),
                                                    size: 22
                                                })
                                            ],
                                            alignment: AlignmentType.CENTER
                                        })
                                    ]
                                })
                        )
                    ]
                })
        );

        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `${title} (${yearSpanLabel})`, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [1200, 1400, 1400, ...RESERVE_COLUMN_KEYS.map(() => 1280)],
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(
            blob,
            lang === 'en' ? 'world_natural_gas_proved_reserves.docx' : 'reserves_prouvees_gaz_naturel.docx'
        );
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-108 page-123 page123-natural-gas-reserves"
            role="main"
            aria-labelledby="page123-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-123.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-123.page123-natural-gas-reserves {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .page-123.page-content h1.page123-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px !important;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                    line-height: 1.2;
                }
                .page-123.page-content h1.page123-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .page123-capsule-ellipsis {
                    display: flex;
                    align-items: center;
                    min-height: 40px;
                    padding-left: 12%;
                    font-size: 24px !important;
                    color: #333;
                    font-family: 'Noto Sans', sans-serif;
                }
                .page123-chart-block .data-table-wrapper {
                    margin-bottom: 0;
                }
                .page123-hero-stack {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    margin-top: 10px;
                    margin-bottom: 10px;
                }
                .page123-rankings-layer {
                    z-index: 2;
                    position: relative;
                    width: 50%;
                    min-width: 360px;
                    max-width: 500px;
                    padding-top: 10px;
                }
                .page123-art-layer {
                    z-index: 1;
                    position: relative;
                    width: 100%;
                    margin-top: -200px;
                    pointer-events: none;
                }
                .page123-art-layer img {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .page123-natural-gas-reserves .page108-capsule-bar {
                    min-width: max-content !important;
                    padding-right: 14px !important;
                }
                .page123-natural-gas-reserves .page108-capsule-bar-text {
                    white-space: nowrap !important;
                    font-size: 16px !important;
                }
                .page123-natural-gas-reserves .page108-capsule-pill-text {
                    font-size: 16px !important;
                }
                @media (max-width: 1100px) {
                    .page123-art-layer { margin-top: -120px; }
                }
                /* Stacked layout: viewport width must exceed this after zoom (browsers often keep
                   layout width high on wide monitors — 900px was too low; ~1500px targets ~175% on 1080p–1440p). */
                @media (max-width: 1500px) {
                    .page123-rankings-layer {
                        width: 100%;
                        max-width: 100%;
                        padding-bottom: 20px;
                    }
                    .page123-art-layer {
                        margin-top: 0;
                    }
                }
                @media (max-width: 768px) {
                    .page-123.page-content h1.page123-title {
                        font-size: 37px !important;
                    }
                }
                .page-123.page123-natural-gas-reserves .page108-capsule-row-canada .page108-capsule-bar {
                    background-color: ${CANADA_CAPSULE};
                    color: #fff;
                }
                .page-123.page123-natural-gas-reserves .page108-capsule-row-canada .page108-capsule-connector {
                    background-color: ${CANADA_CAPSULE};
                }
                .page-123.page123-natural-gas-reserves .page108-capsule-row-canada .page108-capsule-pill {
                    border-width: 2px;
                    border-color: ${CANADA_CAPSULE};
                    font-weight: bold;
                }
            `}</style>

            <div className="page108-container">
                <header>
                    <h1 id="page123-main-title" className="page123-title">
                        {getText('page123_title', lang)}
                    </h1>
                </header>

                <div
                    ref={yearDropdownRef}
                    style={{
                        position: 'relative',
                        marginBottom: '20px',
                        width: '200px'
                    }}
                >
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                        {getText('year_slider_label', lang)}
                    </label>
                    <button
                        ref={yearButtonRef}
                        type="button"
                        onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                        aria-expanded={isYearDropdownOpen}
                        style={{
                            width: '100%',
                            padding: '10px 15px',
                            backgroundColor: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            textAlign: 'left',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '16px'
                        }}
                    >
                        <span>{year}</span>
                        <span aria-hidden="true" style={{ fontSize: '12px' }}>
                            {isYearDropdownOpen ? '▲' : '▼'}
                        </span>
                    </button>
                    {isYearDropdownOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                width: '100%',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                zIndex: 100,
                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                            }}
                        >
                            {YEARS_DESC.map((y) => {
                                const isSelected = year === y;
                                return (
                                    <button
                                        key={y}
                                        type="button"
                                        aria-pressed={isSelected}
                                        aria-label={String(y)}
                                        onClick={() => {
                                            setYear(y);
                                            setIsYearDropdownOpen(false);
                                            setTimeout(() => yearButtonRef.current?.focus(), 0);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 15px',
                                            cursor: 'pointer',
                                            border: 'none',
                                            borderBottom: '1px solid #eee',
                                            backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                                            fontFamily: 'Arial, sans-serif'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f5f5f5';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff';
                                        }}
                                    >
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                height: '18px',
                                                width: '18px',
                                                borderRadius: '50%',
                                                border: '1px solid #ccc',
                                                marginRight: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: '#fff'
                                            }}
                                        >
                                            {isSelected && (
                                                <span
                                                    style={{
                                                        height: '10px',
                                                        width: '10px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#000'
                                                    }}
                                                />
                                            )}
                                        </span>
                                        <span aria-hidden="true" style={{ fontSize: '16px', color: '#333' }}>
                                            {y}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year
                            ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}`
                            : ''}
                    </div>
                </div>

                <div className="page108-content-wrapper layout-stacked page123-chart-block">
                    <div className="page123-hero-stack">
                        <div className="page123-rankings-layer page108-chart-section">
                            <h3 className="page108-graphic-title">
                                <span aria-hidden="true">
                                    {getText('page140_reserves_kicker', lang)}
                                    {' \u2013 '}
                                    <strong>
                                        {formatReserveTotal(bundle.totalTcf, lang)} {getText('page123_unit_tcf', lang)}
                                    </strong>
                                    {' '}
                                    ({formatReserveTotal(bundle.totalTcm, lang)} {getText('page123_unit_tcm', lang)})
                                    {' '}
                                    ({year})
                                </span>
                            </h3>

                            <div className="page108-chart-container" role="region" aria-label={capsuleAria} tabIndex="0">
                                <div className="page108-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleBlock()}
                                </div>
                            </div>
                        </div>

                        <div className="page123-art-layer" aria-hidden="true">
                            <img
                                src={page123BgUrl}
                                alt=""
                                width={2000}
                                height={933}
                                decoding="async"
                            />
                        </div>
                    </div>

                    <details
                        ref={detailsRef}
                        className="data-table-wrapper"
                        onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                        style={{ marginTop: '20px' }}
                    >
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en'
                                        ? ' Press Enter to open or close.'
                                        : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>

                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    marginTop: '10px',
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
                                aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                tabIndex="0"
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption className="wb-inv">{getText('page123_table_caption', lang)}</caption>
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
                                                    minWidth: '80px',
                                                    borderRight: '2px solid #dee2e6'
                                                }}
                                            >
                                                {getText('page108_table_col_year', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    whiteSpace: 'nowrap',
                                                    verticalAlign: 'bottom'
                                                }}
                                            >
                                                {getText('page123_table_col_total_tcf', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    whiteSpace: 'nowrap',
                                                    verticalAlign: 'bottom'
                                                }}
                                            >
                                                {getText('page123_table_col_total_tcm', lang)}
                                            </th>
                                            {RESERVE_COLUMN_KEYS.map((k) => (
                                                <th
                                                    key={k}
                                                    scope="col"
                                                    style={{
                                                        fontWeight: 'bold',
                                                        textAlign: 'center',
                                                        whiteSpace: 'nowrap',
                                                        verticalAlign: 'bottom'
                                                    }}
                                                >
                                                    {countryLabel(k)} (%)
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historicalRows.map((row) => (
                                            <tr key={row.year}>
                                                <th
                                                    scope="row"
                                                    style={{
                                                        position: 'sticky',
                                                        left: 0,
                                                        zIndex: 1,
                                                        fontWeight: 'bold',
                                                        textAlign: 'center',
                                                        borderRight: '2px solid #dee2e6'
                                                    }}
                                                >
                                                    {row.year}
                                                </th>
                                                <td style={{ textAlign: 'center' }}>
                                                    {formatReserveTotal(row.totalTcf, lang)}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {formatReserveTotal(row.totalTcm, lang)}
                                                </td>
                                                {row.pcts.map((p, idx) => (
                                                    <td key={RESERVE_COLUMN_KEYS[idx]} style={{ textAlign: 'center' }}>
                                                        {tablePctCell(p, lang)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                <button
                                    type="button"
                                    onClick={downloadCsv}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#8C8C8C',
                                        border: '1px solid #404040',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#ffffff'
                                    }}
                                >
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => downloadDocx()}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#8C8C8C',
                                        border: '1px solid #404040',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#ffffff'
                                    }}
                                >
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                </div>
            </div>
        </main>
    );
};

export default Page123;
