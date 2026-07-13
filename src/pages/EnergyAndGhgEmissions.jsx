import React, { useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import energyAndGhgEmissionsBgEn from '../assets/energy_and_ghg_emissions_bg.svg';
import energyAndGhgEmissionsBgFr from '../assets/energy_and_ghg_emissions_bg_fr.svg';

const INFO_COLUMN_WIDTHS = [5200, 3600];

const HIGHLIGHT_KEYS = ['global_share', 'canada_share'];

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const EnergyAndGhgEmissions = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);

    const pageTitle = getText('energy_and_ghg_emissions_title', lang);
    const bgImage = lang === 'en' ? energyAndGhgEmissionsBgEn : energyAndGhgEmissionsBgFr;
    const fileTitle = getText('energy_and_ghg_emissions_download_title', lang);

    const tableRows = HIGHLIGHT_KEYS.map((key) => ({
        key,
        indicator: getText(`energy_and_ghg_emissions_csv_${key}`, lang),
        value: getText(`energy_and_ghg_emissions_csv_value_${key}`, lang),
    }));

    const downloadInfographicPng = async () => {
        const imgEl = infographicImgRef.current;
        if (!imgEl) return;
        try {
            const loaded = await waitForImage(imgEl);
            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = loaded.naturalWidth * scale;
            canvas.height = loaded.naturalHeight * scale;
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, loaded.naturalWidth, loaded.naturalHeight);
            ctx.drawImage(loaded, 0, 0, loaded.naturalWidth, loaded.naturalHeight);
            canvas.toBlob((blob) => {
                if (blob) saveAs(blob, `${fileTitle}.png`);
            });
        } catch (err) {
            console.warn('Unable to download infographic image.', err);
        }
    };

    const downloadCsv = () => {
        const headers = [
            getText('energy_and_ghg_emissions_csv_col_indicator', lang),
            getText('energy_and_ghg_emissions_csv_col_value', lang),
        ];
        const sections = [
            headers.map(csvEscape).join(','),
            ...tableRows.map((row) => [row.indicator, row.value].map(csvEscape).join(',')),
        ];
        const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileTitle}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: [
                getText('energy_and_ghg_emissions_csv_col_indicator', lang),
                getText('energy_and_ghg_emissions_csv_col_value', lang),
            ].map((header) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 18 })],
                })],
                shading: { fill: 'E6E6E6' },
            })),
        });

        const dataRows = tableRows.map((row) => new TableRow({
            children: [row.indicator, row.value].map((value) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: value, size: 18 })],
                })],
            })),
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: pageTitle, bold: true, size: 28 })],
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: INFO_COLUMN_WIDTHS,
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileTitle}.docx`);
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content energy-and-ghg-emissions"
            role="main"
            aria-labelledby="energy-and-ghg-emissions-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.energy-and-ghg-emissions {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.energy-and-ghg-emissions-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-and-ghg-emissions.page-content h1.energy-and-ghg-emissions-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px !important;
    font-weight: bold;
    color: #245e7f;
    margin-top: 0;
    margin-bottom: 25px;
    position: relative;
    padding-bottom: 0.5em;
    line-height: 1.2;
    text-transform: none;
}
.energy-and-ghg-emissions.page-content h1.energy-and-ghg-emissions-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.energy-and-ghg-emissions-figure {
    margin: 0;
    width: 100%;
}
.energy-and-ghg-emissions-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.energy-and-ghg-emissions-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 15px 0 20px 0;
    align-items: center;
}
.energy-and-ghg-emissions-actions button {
    appearance: none;
    -webkit-appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    height: 36px;
    padding: 0 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    background-color: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    line-height: 1;
    color: #ffffff;
    text-align: center;
    white-space: nowrap;
    box-sizing: border-box;
}
.energy-and-ghg-emissions-actions button:hover {
    background: #404040 !important;
    background-color: #404040 !important;
}
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
@media (max-width: 768px) {
    .energy-and-ghg-emissions.page-content h1.energy-and-ghg-emissions-title { font-size: 37px !important; }
}
            `}</style>

            <div className="energy-and-ghg-emissions-inner">
                <h1 id="energy-and-ghg-emissions-title" className="energy-and-ghg-emissions-title">
                    {pageTitle}
                </h1>

                <figure
                    className="energy-and-ghg-emissions-figure"
                    aria-label={getText('energy_and_ghg_emissions_infographic_aria', lang)}
                >
                    <img
                        ref={infographicImgRef}
                        className="energy-and-ghg-emissions-bg-image"
                        src={bgImage}
                        alt={getText('energy_and_ghg_emissions_infographic_aria', lang)}
                        draggable={false}
                    />
                </figure>

                <div className="energy-and-ghg-emissions-actions">
                    <button type="button" onClick={downloadInfographicPng}>
                        {getText('energy_and_ghg_emissions_download_png', lang)}
                    </button>
                    <button type="button" onClick={downloadCsv}>
                        {getText('energy_and_ghg_emissions_download_csv', lang)}
                    </button>
                    <button type="button" onClick={downloadDocx}>
                        {getText('energy_and_ghg_emissions_download_docx', lang)}
                    </button>
                </div>
            </div>
        </main>
    );
};

export default EnergyAndGhgEmissions;
