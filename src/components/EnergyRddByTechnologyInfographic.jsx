import React from 'react';
import energyRddByTechnologyBg1 from '../assets/energy_rdd_by_technology_bg_1.png';
import energyRddByTechnologyBg2 from '../assets/energy_rdd_by_technology_bg_2.png';
import { COLUMN_KEYS, FN_PREFIX, INFOGRAPHIC_DATA, ROW_KEYS } from './EnergyRddByTechnologyInfographic.constants';

const fnRefId = (n) => `fn${n}-rf-${FN_PREFIX}`;
const fnDefId = (n) => `fn${n}-${FN_PREFIX}`;

const FootnoteRef = ({ number, lang, scrollToElement }) => (
    <span id={fnRefId(number)} style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
        <a className="fn-lnk" href={`#${fnDefId(number)}`} onClick={scrollToElement(fnDefId(number))}>
            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
            <span aria-hidden="true">{number}</span>
        </a>
    </span>
);

const EnergyRddByTechnologyInfographic = ({
    lang,
    figureRef,
    columnLabels,
    rowLabels,
    totalLabel,
    formatMillions,
    scrollToElement,
    ariaLabel,
}) => (
    <figure ref={figureRef} className="energy-rdd-by-technology-infographic-figure" aria-label={ariaLabel}>
        <div className="energy-rdd-by-technology-infographic-grid" role="table" aria-label={ariaLabel}>
            <div className="energy-rdd-by-technology-corner" role="presentation" aria-hidden="true" />
            <div className="energy-rdd-by-technology-corner" role="presentation" aria-hidden="true" />

            <div className="energy-rdd-by-technology-bg1-cell" aria-hidden="true">
                <img src={energyRddByTechnologyBg1} alt="" className="energy-rdd-by-technology-bg1-img" draggable={false} />
            </div>

            <div className="energy-rdd-by-technology-corner" role="presentation" aria-hidden="true" />
            <div className="energy-rdd-by-technology-corner" role="presentation" aria-hidden="true" />
            {COLUMN_KEYS.map((key) => (
                <div key={key} className="energy-rdd-by-technology-col-label" role="columnheader">
                    {columnLabels[key]}
                </div>
            ))}

            <div className="energy-rdd-by-technology-bg2-cell" aria-hidden="true">
                <img src={energyRddByTechnologyBg2} alt="" className="energy-rdd-by-technology-bg2-img" draggable={false} />
            </div>

            {ROW_KEYS.map((rowKey) => (
                <React.Fragment key={rowKey}>
                    <div className="energy-rdd-by-technology-row-label" role="rowheader">
                        {rowLabels[rowKey]}
                        {rowKey === 'renewable' && (
                            <FootnoteRef number="1" lang={lang} scrollToElement={scrollToElement} />
                        )}
                        {rowKey === 'endUse' && (
                            <FootnoteRef number="2" lang={lang} scrollToElement={scrollToElement} />
                        )}
                    </div>
                    {COLUMN_KEYS.map((colKey) => (
                        <div key={`${rowKey}-${colKey}`} className="energy-rdd-by-technology-cell-value" role="cell">
                            {formatMillions(INFOGRAPHIC_DATA[rowKey][colKey])}
                        </div>
                    ))}
                </React.Fragment>
            ))}

            <div className="energy-rdd-by-technology-row-label energy-rdd-by-technology-row-label--total" role="rowheader">
                {totalLabel}
                <FootnoteRef number="3" lang={lang} scrollToElement={scrollToElement} />
            </div>
            {COLUMN_KEYS.map((colKey) => (
                <div key={`total-${colKey}`} className="energy-rdd-by-technology-cell-value energy-rdd-by-technology-cell-value--total" role="cell">
                    {formatMillions(INFOGRAPHIC_DATA.total[colKey])}
                </div>
            ))}
        </div>
        <figcaption className="wb-inv">{ariaLabel}</figcaption>
    </figure>
);

export default EnergyRddByTechnologyInfographic;
