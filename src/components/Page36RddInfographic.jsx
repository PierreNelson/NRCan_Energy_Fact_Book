import React from 'react';
import page36Bg1 from '../assets/page36_bg_1.png';
import page36Bg2 from '../assets/page36_bg_2.png';
import { COLUMN_KEYS, FN_PREFIX, INFOGRAPHIC_DATA, ROW_KEYS } from './Page36RddInfographic.constants';

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

const Page36RddInfographic = ({
    lang,
    figureRef,
    columnLabels,
    rowLabels,
    totalLabel,
    formatMillions,
    scrollToElement,
    ariaLabel,
}) => (
    <figure ref={figureRef} className="page36-infographic-figure" aria-label={ariaLabel}>
        <div className="page36-infographic-grid" role="table" aria-label={ariaLabel}>
            <div className="page36-corner" role="presentation" aria-hidden="true" />
            <div className="page36-corner" role="presentation" aria-hidden="true" />

            <div className="page36-bg1-cell" aria-hidden="true">
                <img src={page36Bg1} alt="" className="page36-bg1-img" draggable={false} />
            </div>

            <div className="page36-corner" role="presentation" aria-hidden="true" />
            <div className="page36-corner" role="presentation" aria-hidden="true" />
            {COLUMN_KEYS.map((key) => (
                <div key={key} className="page36-col-label" role="columnheader">
                    {columnLabels[key]}
                </div>
            ))}

            <div className="page36-bg2-cell" aria-hidden="true">
                <img src={page36Bg2} alt="" className="page36-bg2-img" draggable={false} />
            </div>

            {ROW_KEYS.map((rowKey) => (
                <React.Fragment key={rowKey}>
                    <div className="page36-row-label" role="rowheader">
                        {rowLabels[rowKey]}
                        {rowKey === 'renewable' && (
                            <FootnoteRef number="1" lang={lang} scrollToElement={scrollToElement} />
                        )}
                        {rowKey === 'endUse' && (
                            <FootnoteRef number="2" lang={lang} scrollToElement={scrollToElement} />
                        )}
                    </div>
                    {COLUMN_KEYS.map((colKey) => (
                        <div key={`${rowKey}-${colKey}`} className="page36-cell-value" role="cell">
                            {formatMillions(INFOGRAPHIC_DATA[rowKey][colKey])}
                        </div>
                    ))}
                </React.Fragment>
            ))}

            <div className="page36-row-label page36-row-label--total" role="rowheader">
                {totalLabel}
                <FootnoteRef number="3" lang={lang} scrollToElement={scrollToElement} />
            </div>
            {COLUMN_KEYS.map((colKey) => (
                <div key={`total-${colKey}`} className="page36-cell-value page36-cell-value--total" role="cell">
                    {formatMillions(INFOGRAPHIC_DATA.total[colKey])}
                </div>
            ))}
        </div>
        <figcaption className="wb-inv">{ariaLabel}</figcaption>
    </figure>
);

export default Page36RddInfographic;
