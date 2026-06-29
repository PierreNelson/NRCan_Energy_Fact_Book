import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import page87Bg from '../assets/page87_bg.png';

const STAT_GREEN = '#809276';
const DATA_YEAR = 2024;

const PAGE87_DATA = {
    year: DATA_YEAR,
    productionKtu: 14.3,
    valueBillions: 3,
    exportPct: 90,
    usPurchasesPct: 33,
    domesticPct: 10,
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const Page87 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const pctSuffix = lang === 'fr' ? '\u00a0%' : '%';

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const formatProduction = (value) =>
        Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const productionDisplay = `${formatProduction(PAGE87_DATA.productionKtu)} ktU`;
    const valueDisplay =
        lang === 'fr'
            ? `${Number(PAGE87_DATA.valueBillions).toLocaleString(locale, { maximumFractionDigits: 0 })} milliards de dollars`
            : `$${Number(PAGE87_DATA.valueBillions).toLocaleString(locale, { maximumFractionDigits: 0 })} billion`;
    const exportPctDisplay = `${PAGE87_DATA.exportPct}${pctSuffix}`;
    const domesticPctDisplay = `${PAGE87_DATA.domesticPct}${pctSuffix}`;

    const textVars = { year: DATA_YEAR };

    const tableHeaders = [
        getText('page87_table_col_year', lang),
        getText('page87_table_col_production', lang),
        getText('page87_table_col_value', lang),
        getText('page87_table_col_export', lang),
        getText('page87_table_col_us_share', lang),
        getText('page87_table_col_domestic', lang),
    ];

    const tableRow = useMemo(
        () => ({
            year: DATA_YEAR,
            production: productionDisplay,
            value: valueDisplay,
            export: exportPctDisplay,
            usShare: `${PAGE87_DATA.usPurchasesPct}${pctSuffix}`,
            domestic: domesticPctDisplay,
        }),
        [productionDisplay, valueDisplay, exportPctDisplay, domesticPctDisplay, pctSuffix],
    );

    const syncTableScroll = useCallback(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return;
        const table = tableScroll.querySelector('table');
        if (!table) return;
        [topScroll.firstElementChild, bottomScroll.firstElementChild].forEach((spacer) => {
            if (spacer) spacer.style.width = `${table.offsetWidth}px`;
        });
        const shouldShow = table.offsetWidth > tableScroll.clientWidth;
        topScroll.style.display = shouldShow ? 'block' : 'none';
        bottomScroll.style.display = shouldShow ? 'block' : 'none';
    }, []);

    useEffect(() => {
        if (!isTableOpen) return undefined;
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return undefined;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTop = () => syncFrom(topScroll);
        const handleTable = () => syncFrom(tableScroll);
        const handleBottom = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

        topScroll.addEventListener('scroll', handleTop);
        tableScroll.addEventListener('scroll', handleTable);
        bottomScroll.addEventListener('scroll', handleBottom);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();

        return () => {
            topScroll.removeEventListener('scroll', handleTop);
            tableScroll.removeEventListener('scroll', handleTable);
            bottomScroll.removeEventListener('scroll', handleBottom);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth, syncTableScroll]);

    const downloadBtnStyle = {
        padding: '8px 16px',
        backgroundColor: '#8C8C8C',
        border: '1px solid #404040',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const row = [
            tableRow.year,
            tableRow.production,
            tableRow.value,
            tableRow.export,
            tableRow.usShare,
            tableRow.domestic,
        ]
            .map(csvEscape)
            .join(',');
        saveAs(
            new Blob([[header, row].join('\n')], { type: 'text/csv;charset=utf-8;' }),
            getText('page87_csv_slug', lang),
        );
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 22 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = new TableRow({
            children: [
                tableRow.year,
                tableRow.production,
                tableRow.value,
                tableRow.export,
                tableRow.usShare,
                tableRow.domestic,
            ].map(
                (value) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(value ?? ''), size: 22 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                    }),
            ),
        });

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: stripHtml(substitute(getText('page87_table_caption', lang), textVars)),
                                bold: true,
                                size: 28,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [900, 1400, 1600, 1500, 2200, 1400],
                        rows: [headerRow, dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), getText('page87_docx_slug', lang));
    };

    const infographicAria = getText('page87_infographic_aria', lang);

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-87"
            role="main"
            aria-labelledby="page87-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-87.page-content { max-width: none !important; overflow-x: visible !important; }
