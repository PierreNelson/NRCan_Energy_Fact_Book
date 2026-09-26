import React, { useId } from 'react';
import FootnoteMarker from './FootnoteMarker';
import energyRddByTechnologyBg1 from '../assets/energy_rdd_by_technology_bg_1.png';
import energyRddByTechnologyBg2 from '../assets/energy_rdd_by_technology_bg_2.png';
import { COLUMN_KEYS, FN_PREFIX, INFOGRAPHIC_DATA, ROW_KEYS } from './EnergyRddByTechnologyInfographic.constants';

const ROW_FOOTNOTES = {
    renewable: '1',
    endUse: '2',
    total: '3',
};

const fnRefId = (n) => `fn${n}-rf-${FN_PREFIX}`;
const fnDefId = (n) => `fn${n}-${FN_PREFIX}`;

/** Row spoken order: title, then each column header + value in millions of dollars. */
function buildRowSpokenLabel({
    rowLabel,
    values,
    columnLabels,
    formatMillions,
    lang,
}) {
    const unit = lang === 'fr' ? 'millions de dollars' : 'millions of dollars';
    const parts = [rowLabel];
    COLUMN_KEYS.forEach((key) => {
        parts.push(`${columnLabels[key]}: ${formatMillions(values[key])} ${unit}`);
    });
    return parts.join('. ');
}

/**
 * Each technology / total band is one focusable region spanning icon → values
 * so the yellow outline covers the full row. Tab order: row → footnote → next row.
 */
const EnergyRddByTechnologyInfographic = ({
    lang,
    figureRef,
    columnLabels,
    rowLabels,
    totalLabel,
    formatMillions,
}) => {
    const reactId = useId().replace(/:/g, '');

    const techRows = ROW_KEYS.map((rowKey) => ({
        key: rowKey,
        label: rowLabels[rowKey],
        values: INFOGRAPHIC_DATA[rowKey],
        footnote: ROW_FOOTNOTES[rowKey] || null,
        isTotal: false,
    }));

    const totalRow = {
        key: 'total',
        label: totalLabel,
        values: INFOGRAPHIC_DATA.total,
        footnote: ROW_FOOTNOTES.total,
        isTotal: true,
    };

    const renderDataRow = (row) => {
        const spokenId = `rdd-row-${row.key}-${reactId}`;
        const spoken = buildRowSpokenLabel({
            rowLabel: row.label,
            values: row.values,
            columnLabels,
            formatMillions,
            lang,
        });

        return (
            <div
                key={row.key}
                className={
                    row.isTotal
                        ? 'energy-rdd-by-technology-data-row energy-rdd-by-technology-data-row--total'
                        : 'energy-rdd-by-technology-data-row'
                }
                role="region"
                tabIndex={0}
                aria-labelledby={spokenId}
                data-row-key={row.key}
            >
                <p id={spokenId} className="wb-inv">{spoken}</p>

                <div className="energy-rdd-by-technology-row-icon" aria-hidden="true" />

                <div
                    className={
                        row.isTotal
                            ? 'energy-rdd-by-technology-row-label energy-rdd-by-technology-row-label--total'
                            : 'energy-rdd-by-technology-row-label'
                    }
                >
                    {row.label}
                    {row.footnote ? (
                        <FootnoteMarker
                            lang={lang}
                            href={`#${fnDefId(row.footnote)}`}
                            id={fnRefId(row.footnote)}
                            marker={row.footnote}
                        />
                    ) : null}
                </div>

                {COLUMN_KEYS.map((colKey) => (
                    <div
                        key={`${row.key}-${colKey}`}
                        className={
                            row.isTotal
                                ? 'energy-rdd-by-technology-cell-value energy-rdd-by-technology-cell-value--total'
                                : 'energy-rdd-by-technology-cell-value'
                        }
                        aria-hidden="true"
                    >
                        {formatMillions(row.values[colKey])}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <figure
            ref={figureRef}
            className="energy-rdd-by-technology-infographic-figure"
        >
            <div className="energy-rdd-by-technology-infographic-grid">
                <div className="energy-rdd-by-technology-header-band" aria-hidden="true">
                    <div className="energy-rdd-by-technology-corner" />
                    <div className="energy-rdd-by-technology-corner" />
                    <div className="energy-rdd-by-technology-bg1-cell">
                        <img
                            src={energyRddByTechnologyBg1}
                            alt=""
                            className="energy-rdd-by-technology-bg1-img"
                            draggable={false}
                        />
                    </div>
                </div>

                <div className="energy-rdd-by-technology-colhead-band" aria-hidden="true">
                    <div className="energy-rdd-by-technology-corner" />
                    <div className="energy-rdd-by-technology-corner" />
                    {COLUMN_KEYS.map((key) => (
                        <div key={key} className="energy-rdd-by-technology-col-label">
                            {columnLabels[key]}
                        </div>
                    ))}
                </div>

                <div className="energy-rdd-by-technology-tech-rows">
                    <div className="energy-rdd-by-technology-bg2-cell" aria-hidden="true">
                        <img
                            src={energyRddByTechnologyBg2}
                            alt=""
                            className="energy-rdd-by-technology-bg2-img"
                            draggable={false}
                        />
                    </div>
                    {techRows.map(renderDataRow)}
                </div>

                {renderDataRow(totalRow)}
            </div>
        </figure>
    );
};

export default EnergyRddByTechnologyInfographic;
