import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getCleanTechTrendsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page29 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(true);

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    useEffect(() => {
        import('./Page31');
    }, []);

    useEffect(() => {
        getCleanTechTrendsData()
            .then(data => {
                setPageData(data);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const categories = [
        { key: 'total', label: getText('page29_total', lang), isTotal: true },
        { key: 'hydro', label: getText('page29_hydro', lang) },
        { key: 'wind', label: getText('page29_wind', lang) },
        { key: 'biomass', label: getText('page29_biomass', lang), footnote: null },
        { key: 'solar', label: getText('page29_solar', lang) },
        { key: 'nuclear', label: getText('page29_nuclear', lang) },
        { key: 'ccs', label: getText('page29_ccs', lang) },
        { key: 'geothermal', label: getText('page29_geothermal', lang) },
        { key: 'tidal', label: getText('page29_tidal', lang) },
        { key: 'multiple', label: getText('page29_multiple', lang), footnote: '1' },
        { key: 'other', label: getText('page29_other', lang), footnote: '2' },
    ];

    const years = pageData.map(d => d.year);
    const minYear = years.length > 0 ? Math.min(...years) : 2021;
    const maxYear = years.length > 0 ? Math.max(...years) : 2024;
    const pageTitle = `${getText('page29_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;

    const formatValue = (val) => {
        if (val === undefined || val === null) return '—';
        if (val < 1) return `$${val.toFixed(2)}B`;
        return `$${val.toFixed(1)}B`;
    };

    const formatValueFr = (val) => {
        if (val === undefined || val === null) return '—';
        if (val < 1) return `${val.toFixed(2).replace('.', ',')} G$`;
        return `${val.toFixed(1).replace('.', ',')} G$`;
    };

    const downloadTableAsCSV = () => {
        if (!pageData || pageData.length === 0) return;

        const headers = [
            lang === 'en' ? 'Category' : 'Catégorie',
            ...years.map(y => `${y} ${lang === 'en' ? 'Projects' : 'Projets'}`),
            ...years.map(y => `${y} ${lang === 'en' ? 'Value ($B)' : 'Valeur (G$)'}`)
        ];

        const rows = categories.map(cat => {
            const projectsData = years.map(y => {
                const yearData = pageData.find(d => d.year === y);
                return yearData ? yearData[`${cat.key}_projects`] : '';
            });
            const valuesData = years.map(y => {
                const yearData = pageData.find(d => d.year === y);
                return yearData ? yearData[`${cat.key}_value`] : '';
            });
            return [cat.label, ...projectsData, ...valuesData];
        });

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'clean_technology_trends.csv' : 'tendances_technologies_propres.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        if (!pageData || pageData.length === 0) return;

        const title = stripHtml(pageTitle);

        const headerBgColor = '8e7e52';  // Olive/tan for header and category column
        const totalRowBgColor = '48494a'; // Dark gray for total row data cells
        const zebraStripeBgColor = 'd4cbba'; // Light beige for even rows

        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })],
                    shading: { fill: headerBgColor }
                }),
                ...years.map(y => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: String(y), bold: true, size: 28, color: 'FFFFFF' })],
                        alignment: AlignmentType.CENTER
                    })],
                    shading: { fill: headerBgColor }
                }))
            ]
        });

        const dataRows = categories.map((cat, index) => {
            const isTotal = cat.isTotal;
            const isEvenRow = (index + 1) % 2 === 0; // +1 because header is row 0
            
            return new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ 
                                text: cat.label + (cat.footnote ? ` (${cat.footnote})` : ''), 
                                bold: true, 
                                size: 22, 
                                color: 'FFFFFF' 
                            })],
                            alignment: AlignmentType.LEFT
                        })],
                        shading: { fill: headerBgColor }
                    }),
                    ...years.map(y => {
                        const yearData = pageData.find(d => d.year === y);
                        const projects = yearData ? yearData[`${cat.key}_projects`] : 0;
                        const value = yearData ? yearData[`${cat.key}_value`] : 0;
                        const projectLabel = projects === 1 
                            ? (lang === 'en' ? 'project' : 'projet')
                            : (lang === 'en' ? 'projects' : 'projets');
                        const valueStr = lang === 'en'
                            ? (value < 1 ? `$${value.toFixed(2)}B` : `$${value.toFixed(1)}B`)
                            : (value < 1 ? `${value.toFixed(2).replace('.', ',')} G$` : `${value.toFixed(1).replace('.', ',')} G$`);
                        
                        let cellBgColor = undefined;
                        let textColor = '333333'; // Default dark text
                        
                        if (isTotal) {
                            cellBgColor = totalRowBgColor;
                            textColor = 'FFFFFF';
                        } else if (isEvenRow) {
                            cellBgColor = zebraStripeBgColor;
                        }
                        
                        return new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ 
                                        text: `${projects} ${projectLabel}`, 
                                        size: 22, 
                                        bold: isTotal,
                                        color: textColor
                                    })],
                                    alignment: AlignmentType.CENTER
                                }),
                                new Paragraph({
                                    children: [new TextRun({ 
                                        text: `(${valueStr})`, 
                                        size: 18, 
                                        bold: isTotal,
                                        color: isTotal ? 'DDDDDD' : '666666' // Lighter color for value text
                                    })],
                                    alignment: AlignmentType.CENTER
                                })
                            ],
                            shading: cellBgColor ? { fill: cellBgColor } : undefined
                        });
                    })
                ]
            });
        });

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: title, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 }
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [2500, 1500, 1500, 1500, 1500],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'clean_technology_trends.docx' : 'tendances_technologies_propres.docx');
    };

    if (loading) return <div className="loading">{lang === 'en' ? 'Loading...' : 'Chargement...'}</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (!pageData || pageData.length === 0) return <div className="error">{lang === 'en' ? 'No data available' : 'Aucune donnée disponible'}</div>;

    return (
        <main id="main-content" tabIndex="-1" className="page-content page29-main" role="main">
            <style>{`
                .page29-main {
                    width: calc(100% + ${layoutPadding.left}px + ${layoutPadding.right}px);
                    margin-left: -${layoutPadding.left}px;
                    margin-right: -${layoutPadding.right}px;
                    display: flex;
                    flex-direction: column;
                }

                .page29-container {
                    padding-left: ${layoutPadding.left}px;
                    padding-right: ${layoutPadding.right}px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page29-title {
                    font-family: Arial, sans-serif;
                    font-size: 2rem;
                    font-weight: bold;
                    margin-bottom: 20px;
                    color: #58585a;
                }

                .page29-table-wrapper {
                    width: 100%;
                    margin-top: 20px;
                }

                /* FORCE table to fit the screen width and resize (Squish/Stretch) */
                .page29-table-wrapper table {
                    width: 100% !important;      /* Forces table to fill the container */
                    min-width: 0 !important;     /* Removes the trigger for the scrollbar */
                    max-width: 100% !important;  /* Prevents it from going wider than screen */
                    table-layout: auto;          /* Lets columns resize based on text */
                }

                /* Disable the scroll container behavior */
                .page29-table-wrapper .table-responsive {
                    overflow-x: visible !important; /* Removes the scrollbar */
                    width: 100%;
                }

                .page29-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: Arial, sans-serif;
                    font-size: 0.9rem;
                }

                .page29-table th,
                .page29-table td {
                    border: 1px solid #ddd;
                    padding: 8px 12px;
                    text-align: center;
                }

                /* Header Styling */
                .page29-table th {
                    background-color: #8e7e52;
                    color: white;
                    font-weight: bold;
                    font-size: 1.4rem;
                }

                /* Left Column Styling */
                .page29-table .category-cell {
                    text-align: left;
                    background-color: #8e7e52; 
                    color: white;
                    font-weight: bold;
                    font-size: 1rem;
                    
                    /* Text Wrapping Settings */
                    white-space: normal;      
                    width: 180px;             
                    min-width: 150px;         
                    vertical-align: middle;   
                    line-height: 1.2;         
                }

                /* Total Row Data Cells */
                .page29-table .total-row td {
                    background-color: #48494a; 
                    color: white;
                    font-weight: bold;
                }

                /* Total Row Label (Keep left column color) */
                .page29-table .total-row .category-cell {
                    background-color: #8e7e52;
                    color: white;
                }

                /* Zebra Striping */
                .page29-table tbody tr:nth-child(even):not(.total-row) {
                    background-color: #d4cbba;
                }

                /* Hover Effects */
                .page29-table tbody tr:nth-child(odd):hover:not(.total-row) {
                    background-color: #f2f2f2;
                }

                .page29-table tbody tr:nth-child(even):hover:not(.total-row) {
                    background-color: #c4bbab;
                }

                .page29-cell-value {
                    font-size: 0.85rem;
                    color: #666;
                }

                .page29-total-cell-value {
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.9);
                }

                .page29-download-buttons {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-top: 15px;
                }

                .page29-download-btn {
                    padding: 8px 16px;
                    background-color: #f9f9f9;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #333;
                }

                .page29-download-btn:hover {
                    background-color: #e9e9e9;
                }

                .page29-footnotes {
                    font-family: Arial, sans-serif;
                    font-size: 1rem;
                    color: #555;
                    margin-top: 20px;
                    line-height: 1.4;
                }

                .page29-footnotes dl {
                    margin: 0;
                    padding: 0;
                }

                .page29-footnotes dt {
                    float: left;
                    clear: left;
                    width: 1.5em;
                    font-weight: normal;
                }

                .page29-footnotes dd {
                    margin-left: 1.5em;
                    margin-bottom: 0.5em;
                }

                .page29-footnotes dd p {
                    margin: 0;
                }

                /* CONSOLIDATED RESPONSIVE FIX
                   Handles high zoom (300%+) and all mobile devices by forcing
                   the table to stay within the viewport width. */
                @media (max-width: 992px) {
                    /* 1. Reset container negative margins so page fits screen */
                    .page29-main {
                        width: 100% !important;
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                    }
                    .page29-container {
                        padding-left: 4px !important;
                        padding-right: 4px !important;
                    }

                    /* 2. Force table to squeeze into viewport (No Horizontal Scroll) */
                    .page29-table-wrapper, 
                    .table-responsive {
                        width: 100% !important;
                        overflow-x: hidden !important; /* Disable scrollbar */
                    }

                    .page29-table {
                        width: 100% !important;
                        table-layout: fixed; /* CRITICAL: Forces columns to compress */
                        min-width: 0 !important; /* Remove any minimum width constraint */
                        font-size: 0.7rem; /* Reduce font size */
                    }

                    /* 3. Aggressive text wrapping to fit narrow columns */
                    .page29-table th,
                    .page29-table td {
                        padding: 4px 2px;
                        white-space: normal !important;
                        overflow-wrap: break-word;
                        word-break: break-word; /* Ensure long words/numbers break */
                        hyphens: auto;
                    }

                    /* 4. Column Sizing */
                    /* Give the category column slightly more space (25%) */
                    .page29-table .category-cell {
                        width: 25%; 
                        font-size: 0.7rem;
                        min-width: auto; /* Remove 150px limit */
                    }
                    
                    /* The remaining 75% is shared by the 6 year columns (~12.5% each) */
                    
                    /* 5. Adjust Footnotes for zoom */
                    .page29-footnotes {
                        font-size: 0.9rem;
                    }
                }
            `}</style>

            <div className="page29-container">
                <h1 className="page29-title">{pageTitle}</h1>

                <div className="page29-table-wrapper">
                    <div className="table-responsive" role="region">
                        <table className="page29-table">
                            <caption className="wb-inv">
                                {getText('page29_table_caption', lang)}
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col"></th>
                                    {years.map(y => (
                                        <th key={y} scope="col">{y}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map(cat => {
                                    const isTotal = cat.isTotal;
                                    return (
                                        <tr key={cat.key} className={isTotal ? 'total-row' : ''}>
                                            <td className="category-cell" scope="row">
                                                {cat.label}
                                                {cat.footnote && <sup>{cat.footnote}</sup>}
                                            </td>
                                            {years.map(y => {
                                                const yearData = pageData.find(d => d.year === y);
                                                const projects = yearData ? yearData[`${cat.key}_projects`] : 0;
                                                const value = yearData ? yearData[`${cat.key}_value`] : 0;
                                                const valueDisplay = lang === 'en' ? formatValue(value) : formatValueFr(value);
                                                const projectLabel = projects === 1 
                                                    ? (lang === 'en' ? 'project' : 'projet')
                                                    : getText('page29_projects', lang);
                                                
                                                return (
                                                    <td 
                                                        key={y}
                                                        aria-label={`${y}, ${cat.label}: ${projects} ${projectLabel}, ${value} ${lang === 'en' ? 'billion dollars' : 'milliards de dollars'}`}
                                                    >
                                                        <div>{projects} {projectLabel}</div>
                                                        <div className={isTotal ? 'page29-total-cell-value' : 'page29-cell-value'}>
                                                            ({valueDisplay})
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="page29-download-buttons">
                        <button className="page29-download-btn" onClick={downloadTableAsCSV}>
                            {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                        </button>
                        <button className="page29-download-btn" onClick={downloadTableAsDocx}>
                            {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                        </button>
                    </div>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: '10px', padding: '10px 0' }}>
                    <h2 className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl className="page29-footnotes" style={{ margin: 0 }}>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-values" style={{ margin: '0 0 8px 0' }}>
                            <p style={{ margin: 0 }}>{getText('page29_footnote_values', lang)}</p>
                        </dd>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1" style={{ margin: '0 0 8px 0' }}>
                            <p style={{ margin: 0 }}><sup>1</sup> {getText('page29_footnote1', lang)}</p>
                        </dd>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote 2' : 'Note de bas de page 2'}</dt>
                        <dd id="fn2" style={{ margin: 0 }}>
                            <p style={{ margin: 0 }}><sup>2</sup> {getText('page29_footnote2', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page29;