.page-87 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page87-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page87-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 8px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page87-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page87-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: clamp(26px, 3vw, 34px);
    font-weight: bold;
    color: ${STAT_GREEN};
    margin: 0 0 18px 0;
    text-transform: none;
}
.page87-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
    align-items: stretch;
    width: 100%;
    margin-bottom: 28px;
}
.page87-col { min-width: 0; font-family: var(--font-body); color: var(--gc-text); line-height: 1.45; }
.page87-production-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25em 0.45em;
    margin: 0 0 10px 0;
}
.page87-production-label {
    font-size: clamp(17px, 2vw, 20px);
    font-weight: 400;
}
.page87-stat-mid {
    font-family: 'Lato', sans-serif;
    font-size: clamp(34px, 4.2vw, 42px);
    font-weight: bold;
    color: ${STAT_GREEN};
    line-height: 1;
    letter-spacing: -0.01em;
}
.page87-stat-value {
    font-family: 'Lato', sans-serif;
    font-size: clamp(42px, 5.2vw, 52px);
    font-weight: bold;
    color: ${STAT_GREEN};
    line-height: 1;
    letter-spacing: -0.01em;
}
.page87-note { font-size: clamp(16px, 1.8vw, 18px); margin: 0 0 32px 0; }
.page-87 h3.page87-section-heading {
    font-family: 'Lato', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: bold;
    color: var(--gc-text);
    line-height: 1.3;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page-87 h3.page87-section-heading--compact {
    margin-bottom: 4px;
}
.page87-value-about { font-size: clamp(15px, 1.7vw, 17px); margin: 0 0 6px 0; }
.page87-value-line { margin: 0 0 20px 0; }
.page87-truck-wrap { margin-top: 12px; max-width: 58%; }
.page87-truck-image { display: block; width: 100%; height: auto; pointer-events: none; user-select: none; }
.page87-export-line, .page87-domestic-line {
    font-size: clamp(17px, 2vw, 20px);
    margin: 0 0 12px 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2em 0.35em;
}
.page87-export-line .page87-inline-prefix,
.page87-domestic-line .page87-inline-prefix,
.page87-export-line .page87-inline-suffix,
.page87-domestic-line .page87-inline-suffix {
    font-weight: bold;
}
.page87-export-suffix-line {
    font-size: clamp(17px, 2vw, 20px);
    margin: -4px 0 16px 0;
}
.page87-paragraph { font-size: clamp(16px, 1.8vw, 18px); margin: 0 0 28px 0; }
.page87-paragraph strong { font-weight: bold; }
.page87-table-wrapper { display: block; width: 100%; margin-top: 0; margin-bottom: 0; }
.page87-table-wrapper details > summary {
    display: block;
    width: 100%;
    padding: 12px 15px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    color: #ffffff;
    font-family: Arial, sans-serif;
    font-weight: bold;
    cursor: pointer;
    list-style: none;
    box-sizing: border-box;
}
.page87-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page87-table-wrapper details > summary:hover,
.page87-table-wrapper button:hover { background-color: #404040 !important; }
.page87-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page87-table-scrollbar > div { height: 20px; }
.page87-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page87-table-responsive::-webkit-scrollbar { display: none; }
.page87-table-responsive table { width: max-content !important; min-width: 100%; }
.page87-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
@media (max-width: 1100px) {
    .page87-split { grid-template-columns: 1fr; gap: 28px; }
}
@media (max-width: 768px) {
    .page87-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .page87-title { font-size: 28px; }
}
            `}</style>

            <div className="page87-container">
                <header>
                    <h1 id="page87-main-title" className="page87-title">
                        {getText('page87_title', lang)} ({DATA_YEAR})
                    </h1>
                </header>

                <div className="page87-split" role="region" aria-label={infographicAria}>
                    <div className="page87-col page87-left">
                        <h2 className="page87-subtitle">{getText('page87_subtitle', lang)}</h2>

                        <p className="page87-production-line">
                            <span className="wb-inv">
                                {getText('page87_production_label', lang)} {productionDisplay}
                            </span>
                            <span aria-hidden="true">
                                <span className="page87-production-label">{getText('page87_production_label', lang)}</span>
                                <span className="page87-stat-mid">{productionDisplay}</span>
                            </span>
                        </p>
                        <p className="page87-note">{getText('page87_saskatchewan_note', lang)}</p>

                        <h3 className="page87-section-heading page87-section-heading--compact">
                            {getText('page87_value_heading', lang)}
                        </h3>
                        <p className="page87-value-about">{getText('page87_value_about', lang)}</p>
                        <p className="page87-value-line">
                            <span className="page87-stat-value">{valueDisplay}</span>
                        </p>

                        <div className="page87-truck-wrap" aria-hidden="true">
                            <img src={page87Bg} alt="" className="page87-truck-image" draggable={false} />
                        </div>
                    </div>

                    <div className="page87-col page87-right">
                        <p className="page87-export-line">
                            <span className="page87-inline-prefix">{getText('page87_export_prefix', lang)}</span>
                            <span className="page87-stat-mid">{exportPctDisplay}</span>
                            <span className="page87-inline-suffix">{getText('page87_export_of_production', lang)}</span>
                        </p>
                        <p className="page87-export-suffix-line">{getText('page87_export_suffix', lang)}</p>
                        <p
                            className="page87-paragraph"
                            dangerouslySetInnerHTML={{
                                __html: substitute(getText('page87_us_paragraph', lang), { pct: PAGE87_DATA.usPurchasesPct }),
                            }}
                        />

                        <h3 className="page87-section-heading">{getText('page87_domestic_heading', lang)}</h3>
                        <p className="page87-domestic-line">
                            <span className="page87-inline-prefix">{getText('page87_domestic_prefix', lang)}</span>
                            <span className="page87-stat-mid">{domesticPctDisplay}</span>
                            <span className="page87-inline-suffix">{getText('page87_domestic_of_production', lang)}</span>
                        </p>
                        <p className="page87-paragraph">{getText('page87_domestic_paragraph', lang)}</p>
                    </div>
                </div>

                <div className="page87-table-wrapper">
                    <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('page87_table_summary', lang)}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="page87-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="page87-table-responsive table-responsive"
                            role="region"
                            aria-label={getText('page87_table_summary', lang)}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">
                                    {substitute(getText('page87_table_caption', lang), textVars)}
                                </caption>
                                <thead>
                                    <tr>
                                        {tableHeaders.map((header) => (
                                            <th
                                                key={header}
                                                scope="col"
                                                style={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <th scope="row" style={{ fontWeight: 'bold', textAlign: 'center' }}>{tableRow.year}</th>
                                        <td style={{ textAlign: 'center' }}>{tableRow.production}</td>
                                        <td style={{ textAlign: 'center' }}>{tableRow.value}</td>
                                        <td style={{ textAlign: 'center' }}>{tableRow.export}</td>
                                        <td style={{ textAlign: 'center' }}>{tableRow.usShare}</td>
                                        <td style={{ textAlign: 'center' }}>{tableRow.domestic}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="page87-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page87-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('page87_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('page87_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default Page87;
