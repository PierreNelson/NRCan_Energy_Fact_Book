import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import CanduNuclearReactorsInfographic from '../components/CanduNuclearReactorsInfographic';

const candu_nuclear_reactors_DATA = {
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

const CanduNuclearReactors = () => {
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

    const formatGwe = useCallback((value) =>
        Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [locale]);

    const tableHeaders = [
        getText('candu_nuclear_reactors_table_col_description', lang),
        getText('candu_nuclear_reactors_table_col_value', lang),
    ];

    const tableRows = useMemo(() => {
        const nearlyPrefix = getText('candu_nuclear_reactors_table_nearly_prefix', lang);
        return TABLE_ROW_KEYS.map((key) => {
            let value;
            switch (key) {
                case 'canada':
                    value = String(candu_nuclear_reactors_DATA.canadaOperating);
                    break;
                case 'abroad':
                    value = String(candu_nuclear_reactors_DATA.abroadOperating);
                    break;
                case 'abroad_countries':
                    value = String(candu_nuclear_reactors_DATA.abroadCountries);
                    break;
                case 'total':
                    value = String(candu_nuclear_reactors_DATA.totalOperating);
                    break;
                case 'global_reactors':
                    value = `${nearlyPrefix}${candu_nuclear_reactors_DATA.globalReactorSharePct}${pctSuffix}`;
                    break;
                case 'global_capacity':
                    value = `${candu_nuclear_reactors_DATA.globalCapacitySharePct}${pctSuffix}`;
                    break;
                case 'capacity_gwe':
                    value = lang === 'fr'
                        ? `${formatGwe(candu_nuclear_reactors_DATA.capacityGwe)} GWe`
                        : `${formatGwe(candu_nuclear_reactors_DATA.capacityGwe)} GWe`;
                    break;
                default:
                    value = '';
            }
            return {
                key,
                description: getText(`candu_nuclear_reactors_table_row_${key}`, lang),
                value,
            };
        });
    }, [lang, pctSuffix, formatGwe]);

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
            getText('candu_nuclear_reactors_csv_slug', lang),
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
                                text: stripHtml(getText('candu_nuclear_reactors_table_caption', lang)),
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
        saveAs(await Packer.toBlob(doc), getText('candu_nuclear_reactors_docx_slug', lang));
    };

    const calloutAria = getText('candu_nuclear_reactors_callout_aria', lang);

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-89"
            role="main"
            aria-labelledby="candu-nuclear-reactors-main-title"
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
.candu-nuclear-reactors-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.candu-nuclear-reactors-title {
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
.candu-nuclear-reactors-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.candu-nuclear-reactors-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 0 0 28px 0;
    padding-left: 1.25rem;
}
.candu-nuclear-reactors-bullets li { margin-bottom: 0.85rem; }
.candu-nuclear-reactors-bullets strong { font-weight: bold; }
.candu-nuclear-reactors-table-wrapper { display: block; width: 100%; margin-top: 0; margin-bottom: 0; }
.candu-nuclear-reactors-table-wrapper details > summary {
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
.candu-nuclear-reactors-table-wrapper details > summary::-webkit-details-marker { display: none; }
.candu-nuclear-reactors-table-wrapper details > summary:hover,
.candu-nuclear-reactors-table-wrapper button:hover { background-color: #404040 !important; }
.candu-nuclear-reactors-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.candu-nuclear-reactors-table-scrollbar > div { height: 20px; }
.candu-nuclear-reactors-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.candu-nuclear-reactors-table-responsive::-webkit-scrollbar { display: none; }
.candu-nuclear-reactors-table-responsive table { width: max-content !important; min-width: 100%; }
.candu-nuclear-reactors-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
@media (max-width: 768px) {
    .candu-nuclear-reactors-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .candu-nuclear-reactors-title { font-size: 28px; }
}
            `}</style>

            <div className="candu-nuclear-reactors-container">
                <header>
                    <h1 id="candu-nuclear-reactors-main-title" className="candu-nuclear-reactors-title">
                        {getText('candu_nuclear_reactors_title', lang)}
                    </h1>
                </header>

                <ul className="candu-nuclear-reactors-bullets">
                    <li dangerouslySetInnerHTML={{ __html: getText('candu_nuclear_reactors_bullet1', lang) }} />
                    <li>{getText('candu_nuclear_reactors_bullet2', lang)}</li>
                    <li>{getText('candu_nuclear_reactors_bullet3', lang)}</li>
                    <li>{getText('candu_nuclear_reactors_bullet4', lang)}</li>
                </ul>

                <CanduNuclearReactorsInfographic
                    lang={lang}
                    abroadCount={candu_nuclear_reactors_DATA.abroadOperating}
                    heading={getText('candu_nuclear_reactors_callout_heading', lang)}
                    suffix={getText('candu_nuclear_reactors_callout_suffix', lang)}
                    ariaLabel={calloutAria}
                />

                <div className="candu-nuclear-reactors-table-wrapper">
                    <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('candu_nuclear_reactors_table_summary', lang)}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="candu-nuclear-reactors-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="candu-nuclear-reactors-table-responsive table-responsive"
                            role="region"
                            aria-label={getText('candu_nuclear_reactors_table_summary', lang)}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{getText('candu_nuclear_reactors_table_caption', lang)}</caption>
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
                        <div ref={bottomScrollRef} className="candu-nuclear-reactors-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="candu-nuclear-reactors-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('candu_nuclear_reactors_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('candu_nuclear_reactors_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default CanduNuclearReactors;
