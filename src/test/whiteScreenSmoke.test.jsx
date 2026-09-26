import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../components/Layout';
import PrimaryEnergyProduction from '../pages/PrimaryEnergyProduction';
import CanadaGlobalEnergyTrade from '../pages/CanadaGlobalEnergyTrade';
import CanadaEnergySupply from '../pages/CanadaEnergySupply';
import CanadianSupplyDemand from '../pages/CanadianSupplyDemand';
import RppSupplyDemand from '../pages/RppSupplyDemand';
import Biomass from '../pages/Biomass';
import WorldSolarPower from '../pages/WorldSolarPower';
import OilGasGhgSpotlight from '../pages/OilGasGhgSpotlight';
import PublicEvChargingStations from '../pages/PublicEvChargingStations';

beforeAll(() => {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => 'blob:mock';
  }
});

function renderPage(Page) {
  return render(
    <MemoryRouter initialEntries={['/section-1']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/section-1" element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('white-screen smoke (migrated pages)', () => {
  for (const [name, Page] of [
    ['PrimaryEnergyProduction', PrimaryEnergyProduction],
    ['CanadaGlobalEnergyTrade', CanadaGlobalEnergyTrade],
    ['CanadaEnergySupply', CanadaEnergySupply],
    ['CanadianSupplyDemand', CanadianSupplyDemand],
    ['RppSupplyDemand', RppSupplyDemand],
    ['Biomass', Biomass],
    ['WorldSolarPower', WorldSolarPower],
    ['OilGasGhgSpotlight', OilGasGhgSpotlight],
    ['PublicEvChargingStations', PublicEvChargingStations],
  ]) {
    it(`renders ${name} without throwing`, () => {
      expect(() => renderPage(Page)).not.toThrow();
    });
  }
});
