import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getProvincialElectricityGenerationData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import ProvincialElectricityGenerationInfographic from '../components/ProvincialElectricityGenerationInfographic';
import {
    SOURCE_KEYS,
    formatSharePct,
    pctSortValue,
    exportProvincialGenerationInfographicPng,
} from '../components/ProvincialElectricityGenerationInfographic.constants';

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const ProvincialElectricityGeneration = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const figureRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    useEffect(() => {
        getProvincialElectricityGenerationData()
            .then(setPageData)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const year = pageData?.latestYear ?? null;
    const vars = { year: year ?? '' };

    const infographicTitle = substitute(getText('electricity_generation_provincial_infographic_title', lang), vars);
    const ariaLabel = substitute(getText('electricity_generation_provincial_infographic_aria', lang), vars);
    const fileSlugBase = substitute(getText('electricity_generation_provincial_download_title', lang), vars).replace(/\s+/g, '_');

    const tableRows = useMemo(() => {
        if (!pageData?.sources) return [];
        const rows = SOURCE_KEYS.flatMap((sourceKey) => {
            const block = pageData.sources[sourceKey];
            if (!block?.provinces?.length) return [];
            return block.provinces.map((row) => ({
                sourceKey,
                source: getText(`electricity_generation_provincial_source_${sourceKey}`, lang),
                province: getText(`electricity_generation_provincial_prov_${row.key}`, lang),
                share: formatSharePct(row.value, lang),
                sortPct: pctSortValue(row.value),
            }));
        });
        return rows.sort((a, b) => {
            const sourceDiff = SOURCE_KEYS.indexOf(a.sourceKey) - SOURCE_KEYS.indexOf(b.sourceKey);
            if (sourceDiff !== 0) return sourceDiff;
            return b.sortPct - a.sortPct;
        });
    }, [pageData, lang]);

    const tableHeaders = [
        getText('electricity_generation_provincial_table_col_source', lang),
        getText('electricity_generation_provincial_table_col_province', lang),
        getText('electricity_generation_provincial_table_col_share', lang),
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
        const canvas = await exportProvincialGenerationInfographicPng(figureRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!pageData?.latestYear) return <p>{getText('electricity_generation_provincial_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-67"
            role="main"
            aria-labelledby="provincial-electricity-generation-infographic-title"
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
.provincial-electricity-generation-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.provincial-electricity-generation-infographic-section { width: 100%; margin-bottom: 0; }
.provincial-electricity-generation-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.provincial-electricity-generation-download-buttons button:hover { background-color: #404040 !important; }
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
.provincial-electricity-generation-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.provincial-electricity-generation-table-scrollbar > div { height: 20px; }
            `}</style>

            <div className="provincial-electricity-generation-inner">
                <div className="provincial-electricity-generation-infographic-section">
                    <ProvincialElectricityGenerationInfographic
                        lang={lang}
                        getText={getText}
                        figureRef={figureRef}
                        ariaLabel={ariaLabel}
                        data={pageData}
                        title={infographicTitle}
                        titleId="provincial-electricity-generation-infographic-title"
                    />

                    <div className="provincial-electricity-generation-download-buttons">
                        <button type="button" onClick={downloadPng} style={downloadBtnStyle}>
                            {getText('electricity_generation_provincial_download_png', lang)}
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
                        <div ref={topScrollRef} className="provincial-electricity-generation-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="table-responsive"
                            role="region"
                            aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{substitute(getText('electricity_generation_provincial_table_caption', lang), vars)}</caption>
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
                        <div ref={bottomScrollRef} className="provincial-electricity-generation-table-scrollbar" aria-hidden="true"><div /></div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('electricity_generation_provincial_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('electricity_generation_provincial_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default ProvincialElectricityGeneration;
