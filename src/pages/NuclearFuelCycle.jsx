import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import nuclearFuelCycleBgEn from '../assets/nuclear_fuel_cycle_bg.svg';
import nuclearFuelCycleBgFr from '../assets/nuclear_fuel_cycle_bg_fr.svg';
import { TABLE_ROWS } from './NuclearFuelCycle.constants';

const DOC_COLUMN_WIDTHS = [4800, 3200, 2600];
const HEADER_GREY = '48484A';
const ROW_ODD_FILL = 'B8BEAD';
const ROW_EVEN_FILL = 'fefefe';

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const exportInfographicPng = async (imgEl, { scale = 2 }) => {
    if (!imgEl) return null;
    const loaded = await waitForImage(imgEl);
    const canvas = document.createElement('canvas');
    canvas.width = loaded.naturalWidth * scale;
    canvas.height = loaded.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, loaded.naturalWidth, loaded.naturalHeight);
    ctx.scale(scale, scale);
    ctx.drawImage(loaded, 0, 0, loaded.naturalWidth, loaded.naturalHeight);
    return canvas;
};

const NuclearFuelCycle = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const bgImage = lang === 'en' ? nuclearFuelCycleBgEn : nuclearFuelCycleBgFr;
    const fileSlugBase = getText('nuclear_fuel_cycle_download_title', lang).replace(/\s+/g, '_');

    const tableHeaders = useMemo(() => [
        getText('nuclear_fuel_cycle_col_category', lang),
        getText('nuclear_fuel_cycle_col_site', lang),
        getText('nuclear_fuel_cycle_col_location', lang),
    ], [lang]);

    const tableRows = useMemo(() => TABLE_ROWS.map((row) => ({
        id: row.id,
        category: getText(`nuclear_fuel_cycle_category_${row.categoryKey}`, lang),
        site: getText(`nuclear_fuel_cycle_site_${row.siteKey}`, lang),
        location: getText(`nuclear_fuel_cycle_location_${row.locationKey}`, lang),
    })), [lang]);

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        onResize();
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
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return undefined;

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

    const downloadInfographicPng = async () => {
        const canvas = await exportInfographicPng(infographicImgRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows.map((row) => [
            row.category,
            row.site,
            row.location,
        ].map(csvEscape).join(','));
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map((header) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 20, color: 'FFFFFF' })],
                    alignment: AlignmentType.CENTER,
                })],
                shading: { fill: HEADER_GREY },
            })),
        });
        const dataRows = tableRows.map((row, index) => {
            const fill = index % 2 === 0 ? ROW_ODD_FILL : ROW_EVEN_FILL;
            const values = [row.category, row.site, row.location];
            return new TableRow({
                children: values.map((value) => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: value, size: 20 })],
                        alignment: AlignmentType.LEFT,
                    })],
                    shading: { fill },
                })),
            });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({
                            text: getText('nuclear_fuel_cycle_title', lang),
                            bold: true,
                            size: 28,
                        })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: DOC_COLUMN_WIDTHS,
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlugBase}.docx`);
    };

    const downloadBtnStyle = {
        padding: '8px 16px',
        border: '1px solid #404040',
        borderRadius: '4px',
        background: '#8C8C8C',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#ffffff',
        whiteSpace: 'nowrap',
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content nuclear-fuel-cycle"
            role="main"
            aria-label={getText('nuclear_fuel_cycle_title', lang)}
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.nuclear-fuel-cycle {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.nuclear-fuel-cycle-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.nuclear-fuel-cycle-infographic-section { width: 100%; margin-bottom: 0; }
.nuclear-fuel-cycle-infographic-figure { margin: 0; width: 100%; }
.nuclear-fuel-cycle-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.nuclear-fuel-cycle-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.nuclear-fuel-cycle-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
    white-space: nowrap;
}
.nuclear-fuel-cycle-download-buttons button:hover,
.nuclear-fuel-cycle-data-table summary:hover { background-color: #404040 !important; }
.nuclear-fuel-cycle-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.nuclear-fuel-cycle-data-table > summary {
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
    box-sizing: border-box;
}
.nuclear-fuel-cycle-data-table > summary::-webkit-details-marker { display: none; }
.nuclear-fuel-cycle-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.nuclear-fuel-cycle-table-scrollbar > div { height: 20px; }
.nuclear-fuel-cycle-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.nuclear-fuel-cycle-table-responsive::-webkit-scrollbar { display: none; }
.nuclear-fuel-cycle-table-responsive table {
    width: max-content !important;
    min-width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}
.nuclear-fuel-cycle-table-responsive th,
.nuclear-fuel-cycle-table-responsive td {
    white-space: nowrap;
    padding: 0.75rem;
    vertical-align: top;
    font-family: var(--font-body);
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    color: #000000;
    border: 1px solid #dee2e6;
    text-align: left;
}
.nuclear-fuel-cycle-table-responsive thead th,
.nuclear-fuel-cycle-table-responsive tbody th { font-weight: 700; }
.nuclear-fuel-cycle-table-responsive thead th { vertical-align: bottom; }
.wb-inv {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}
            `}</style>

            <div className="nuclear-fuel-cycle-inner">
                <div className="nuclear-fuel-cycle-infographic-section">
                    <figure
                        className="nuclear-fuel-cycle-infographic-figure"
                        aria-label={getText('nuclear_fuel_cycle_infographic_aria', lang)}
                    >
                        <img
                            ref={infographicImgRef}
                            src={bgImage}
                            alt=""
                            className="nuclear-fuel-cycle-bg-image"
                            draggable={false}
                            aria-hidden="true"
                        />
                        <figcaption className="wb-inv">
                            {getText('nuclear_fuel_cycle_infographic_aria', lang)}
                        </figcaption>
                    </figure>

                    <div className="nuclear-fuel-cycle-download-buttons">
                        <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                            {getText('nuclear_fuel_cycle_download_infographic_png', lang)}
                        </button>
                    </div>
                </div>

                <div className="nuclear-fuel-cycle-table-wrapper">
                    <details
                        className="nuclear-fuel-cycle-data-table"
                        onToggle={(event) => setIsTableOpen(event.currentTarget.open)}
                    >
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('nuclear_fuel_cycle_table_summary', lang)}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="nuclear-fuel-cycle-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="nuclear-fuel-cycle-table-responsive table-responsive"
                            role="region"
                            aria-label={getText('nuclear_fuel_cycle_table_summary', lang)}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{getText('nuclear_fuel_cycle_table_caption', lang)}</caption>
                                <thead>
                                    <tr>
                                        {tableHeaders.map((header) => (
                                            <th key={header} scope="col">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.map((row) => (
                                        <tr key={row.id}>
                                            <th scope="row">{row.category}</th>
                                            <td>{row.site}</td>
                                            <td>{row.location}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="nuclear-fuel-cycle-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="nuclear-fuel-cycle-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('nuclear_fuel_cycle_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('nuclear_fuel_cycle_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default NuclearFuelCycle;
