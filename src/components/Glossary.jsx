import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';

const Glossary = () => {
    const { lang } = useOutletContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [allData, setAllData] = useState([]);
    const [metadata, setMetadata] = useState([]);
    const [majorProjects, setMajorProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [dataRes, metaRes, projectsRes] = await Promise.all([
                    fetch(`${import.meta.env.BASE_URL}data/data.csv`),
                    fetch(`${import.meta.env.BASE_URL}data/metadata.csv`),
                    fetch(`${import.meta.env.BASE_URL}data/major_projects_map.csv`)
                ]);
                
                const dataText = await dataRes.text();
                const metaText = await metaRes.text();
                const projectsText = await projectsRes.text();
                
                const parseCSV = (text) => {
                    const lines = text.trim().split('\n');
                    const headers = lines[0].split(',');
                    return lines.slice(1).map(line => {
                        const values = [];
                        let current = '';
                        let inQuotes = false;
                        for (let i = 0; i < line.length; i++) {
                            const char = line[i];
                            if (char === '"') {
                                inQuotes = !inQuotes;
                            } else if (char === ',' && !inQuotes) {
                                values.push(current.trim());
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        values.push(current.trim());
                        const obj = {};
                        headers.forEach((h, i) => obj[h.trim()] = values[i] || '');
                        return obj;
                    });
                };
                
                setAllData(parseCSV(dataText));
                setMetadata(parseCSV(metaText));
                setMajorProjects(parseCSV(projectsText));
                setLoading(false);
            } catch (err) {
                console.error('Error loading glossary data:', err);
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredResults = useMemo(() => {
        if (!searchTerm.trim()) return { vectors: [], projects: [] };
        
        const term = searchTerm.toLowerCase();
        
        // Search data.csv and metadata.csv
        const matchingVectors = new Set();
        metadata.forEach(m => {
            if (m.vector?.toLowerCase().includes(term) || 
                m.title?.toLowerCase().includes(term)) {
                matchingVectors.add(m.vector);
            }
        });
        allData.forEach(d => {
            if (d.vector?.toLowerCase().includes(term)) {
                matchingVectors.add(d.vector);
            }
        });
        
        const vectorResults = Array.from(matchingVectors).map(vector => {
            const meta = metadata.find(m => m.vector === vector) || {};
            const dataPoints = allData.filter(d => d.vector === vector);
            return {
                vector,
                title: meta.title || '',
                uom: meta.uom || '',
                scalar: meta.scalar_factor || '',
                dataSource: meta.data_source || '',
                sourceOrg: meta.source_org || '',
                sourceUrl: meta.source_url || '',
                dataPoints
            };
        }).sort((a, b) => a.vector.localeCompare(b.vector));
        
        // Search major_projects_map.csv
        const projectResults = majorProjects.filter(p => {
            const currentLang = lang || 'en';
            if (p.lang && p.lang !== currentLang) return false;
            return (
                p.project_name?.toLowerCase().includes(term) ||
                p.company?.toLowerCase().includes(term) ||
                p.province?.toLowerCase().includes(term) ||
                p.location?.toLowerCase().includes(term) ||
                p.status?.toLowerCase().includes(term) ||
                p.clean_technology_type?.toLowerCase().includes(term) ||
                p.line_type?.toLowerCase().includes(term)
            );
        });
        
        return { vectors: vectorResults, projects: projectResults };
    }, [searchTerm, allData, metadata, majorProjects, lang]);

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
    }

    const totalResults = filteredResults.vectors.length + filteredResults.projects.length;

    return (
        <main id="main-content" tabIndex="-1" className="page-content">
            <style>{`
                .glossary-container {
                    max-width: 1140px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .glossary-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                .glossary-search {
                    width: 100%;
                    max-width: 500px;
                    padding: 12px 16px;
                    font-size: 18px;
                    border: 2px solid #26374a;
                    border-radius: 4px;
                    margin-bottom: 30px;
                }
                .glossary-search:focus {
                    outline: 3px solid #ffbf47;
                    outline-offset: 2px;
                }
                .glossary-results-count {
                    font-size: 16px;
                    color: #666;
                    margin-bottom: 20px;
                }
                .glossary-section-title {
                    font-size: 22px;
                    font-weight: bold;
                    margin: 30px 0 15px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #26374a;
                }
                .glossary-item {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 16px;
                    margin-bottom: 16px;
                    background: #fafafa;
                }
                .glossary-vector {
                    font-family: monospace;
                    font-size: 14px;
                    color: #26374a;
                    background: #e8e8e8;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
                .glossary-item-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 10px 0;
                }
                .glossary-meta {
                    font-size: 14px;
                    color: #555;
                }
                .glossary-meta code {
                    font-family: monospace;
                    background: #e8e8e8;
                    padding: 1px 4px;
                    border-radius: 3px;
                    font-size: 13px;
                }
                .glossary-source {
                    font-size: 14px;
                    color: #333;
                    margin-top: 8px;
                    padding: 8px;
                    background: #e8f4e8;
                    border-radius: 4px;
                    word-break: break-all;
                }
                .glossary-source a {
                    color: #26374a;
                    text-decoration: underline;
                }
                .glossary-source a:hover {
                    color: #1a252f;
                }
                .glossary-empty {
                    padding: 40px;
                    text-align: center;
                    color: #666;
                }
                .glossary-data-details {
                    margin-top: 12px;
                }
                .glossary-data-details summary {
                    cursor: pointer;
                    color: #26374a;
                    font-weight: bold;
                }
                .glossary-data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                    font-size: 14px;
                }
                .glossary-data-table th,
                .glossary-data-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                .glossary-data-table th {
                    background: #26374a;
                    color: white;
                }
                .glossary-data-table tr:nth-child(even) {
                    background: #f9f9f9;
                }
                .glossary-project-item {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 16px;
                    margin-bottom: 16px;
                    background: #f5f8fa;
                }
                .glossary-project-name {
                    font-size: 18px;
                    font-weight: bold;
                    color: #26374a;
                    margin-bottom: 8px;
                }
                .glossary-project-company {
                    font-size: 16px;
                    color: #333;
                    margin-bottom: 6px;
                }
                .glossary-project-detail {
                    font-size: 14px;
                    color: #555;
                    margin: 4px 0;
                }
                .glossary-project-detail strong {
                    color: #333;
                }
                .glossary-status-badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-left: 8px;
                }
                .glossary-status-badge.planned {
                    background: #ffeeba;
                    color: #856404;
                }
                .glossary-status-badge.under-construction {
                    background: #b8daff;
                    color: #004085;
                }
                .glossary-status-badge.operational {
                    background: #c3e6cb;
                    color: #155724;
                }
            `}</style>
            
            <div className="glossary-container">
                <h1 className="glossary-title">
                    {lang === 'en' ? 'Data Glossary' : 'Glossaire des données'}
                </h1>
                
                <input
                    type="search"
                    className="glossary-search"
                    placeholder={lang === 'en' ? 'Search for a term (e.g., "oil", "gdp", "pipeline")...' : 'Rechercher un terme (ex: "pétrole", "pib", "pipeline")...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label={lang === 'en' ? 'Search glossary' : 'Rechercher dans le glossaire'}
                />
                
                {searchTerm.trim() && (
                    <p className="glossary-results-count">
                        {lang === 'en' 
                            ? `${totalResults} result(s) found for "${searchTerm}"`
                            : `${totalResults} résultat(s) trouvé(s) pour "${searchTerm}"`
                        }
                    </p>
                )}
                
                {!searchTerm.trim() ? (
                    <div className="glossary-empty">
                        {lang === 'en' 
                            ? 'Enter a search term to find data vectors, metadata, and major projects.'
                            : 'Entrez un terme de recherche pour trouver des vecteurs de données, des métadonnées et des projets majeurs.'
                        }
                    </div>
                ) : totalResults === 0 ? (
                    <div className="glossary-empty">
                        {lang === 'en' 
                            ? 'No results found.'
                            : 'Aucun résultat trouvé.'
                        }
                    </div>
                ) : (
                    <>
                        {filteredResults.vectors.length > 0 && (
                            <>
                                <h2 className="glossary-section-title">
                                    {lang === 'en' ? `Data Vectors (${filteredResults.vectors.length})` : `Vecteurs de données (${filteredResults.vectors.length})`}
                                </h2>
                                {filteredResults.vectors.map(item => (
                                    <div key={item.vector} className="glossary-item">
                                        <span className="glossary-vector">{item.vector}</span>
                                        {item.title && <div className="glossary-item-title">{item.title}</div>}
                                        <div className="glossary-meta">
                                            {item.uom && <span>Unit: {item.uom}</span>}
                                            {item.scalar && <span> | Scale: {item.scalar}</span>}
                                        </div>
                                        {(item.sourceOrg || item.sourceUrl) && (
                                            <div className="glossary-source">
                                                {item.sourceOrg && <span><strong>Source:</strong> {item.sourceOrg}</span>}
                                                {item.sourceUrl && (
                                                    <span>
                                                        {item.sourceOrg && ' | '}
                                                        <strong>URL:</strong>{' '}
                                                        {item.sourceUrl.startsWith('http') ? (
                                                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceUrl}</a>
                                                        ) : (
                                                            <span>{item.sourceUrl}</span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {item.dataPoints.length > 0 && (
                                            <details className="glossary-data-details">
                                                <summary>{item.dataPoints.length} data point(s) - click to expand</summary>
                                                <table className="glossary-data-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Year/Date</th>
                                                            <th>Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {item.dataPoints.map((dp, idx) => (
                                                            <tr key={idx}>
                                                                <td>{dp.ref_date}</td>
                                                                <td>{dp.value ?? 'N/A'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </details>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                        
                        {filteredResults.projects.length > 0 && (
                            <>
                                <h2 className="glossary-section-title">
                                    {lang === 'en' ? `Major Projects (${filteredResults.projects.length})` : `Projets majeurs (${filteredResults.projects.length})`}
                                </h2>
                                {filteredResults.projects.map((project, idx) => (
                                    <div key={`${project.id}-${idx}`} className="glossary-project-item">
                                        <div className="glossary-project-name">
                                            {project.project_name}
                                            {project.status && (
                                                <span className={`glossary-status-badge ${project.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                                    {project.status}
                                                </span>
                                            )}
                                        </div>
                                        {project.company && (
                                            <div className="glossary-project-company">{project.company}</div>
                                        )}
                                        <div className="glossary-project-detail">
                                            <strong>{lang === 'en' ? 'Province:' : 'Province:'}</strong> {project.province || 'N/A'}
                                        </div>
                                        <div className="glossary-project-detail">
                                            <strong>{lang === 'en' ? 'Location:' : 'Emplacement:'}</strong> {project.location || 'N/A'}
                                        </div>
                                        {project.capital_cost && (
                                            <div className="glossary-project-detail">
                                                <strong>{lang === 'en' ? 'Capital Cost:' : 'Coût en capital:'}</strong> ${project.capital_cost}M
                                                {project.capital_cost_range && ` (${project.capital_cost_range}M)`}
                                            </div>
                                        )}
                                        {project.line_type && (
                                            <div className="glossary-project-detail">
                                                <strong>{lang === 'en' ? 'Type:' : 'Type:'}</strong> {project.line_type}
                                            </div>
                                        )}
                                        {project.clean_technology === 'Yes' && (
                                            <div className="glossary-project-detail">
                                                <strong>{lang === 'en' ? 'Clean Technology:' : 'Technologie propre:'}</strong> {project.clean_technology_type || 'Yes'}
                                            </div>
                                        )}
                                        {(() => {
                                            const sourceOrg = project.source_org || (lang === 'en' ? 'Natural Resources Canada' : 'Ressources naturelles Canada');
                                            const sourceUrl = project.source_url || 'https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034';
                                            return (
                                                <div className="glossary-source">
                                                    <span><strong>{lang === 'en' ? 'Source:' : 'Source :'}</strong> {sourceOrg}</span>
                                                    <span>
                                                        {' | '}
                                                        <strong>URL:</strong>{' '}
                                                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceUrl}</a>
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>
        </main>
    );
};

export default Glossary;
