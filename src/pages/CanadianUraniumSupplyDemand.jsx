import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import canadianUraniumSupplyDemandBg from '../assets/canadian_uranium_supply_demand_bg.png';

const STAT_GREEN = '#809276';
const DATA_YEAR = 2024;

const canadian_uranium_supply_demand_DATA = {
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

const CanadianUraniumSupplyDemand = () => {
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

    const productionDisplay = `${formatProduction(canadian_uranium_supply_demand_DATA.productionKtu)} ktU`;
    const valueDisplay =
        lang === 'fr'
            ? `${Number(canadian_uranium_supply_demand_DATA.valueBillions).toLocaleString(locale, { maximumFractionDigits: 0 })} milliards de dollars`
            : `$${Number(canadian_uranium_supply_demand_DATA.valueBillions).toLocaleString(locale, { maximumFractionDigits: 0 })} billion`;
    const exportPctDisplay = `${canadian_uranium_supply_demand_DATA.exportPct}${pctSuffix}`;
    const domesticPctDisplay = `${canadian_uranium_supply_demand_DATA.domesticPct}${pctSuffix}`;

    const textVars = { year: DATA_YEAR };

    const tableHeaders = [
        getText('canadian_uranium_supply_demand_table_col_year', lang),
        getText('canadian_uranium_supply_demand_table_col_production', lang),
        getText('canadian_uranium_supply_demand_table_col_value', lang),
        getText('canadian_uranium_supply_demand_table_col_export', lang),
        getText('canadian_uranium_supply_demand_table_col_us_share', lang),
        getText('canadian_uranium_supply_demand_table_col_domestic', lang),
    ];

    const tableRow = useMemo(
        () => ({
            year: DATA_YEAR,
            production: productionDisplay,
            value: valueDisplay,
            export: exportPctDisplay,
            usShare: `${canadian_uranium_supply_demand_DATA.usPurchasesPct}${pctSuffix}`,
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
            getText('canadian_uranium_supply_demand_csv_slug', lang),
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
                                text: stripHtml(substitute(getText('canadian_uranium_supply_demand_table_caption', lang), textVars)),
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
        saveAs(await Packer.toBlob(doc), getText('canadian_uranium_supply_demand_docx_slug', lang));
    };

    const infographicAria = getText('canadian_uranium_supply_demand_infographic_aria', lang);

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-87"
            role="main"
            aria-labelledby="canadian-uranium-supply-demand-main-title"
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
.canadian-uranium-supply-demand-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-uranium-supply-demand-title {
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
.canadian-uranium-supply-demand-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.canadian-uranium-supply-demand-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: clamp(26px, 3vw, 34px);
    font-weight: bold;
    color: ${STAT_GREEN};
    margin: 0 0 18px 0;
    text-transform: none;
}
.canadian-uranium-supply-demand-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
    align-items: stretch;
    width: 100%;
    margin-bottom: 28px;
}
.canadian-uranium-supply-demand-col { min-width: 0; font-family: var(--font-body); color: var(--gc-text); line-height: 1.45; }
.canadian-uranium-supply-demand-production-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25em 0.45em;
    margin: 0 0 10px 0;
}
.canadian-uranium-supply-demand-production-label {
    font-size: clamp(17px, 2vw, 20px);
    font-weight: 400;
}
.canadian-uranium-supply-demand-stat-mid {
    font-family: 'Lato', sans-serif;
    font-size: clamp(34px, 4.2vw, 42px);
    font-weight: bold;
    color: ${STAT_GREEN};
    line-height: 1;
    letter-spacing: -0.01em;
}
.canadian-uranium-supply-demand-stat-value {
    font-family: 'Lato', sans-serif;
    font-size: clamp(42px, 5.2vw, 52px);
    font-weight: bold;
    color: ${STAT_GREEN};
    line-height: 1;
    letter-spacing: -0.01em;
}
.canadian-uranium-supply-demand-note { font-size: clamp(16px, 1.8vw, 18px); margin: 0 0 32px 0; }
.page-87 h3.canadian-uranium-supply-demand-section-heading {
    font-family: 'Lato', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: bold;
    color: var(--gc-text);
    line-height: 1.3;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page-87 h3.canadian-uranium-supply-demand-section-heading--compact {
    margin-bottom: 4px;
}
.canadian-uranium-supply-demand-value-about { font-size: clamp(15px, 1.7vw, 17px); margin: 0 0 6px 0; }
.canadian-uranium-supply-demand-value-line { margin: 0 0 20px 0; }
.canadian-uranium-supply-demand-truck-wrap { margin-top: 12px; max-width: 58%; }
.canadian-uranium-supply-demand-truck-image { display: block; width: 100%; height: auto; pointer-events: none; user-select: none; }
.canadian-uranium-supply-demand-export-line, .canadian-uranium-supply-demand-domestic-line {
    font-size: clamp(17px, 2vw, 20px);
    margin: 0 0 12px 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2em 0.35em;
}
.canadian-uranium-supply-demand-export-line .canadian-uranium-supply-demand-inline-prefix,
.canadian-uranium-supply-demand-domestic-line .canadian-uranium-supply-demand-inline-prefix,
.canadian-uranium-supply-demand-export-line .canadian-uranium-supply-demand-inline-suffix,
.canadian-uranium-supply-demand-domestic-line .canadian-uranium-supply-demand-inline-suffix {
    font-weight: bold;
}
.canadian-uranium-supply-demand-export-suffix-line {
    font-size: clamp(17px, 2vw, 20px);
    margin: -4px 0 16px 0;
}
.canadian-uranium-supply-demand-paragraph { font-size: clamp(16px, 1.8vw, 18px); margin: 0 0 28px 0; }
.canadian-uranium-supply-demand-paragraph strong { font-weight: bold; }
.canadian-uranium-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 0; margin-bottom: 0; }
.canadian-uranium-supply-demand-table-wrapper details > summary {
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
.canadian-uranium-supply-demand-table-wrapper details > summary::-webkit-details-marker { display: none; }
.canadian-uranium-supply-demand-table-wrapper details > summary:hover,
.canadian-uranium-supply-demand-table-wrapper button:hover { background-color: #404040 !important; }
.canadian-uranium-supply-demand-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.canadian-uranium-supply-demand-table-scrollbar > div { height: 20px; }
.canadian-uranium-supply-demand-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.canadian-uranium-supply-demand-table-responsive::-webkit-scrollbar { display: none; }
.canadian-uranium-supply-demand-table-responsive table { width: max-content !important; min-width: 100%; }
.canadian-uranium-supply-demand-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
@media (max-width: 1100px) {
    .canadian-uranium-supply-demand-split { grid-template-columns: 1fr; gap: 28px; }
}
@media (max-width: 768px) {
    .canadian-uranium-supply-demand-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .canadian-uranium-supply-demand-title { font-size: 28px; }
}
            `}</style>

            <div className="canadian-uranium-supply-demand-container">
                <header>
                    <h1 id="canadian-uranium-supply-demand-main-title" className="canadian-uranium-supply-demand-title">
                        {getText('canadian_uranium_supply_demand_title', lang)} ({DATA_YEAR})
                    </h1>
                </header>

                <div className="canadian-uranium-supply-demand-split" role="region" aria-label={infographicAria}>
                    <div className="canadian-uranium-supply-demand-col canadian-uranium-supply-demand-left">
                        <h2 className="canadian-uranium-supply-demand-subtitle">{getText('canadian_uranium_supply_demand_subtitle', lang)}</h2>

                        <p className="canadian-uranium-supply-demand-production-line">
                            <span className="wb-inv">
                                {getText('canadian_uranium_supply_demand_production_label', lang)} {productionDisplay}
                            </span>
                            <span aria-hidden="true">
                                <span className="canadian-uranium-supply-demand-production-label">{getText('canadian_uranium_supply_demand_production_label', lang)}</span>
                                <span className="canadian-uranium-supply-demand-stat-mid">{productionDisplay}</span>
                            </span>
                        </p>
                        <p className="canadian-uranium-supply-demand-note">{getText('canadian_uranium_supply_demand_saskatchewan_note', lang)}</p>

                        <h3 className="canadian-uranium-supply-demand-section-heading canadian-uranium-supply-demand-section-heading--compact">
                            {getText('canadian_uranium_supply_demand_value_heading', lang)}
                        </h3>
                        <p className="canadian-uranium-supply-demand-value-about">{getText('canadian_uranium_supply_demand_value_about', lang)}</p>
                        <p className="canadian-uranium-supply-demand-value-line">
                            <span className="canadian-uranium-supply-demand-stat-value">{valueDisplay}</span>
                        </p>

                        <div className="canadian-uranium-supply-demand-truck-wrap" aria-hidden="true">
                            <img src={canadianUraniumSupplyDemandBg} alt="" className="canadian-uranium-supply-demand-truck-image" draggable={false} />
                        </div>
                    </div>

                    <div className="canadian-uranium-supply-demand-col canadian-uranium-supply-demand-right">
                        <p className="canadian-uranium-supply-demand-export-line">
                            <span className="canadian-uranium-supply-demand-inline-prefix">{getText('canadian_uranium_supply_demand_export_prefix', lang)}</span>
                            <span className="canadian-uranium-supply-demand-stat-mid">{exportPctDisplay}</span>
                            <span className="canadian-uranium-supply-demand-inline-suffix">{getText('canadian_uranium_supply_demand_export_of_production', lang)}</span>
                        </p>
                        <p className="canadian-uranium-supply-demand-export-suffix-line">{getText('canadian_uranium_supply_demand_export_suffix', lang)}</p>
                        <p
                            className="canadian-uranium-supply-demand-paragraph"
                            dangerouslySetInnerHTML={{
                                __html: substitute(getText('canadian_uranium_supply_demand_us_paragraph', lang), { pct: canadian_uranium_supply_demand_DATA.usPurchasesPct }),
                            }}
                        />

                        <h3 className="canadian-uranium-supply-demand-section-heading">{getText('canadian_uranium_supply_demand_domestic_heading', lang)}</h3>
                        <p className="canadian-uranium-supply-demand-domestic-line">
                            <span className="canadian-uranium-supply-demand-inline-prefix">{getText('canadian_uranium_supply_demand_domestic_prefix', lang)}</span>
                            <span className="canadian-uranium-supply-demand-stat-mid">{domesticPctDisplay}</span>
                            <span className="canadian-uranium-supply-demand-inline-suffix">{getText('canadian_uranium_supply_demand_domestic_of_production', lang)}</span>
                        </p>
                        <p className="canadian-uranium-supply-demand-paragraph">{getText('canadian_uranium_supply_demand_domestic_paragraph', lang)}</p>
                    </div>
                </div>

                <div className="canadian-uranium-supply-demand-table-wrapper">
                    <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('canadian_uranium_supply_demand_table_summary', lang)}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="canadian-uranium-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="canadian-uranium-supply-demand-table-responsive table-responsive"
                            role="region"
                            aria-label={getText('canadian_uranium_supply_demand_table_summary', lang)}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">
                                    {substitute(getText('canadian_uranium_supply_demand_table_caption', lang), textVars)}
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
                        <div ref={bottomScrollRef} className="canadian-uranium-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="canadian-uranium-supply-demand-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('canadian_uranium_supply_demand_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('canadian_uranium_supply_demand_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default CanadianUraniumSupplyDemand;
