import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import CleanPowerLowCarbonOverview from '../pages/CleanPowerLowCarbonOverview';
import CleanTechnologyEconomy from '../pages/CleanTechnologyEconomy';
import EnvironmentalCleanTech from '../pages/EnvironmentalCleanTech';
import CleantechCompaniesByRegion from '../pages/CleantechCompaniesByRegion';
import CleantechCompaniesByIndustry from '../pages/CleantechCompaniesByIndustry';
import ElectricityInternationalContext from '../pages/ElectricityInternationalContext';
import ElectricityTrade from '../pages/ElectricityTrade';
import CanadianElectricityGeneration from '../pages/CanadianElectricityGeneration';
import ProvincialElectricityGeneration from '../pages/ProvincialElectricityGeneration';
import ElectricalEnergyUse from '../pages/ElectricalEnergyUse';
import ElectricityPricesMap from '../pages/ElectricityPricesMap';
import WindSolarElectricityGrowth from '../pages/WindSolarElectricityGrowth';
import ElectricityGhgSpotlight from '../pages/ElectricityGhgSpotlight';
import RenewableEnergyInternational from '../pages/RenewableEnergyInternational';
import CanadianRenewableEnergyProduction from '../pages/CanadianRenewableEnergyProduction';
import RenewableElectricityCapacity from '../pages/RenewableElectricityCapacity';
import Hydroelectricity from '../pages/Hydroelectricity';
import HydroelectricCapacity from '../pages/HydroelectricCapacity';
import Biomass from '../pages/Biomass';
import SolidBiofuelsProduction from '../pages/SolidBiofuelsProduction';
import WorldWindPower from '../pages/WorldWindPower';
import CanadianWindPower from '../pages/CanadianWindPower';
import WindProjectsMap from '../pages/WindProjectsMap';
import WorldSolarPower from '../pages/WorldSolarPower';
import SolarPvInCanada from '../pages/SolarPvInCanada';
import LargestSolarProjects from '../pages/LargestSolarProjects';
import UraniumInternational from '../pages/UraniumInternational';
import NuclearPower from '../pages/NuclearPower';
import CanadianUraniumSupplyDemand from '../pages/CanadianUraniumSupplyDemand';
import NuclearFuelCycle from '../pages/NuclearFuelCycle';
import CanduNuclearReactors from '../pages/CanduNuclearReactors';
import NuclearPowerPlantsUraniumPrices from '../pages/NuclearPowerPlantsUraniumPrices';
import BiofuelsTransportation from '../pages/BiofuelsTransportation';
import WorldBiofuelsProduction from '../pages/WorldBiofuelsProduction';
import CanadianBiofuelProduction from '../pages/CanadianBiofuelProduction';
import BiofuelProductionCapacity from '../pages/BiofuelProductionCapacity';
import TransportationFuelMix from '../pages/TransportationFuelMix';
import EvSalesRegistrations from '../pages/EvSalesRegistrations';
import TransportationGhgSpotlight from '../pages/TransportationGhgSpotlight';
import ElectricVehicleCharging from '../pages/ElectricVehicleCharging';
import PublicEvChargingStations from '../pages/PublicEvChargingStations';
import Hydrogen from '../pages/Hydrogen';
import GlobalHydrogenProductionDemand from '../pages/GlobalHydrogenProductionDemand';
import HydrogenIndustry from '../pages/HydrogenIndustry';

