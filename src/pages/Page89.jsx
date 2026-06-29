import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import Page89CanduInfographic from '../components/Page89CanduInfographic';

const PAGE89_DATA = {
    abroadOperating: 9,
    canadaOperating: 17,
    abroadCountries: 5,
    totalOperating: 26,
    globalReactorSharePct: 7,
    globalCapacitySharePct: 5,
    capacityGwe: 17.9,
};

const TABLE_ROW_KEYS = [
    'canada',
    'abroad',
    'abroad_countries',
    'total',
    'global_reactors',
    'global_capacity',
    'capacity_gwe',
];

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const Page89 = () => {
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

    const formatGwe = (value) =>
        Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const tableHeaders = [
        getText('page89_table_col_description', lang),
        getText('page89_table_col_value', lang),
    ];

    const tableRows = useMemo(() => {
        const nearlyPrefix = getText('page89_table_nearly_prefix', lang);
        return TABLE_ROW_KEYS.map((key) => {
            let value;
            switch (key) {
                case 'canada':
                    value = String(PAGE89_DATA.canadaOperating);
                    break;
                case 'abroad':
                    value = String(PAGE89_DATA.abroadOperating);
                    break;
                case 'abroad_countries':
                    value = String(PAGE89_DATA.abroadCountries);
                    break;
                case 'total':
                    value = String(PAGE89_DATA.totalOperating);
                    break;
                case 'global_reactors':
                    value = `${nearlyPrefix}${PAGE89_DATA.globalReactorSharePct}${pctSuffix}`;
                    break;
                case 'global_capacity':
                    value = `${PAGE89_DATA.globalCapacitySharePct}${pctSuffix}`;
                    break;
                case 'capacity_gwe':
                    value = lang === 'fr'
                        ? `${formatGwe(PAGE89_DATA.capacityGwe)} GWe`
                        : `${formatGwe(PAGE89_DATA.capacityGwe)} GWe`;
                    break;
                default:
                    value = '';
            }
            return {
                key,
                description: getText(`page89_table_row_${key}`, lang),
                value,
            };
        });
    }, [lang, pctSuffix]);

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
        const rows = tableRows
            .map((row) => [row.description, row.value].map(csvEscape).join(','))
            .join('\n');
        saveAs(
            new Blob([[header, rows].join('\n')], { type: 'text/csv;charset=utf-8;' }),
            getText('page89_csv_slug', lang),
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
        const dataRows = tableRows.map(
            (row) =>
                new TableRow({
                    children: [row.description, row.value].map(
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
                }),
        );

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: stripHtml(getText('page89_table_caption', lang)),
                                bold: true,
                                size: 28,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [5200, 2200],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), getText('page89_docx_slug', lang));
    };

    const calloutAria = getText('page89_callout_aria', lang);

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-89"
            role="main"
            aria-labelledby="page89-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-89.page-content { max-width: none !important; overflow-x: visible !important; }
.page-89 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page89-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page89-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 20px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page89-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page89-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 0 0 28px 0;
    padding-left: 1.25rem;
}
.page89-bullets li { margin-bottom: 0.85rem; }
.page89-bullets strong { font-weight: bold; }
.page89-table-wrapper { display: block; width: 100%; margin-top: 0; margin-bottom: 0; }
.page89-table-wrapper details > summary {
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
.page89-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page89-table-wrapper details > summary:hover,
.page89-table-wrapper button:hover { background-color: #404040 !important; }
.page89-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page89-table-scrollbar > div { height: 20px; }
.page89-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page89-table-responsive::-webkit-scrollbar { display: none; }
.page89-table-responsive table { width: max-content !important; min-width: 100%; }
.page89-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
@media (max-width: 768px) {
    .page89-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .page89-title { font-size: 28px; }
}
            `}</style>

            <div className="page89-container">
                <header>
                    <h1 id="page89-main-title" className="page89-title">
                        {getText('page89_title', lang)}
                    </h1>
                </header>

                <ul className="page89-bullets">
                    <li dangerouslySetInnerHTML={{ __html: getText('page89_bullet1', lang) }} />
                    <li>{getText('page89_bullet2', lang)}</li>
                    <li>{getText('page89_bullet3', lang)}</li>
                    <li>{getText('page89_bullet4', lang)}</li>
                </ul>

                <Page89CanduInfographic
                    lang={lang}
                    abroadCount={PAGE89_DATA.abroadOperating}
                    heading={getText('page89_callout_heading', lang)}
                    suffix={getText('page89_callout_suffix', lang)}
                    ariaLabel={calloutAria}
                />

                <div className="page89-table-wrapper">
                    <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('page89_table_summary', lang)}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="page89-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="page89-table-responsive table-responsive"
                            role="region"
                            aria-label={getText('page89_table_summary', lang)}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{getText('page89_table_caption', lang)}</caption>
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
                                    {tableRows.map((row) => (
                                        <tr key={row.key}>
                                            <td style={{ textAlign: 'center' }}>{row.description}</td>
                                            <td style={{ textAlign: 'center' }}>{row.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="page89-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page89-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('page89_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('page89_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default Page89;
