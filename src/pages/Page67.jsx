import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import Page67GenerationInfographic from '../components/Page67GenerationInfographic';
import {
    SOURCE_KEYS,
    PAGE67_DATA,
    formatSharePct,
    exportPage67InfographicPng,
} from '../components/Page67GenerationInfographic.constants';

const YEAR = 2023;

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const pctSortValue = (value) => {
    if (value === 'lt0.1') return 0.05;
    if (value === 'lt0.2') return 0.15;
    return Number(value);
};

const Page67 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const figureRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const infographicTitle = getText('page67_infographic_title', lang).replace(/\{\{year\}\}/g, String(YEAR));
    const ariaLabel = getText('page67_infographic_aria', lang);
    const fileSlugBase = getText('page67_download_title', lang).replace(/\{\{year\}\}/g, String(YEAR)).replace(/\s+/g, '_');

    const tableRows = useMemo(() => {
        const rows = SOURCE_KEYS.flatMap((sourceKey) =>
            PAGE67_DATA[sourceKey].provinces.map((row) => ({
                sourceKey,
                source: getText(`page67_source_${sourceKey}`, lang),
                province: getText(`page67_prov_${row.key}`, lang),
                share: formatSharePct(row.value, lang),
                sortPct: pctSortValue(row.value),
            })),
        );
        return rows.sort((a, b) => {
            const sourceDiff = SOURCE_KEYS.indexOf(a.sourceKey) - SOURCE_KEYS.indexOf(b.sourceKey);
            if (sourceDiff !== 0) return sourceDiff;
            return b.sortPct - a.sortPct;
        });
    }, [lang]);

    const tableHeaders = [
        getText('page67_table_col_source', lang),
        getText('page67_table_col_province', lang),
        getText('page67_table_col_share', lang),
    ];

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

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

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
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth, syncTableScroll]);

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows.map((row) => [row.source, row.province, row.share].map(csvEscape).join(','));
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRows.map(
            (row) =>
                new TableRow({
                    children: [row.source, row.province, row.share].map((value, index) =>
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: value, size: 22 })],
                                    alignment: index === 2 ? AlignmentType.CENTER : AlignmentType.LEFT,
                                }),
                            ],
                        }),
                    ),
                }),
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: stripHtml(infographicTitle), bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [3200, 2400, 1800],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlugBase}.docx`);
    };

    const downloadPng = async () => {
        const canvas = await exportPage67InfographicPng(figureRef.current, {
            title: stripHtml(infographicTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-67"
            role="main"
            aria-labelledby="page67-infographic-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-67.page-content { max-width: none !important; overflow-x: visible !important; }
.page-67 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page67-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page67-infographic-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: #333333;
    text-align: center;
    margin: 0 0 16px 0;
    line-height: 1.25;
    text-transform: none;
}
.page67-infographic-section { width: 100%; margin-bottom: 0; }
.page67-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page67-download-buttons button:hover { background-color: #404040 !important; }
.page-67 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-67 .data-table-wrapper summary {
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    padding: 10px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    list-style: none;
    box-sizing: border-box;
    width: 100%;
    color: #ffffff;
}
.page-67 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page-67 .data-table-wrapper summary:hover,
.page-67 .data-table-wrapper button:hover { background-color: #404040 !important; }
.page67-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page67-table-scrollbar > div { height: 20px; }
@media (max-width: 768px) {
    .page67-infographic-title { font-size: 26px; }
}
            `}</style>

            <div className="page67-inner">
                <h1 id="page67-infographic-title" className="page67-infographic-title">
                    {infographicTitle}
                </h1>

                <div className="page67-infographic-section">
                    <Page67GenerationInfographic
                        lang={lang}
                        getText={getText}
                        figureRef={figureRef}
                        ariaLabel={ariaLabel}
                    />

                    <div className="page67-download-buttons">
                        <button type="button" onClick={downloadPng} style={downloadBtnStyle}>
                            {getText('page67_download_png', lang)}
                        </button>
                        <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                            {getText('page67_download_csv', lang)}
                        </button>
                        <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                            {getText('page67_download_docx', lang)}
                        </button>
                    </div>

                    <details className="data-table-wrapper" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="page67-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="table-responsive"
                            role="region"
                            aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{getText('page67_table_caption', lang)}</caption>
                                <thead>
                                    <tr>
                                        {tableHeaders.map((header, index) => (
                                            <th
                                                key={header}
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    whiteSpace: 'nowrap',
                                                    verticalAlign: 'bottom',
                                                    ...(index === 0
                                                        ? {
                                                              position: 'sticky',
                                                              left: 0,
                                                              backgroundColor: '#f8f9fa',
                                                              zIndex: 2,
                                                              borderRight: '2px solid #dee2e6',
                                                          }
                                                        : {}),
                                                }}
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.map((row) => (
                                        <tr key={`${row.sourceKey}-${row.province}`}>
                                            <th
                                                scope="row"
                                                style={{
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 1,
                                                    fontWeight: 'bold',
                                                    borderRight: '2px solid #dee2e6',
                                                }}
                                            >
                                                {row.source}
                                            </th>
                                            <td>{row.province}</td>
                                            <td style={{ textAlign: 'center' }}>{row.share}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="page67-table-scrollbar" aria-hidden="true"><div /></div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('page67_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('page67_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default Page67;