const SectionFive = () => {
    const location = useLocation();

    useEffect(() => {
        if (!location.hash) {
            window.scrollTo(0, 0);
            return undefined;
        }

        const id = location.hash.replace('#', '');
        let attempts = 0;
        let timerId = null;

        const scrollToTarget = () => {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            if (attempts < 30) {
                attempts += 1;
                timerId = window.setTimeout(scrollToTarget, 150);
            }
        };

        timerId = window.setTimeout(scrollToTarget, 100);
        return () => {
            if (timerId) window.clearTimeout(timerId);
        };
    }, [location.pathname, location.hash]);

    return (
        <div className="section-five-container stacked-section-container">
            <div id="clean-power-low-carbon-overview" className="stacked-page-wrapper">
                <CleanPowerLowCarbonOverview />
            </div>
            <div id="clean-technology-economy" className="stacked-page-wrapper">
                <CleanTechnologyEconomy />
            </div>
            <div id="environmental-clean-technology" className="stacked-page-wrapper">
                <EnvironmentalCleanTech />
            </div>
            <div id="cleantech-companies" className="stacked-page-wrapper">
                <CleantechCompaniesByRegion />
            </div>
            <div id="cleantech-companies-industry" className="stacked-page-wrapper">
                <CleantechCompaniesByIndustry />
            </div>
            <div id="electricity-international-context" className="stacked-page-wrapper">
                <ElectricityInternationalContext />
            </div>
            <div id="electricity-trade-us" className="stacked-page-wrapper">
                <ElectricityTrade />
            </div>
            <div id="canadian-electricity-generation" className="stacked-page-wrapper">
                <CanadianElectricityGeneration />
            </div>
            <div id="provincial-electricity-generation" className="stacked-page-wrapper">
                <ProvincialElectricityGeneration />
            </div>
            <div id="electricity-energy-use" className="stacked-page-wrapper">
                <ElectricalEnergyUse />
            </div>
            <div id="electricity-prices" className="stacked-page-wrapper page-with-title-divider">
                <ElectricityPricesMap />
            </div>
            <div id="wind-solar-electricity-growth" className="stacked-page-wrapper">
                <WindSolarElectricityGrowth />
            </div>
            <div id="electricity-ghg-spotlight" className="stacked-page-wrapper">
                <ElectricityGhgSpotlight />
            </div>
            <div id="renewable-energy-international" className="stacked-page-wrapper page-with-title-divider">
                <RenewableEnergyInternational />
            </div>
            <div id="canadian-renewable-energy-production" className="stacked-page-wrapper page-with-title-divider">
                <CanadianRenewableEnergyProduction />
            </div>
            <div id="renewable-electricity-capacity" className="stacked-page-wrapper page-with-title-divider">
                <RenewableElectricityCapacity />
            </div>
            <div id="hydroelectricity" className="stacked-page-wrapper page-with-title-divider">
                <Hydroelectricity />
            </div>
            <div id="major-hydro-facilities" className="stacked-page-wrapper page-with-title-divider">
                <HydroelectricCapacity />
            </div>
            <div id="biomass" className="stacked-page-wrapper">
                <Biomass />
            </div>
            <div id="solid-biofuels" className="stacked-page-wrapper">
                <SolidBiofuelsProduction />
            </div>
            <div id="world-wind-power" className="stacked-page-wrapper">
                <WorldWindPower />
            </div>
            <div id="wind-power-canada" className="stacked-page-wrapper">
                <CanadianWindPower />
            </div>
            <div id="wind-capacity" className="stacked-page-wrapper">
                <WindProjectsMap />
            </div>
            <div id="world-solar-pv" className="stacked-page-wrapper">
                <WorldSolarPower />
            </div>
            <div id="solar-pv-canada" className="stacked-page-wrapper">
                <SolarPvInCanada />
            </div>
            <div id="largest-solar-projects" className="stacked-page-wrapper">
                <LargestSolarProjects />
            </div>
            <div id="uranium-international" className="stacked-page-wrapper">
                <UraniumInternational />
            </div>
            <div id="nuclear-power" className="stacked-page-wrapper">
                <NuclearPower />
            </div>
            <div id="canadian-uranium-supply-demand" className="stacked-page-wrapper">
                <CanadianUraniumSupplyDemand />
            </div>
            <div id="nuclear-fuel-cycle" className="stacked-page-wrapper">
                <NuclearFuelCycle />
            </div>
            <div id="candu-nuclear-reactors" className="stacked-page-wrapper">
                <CanduNuclearReactors />
            </div>
            <div id="nuclear-power-plants-uranium-prices" className="stacked-page-wrapper">
                <NuclearPowerPlantsUraniumPrices />
            </div>
            <div id="biofuels-transportation" className="stacked-page-wrapper page-with-title-divider">
                <BiofuelsTransportation />
            </div>
            <div id="world-biofuels-production" className="stacked-page-wrapper">
                <WorldBiofuelsProduction />
            </div>
            <div id="canadian-biofuel-production" className="stacked-page-wrapper">
                <CanadianBiofuelProduction />
            </div>
            <div id="biofuel-production-capacity" className="stacked-page-wrapper">
                <BiofuelProductionCapacity />
            </div>
            <div id="transportation-fuel-mix" className="stacked-page-wrapper">
                <TransportationFuelMix />
            </div>
            <div id="ev-sales" className="stacked-page-wrapper">
                <EvSalesRegistrations />
            </div>
            <div id="transportation-ghg-spotlight" className="stacked-page-wrapper">
                <TransportationGhgSpotlight />
            </div>
            <div id="electric-vehicle-charging" className="stacked-page-wrapper">
                <ElectricVehicleCharging />
            </div>
            <div id="public-ev-charging-stations" className="stacked-page-wrapper">
                <PublicEvChargingStations />
            </div>
            <div id="hydrogen" className="stacked-page-wrapper">
                <Hydrogen />
            </div>
            <div id="global-hydrogen-production-demand" className="stacked-page-wrapper">
                <GlobalHydrogenProductionDemand />
            </div>
            <div id="hydrogen-industry" className="stacked-page-wrapper">
                <HydrogenIndustry />
            </div>
        </div>
    );
};

export default SectionFive;
