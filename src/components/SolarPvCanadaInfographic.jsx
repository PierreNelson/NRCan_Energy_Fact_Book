import React from 'react';
import solarPvCanadaBgColumn from '../assets/solar_pv_canada_bg_column.svg';
import solarPvCanadaBgColumnFr from '../assets/solar_pv_canada_bg_column_fr.svg';
import solarPvCanadaBgHorizontal from '../assets/solar_pv_canada_bg_horizontal.svg';
import solarPvCanadaBgHorizontalFr from '../assets/solar_pv_canada_bg_horizontal_fr.svg';

const SolarPvCanadaInfographic = ({ lang, stacked, ariaLabel, figureRef }) => {
    const isEn = lang === 'en';
    const src = stacked
        ? (isEn ? solarPvCanadaBgHorizontal : solarPvCanadaBgHorizontalFr)
        : (isEn ? solarPvCanadaBgColumn : solarPvCanadaBgColumnFr);

    return (
        <figure ref={figureRef} className="solar-pv-canada-infographic-figure" aria-label={ariaLabel}>
            <div className={`solar-pv-canada-infographic solar-pv-canada-infographic-${stacked ? 'horizontal' : 'column'}`}>
                <img
                    src={src}
                    alt=""
                    className="solar-pv-canada-infographic-bg"
                    draggable={false}
                />
            </div>
            <figcaption className="wb-inv">{ariaLabel}</figcaption>
        </figure>
    );
};

export default SolarPvCanadaInfographic;
