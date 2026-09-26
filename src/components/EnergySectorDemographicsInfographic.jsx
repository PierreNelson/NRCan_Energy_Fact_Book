import React from 'react';
import AccessibleInfographic from './AccessibleInfographic';
import energySectorDemographicsBgEn from '../assets/energy_sector_demographics_bg.svg';
import energySectorDemographicsBgFr from '../assets/energy_sector_demographics_bg_fr.svg';

const EnergySectorDemographicsInfographic = ({ figureRef, ariaLabel, lang }) => {
    const src = lang === 'fr' ? energySectorDemographicsBgFr : energySectorDemographicsBgEn;

    return (
        <AccessibleInfographic
            ref={figureRef}
            as="figure"
            mode="image"
            className="energy-sector-demographics-infographic-figure"
            title={ariaLabel}
            overview={ariaLabel}
            src={src}
            imgClassName="energy-sector-demographics-bg"
        >
            <style>{`
.energy-sector-demographics-infographic-figure {
    position: relative;
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
}
.energy-sector-demographics-bg {
    width: 100%;
    height: auto;
    display: block;
    user-select: none;
    pointer-events: none;
}
            `}</style>
        </AccessibleInfographic>
    );
};

export default EnergySectorDemographicsInfographic;
