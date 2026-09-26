import React, { useMemo } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { exportTableToCsv, exportTableToDocx } from '../utils/exportTableToDocx';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const ROW_KEYS = ['level1', 'level2', 'level3'];

const INPUT_BY_KEY = {
    level1: '120 V',
    level2: '208/240 V',
    level3: '480 V',
};

const ElectricVehicleCharging = () => {
    const { lang, layoutPadding } = useOutletContext();

    const pageTitle = getText('electric_vehicle_charging_title', lang);
    const exportTableTitle = stripHtml(pageTitle);
    const tableCaption = getText('electric_vehicle_charging_table_caption', lang);
    const fileSlug = getText('electric_vehicle_charging_download_title', lang);

    const plainHeaders = useMemo(() => [
        getText('electric_vehicle_charging_col_charger', lang),
        getText('electric_vehicle_charging_col_input', lang),
        getText('electric_vehicle_charging_col_outlet', lang),
        getText('electric_vehicle_charging_col_charging_time', lang),
        getText('electric_vehicle_charging_col_range', lang),
        getText('electric_vehicle_charging_col_uses', lang),
    ], [lang]);

    const tableColumns = useMemo(() => {
        const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-electric-vehicle-charging');

        return [
            { key: 'charger', header: plainHeaders[0], align: 'left' },
            { key: 'input', header: plainHeaders[1], align: 'left' },
            { key: 'outlet', header: plainHeaders[2], align: 'left' },
            {
                key: 'chargingTime',
                header: (
                    <>
                        {plainHeaders[3]}
                        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-electric-vehicle-charging"
                            id="fn-asterisk-rf-electric-vehicle-charging"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                    </>
                ),
                align: 'left',
            },
            {
                key: 'range',
                header: (
                    <>
                        {plainHeaders[4]}
                        <span aria-hidden="true" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>*</span>
                    </>
                ),
                align: 'left',
            },
            { key: 'uses', header: plainHeaders[5], align: 'left' },
        ];
    }, [lang, plainHeaders]);

    const tableRows = useMemo(() => ROW_KEYS.map((key) => ({
        charger: getText(`electric_vehicle_charging_row_${key}_charger`, lang),
        input: INPUT_BY_KEY[key],
        outlet: getText(`electric_vehicle_charging_row_${key}_outlet`, lang),
        chargingTime: getText(`electric_vehicle_charging_row_${key}_charging_time`, lang),
        range: getText(`electric_vehicle_charging_row_${key}_range`, lang),
        uses: getText(`electric_vehicle_charging_row_${key}_uses`, lang),
    })), [lang]);

    const exportRows = useMemo(() => tableRows.map((row) => [
        row.charger,
        row.input,
        row.outlet,
        row.chargingTime,
        row.range,
        row.uses,
    ]), [tableRows]);

    const onDownloadCsv = () => {
        exportTableToCsv({
            filename: `${fileSlug}.csv`,
            headers: plainHeaders,
            rows: exportRows,
        });
    };

    const onDownloadDocx = async () => {
        await exportTableToDocx({
            filename: `${fileSlug}.docx`,
            title: exportTableTitle,
            headers: plainHeaders,
            rows: exportRows,
            columnWidths: [1600, 900, 2600, 1600, 1800, 2600],
            options: {
                titleAlign: 'center',
                fontSize: 20,
                alignByColumn: ['left', 'left', 'left', 'left', 'left', 'left'],
            },
        });
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content page-98 page-chrome page-chrome--bleed"
            aria-labelledby="electric-vehicle-charging-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-98.page-content { max-width: none !important; overflow-x: visible !important; }
.page-98 {
}
.electric-vehicle-charging-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.electric-vehicle-charging-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.electric-vehicle-charging-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.electric-vehicle-charging-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 0 0 24px 0;
    line-height: 1.45;
}
.electric-vehicle-charging-table-wrapper { display: block; width: 100%; margin-bottom: 0; }
.electric-vehicle-charging-footnotes {
    margin-top: 24px;
}
@media (max-width: 768px) {
    .electric-vehicle-charging-title { font-size: 37px; }
    .electric-vehicle-charging-intro { font-size: 18px; }
}
            `}</style>

            <div className="electric-vehicle-charging-inner">
                <h1 id="electric-vehicle-charging-title" className="electric-vehicle-charging-title">{pageTitle}</h1>

                <p className="electric-vehicle-charging-intro">
                    {getText('electric_vehicle_charging_intro_part1', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold1', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part2', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold2', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part3', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold3', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part4', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold4', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part5', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold5', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part6', lang)}
                </p>

                <div className="electric-vehicle-charging-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        onDownloadCsv={onDownloadCsv}
                        onDownloadDocx={onDownloadDocx}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                    />
                </div>

                <PageFootnotes
                    lang={lang}
                    className="electric-vehicle-charging-footnotes"
                    items={[{
                        id: 'fn-asterisk-electric-vehicle-charging',
                        marker: '*',
                        text: getText('electric_vehicle_charging_footnote', lang),
                        returnHref: '#fn-asterisk-rf-electric-vehicle-charging',
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default ElectricVehicleCharging;
