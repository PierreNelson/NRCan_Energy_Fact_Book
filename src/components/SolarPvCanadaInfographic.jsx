import React from 'react';
import AccessibleInfographic from './AccessibleInfographic';
import solarPvCanadaBgColumn from '../assets/solar_pv_canada_bg_column.svg?raw';
import solarPvCanadaBgColumnFr from '../assets/solar_pv_canada_bg_column_fr.svg?raw';
import solarPvCanadaBgHorizontal from '../assets/solar_pv_canada_bg_horizontal.svg?raw';
import solarPvCanadaBgHorizontalFr from '../assets/solar_pv_canada_bg_horizontal_fr.svg?raw';

const SolarPvCanadaInfographic = ({ lang, stacked, title, figureRef }) => {
    const isEn = lang === 'en';
    const svgMarkup = stacked
        ? (isEn ? solarPvCanadaBgHorizontal : solarPvCanadaBgHorizontalFr)
        : (isEn ? solarPvCanadaBgColumn : solarPvCanadaBgColumnFr);
    const layoutClass = stacked ? 'horizontal' : 'column';

    return (
        <AccessibleInfographic
            ref={figureRef}
            mode="text"
            as="figure"
            className={`solar-pv-canada-infographic-figure solar-pv-canada-infographic solar-pv-canada-infographic-${layoutClass}`}
            title={title || 'Solar PV in Canada'}
            svgMarkup={svgMarkup}
            imgClassName="solar-pv-canada-infographic-bg"
            imgStyle={{ width: '100%', height: 'auto', display: 'block' }}
            idPrefix={`solar-pv-canada-${layoutClass}-${isEn ? 'en' : 'fr'}`}
        />
    );
};

export default SolarPvCanadaInfographic;
