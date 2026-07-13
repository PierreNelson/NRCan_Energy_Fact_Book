/** Hardcoded nuclear fuel cycle map sites by legend category (Energy Fact Book p.88). */

export const CATEGORY_ORDER = [
    'mining_milling',
    'processing',
    'generation_science',
    'waste',
    'shutdown',
    'inactive_mines',
];

/**
 * One row per site–category pairing shown on the map (and Quebec City–Windsor inset).
 * Sites with multiple legend symbols appear once per category.
 */
export const TABLE_ROWS = [
    // Uranium Mining & Milling
    { id: 'mining-mcclean', categoryKey: 'mining_milling', siteKey: 'mcclean_lake', locationKey: 'saskatchewan' },
    { id: 'mining-rabbit', categoryKey: 'mining_milling', siteKey: 'rabbit_lake', locationKey: 'saskatchewan' },
    { id: 'mining-cigar', categoryKey: 'mining_milling', siteKey: 'cigar_lake', locationKey: 'saskatchewan' },
    { id: 'mining-mcarthur', categoryKey: 'mining_milling', siteKey: 'mcarthur_river', locationKey: 'saskatchewan' },
    { id: 'mining-key', categoryKey: 'mining_milling', siteKey: 'key_lake', locationKey: 'saskatchewan' },

    // Uranium Processing – Refining, Conversion, and Fuel Fabrication
    { id: 'proc-blind', categoryKey: 'processing', siteKey: 'blind_river', locationKey: 'ontario' },
    { id: 'proc-porthope', categoryKey: 'processing', siteKey: 'port_hope', locationKey: 'ontario' },
    { id: 'proc-toronto', categoryKey: 'processing', siteKey: 'toronto', locationKey: 'ontario' },
    { id: 'proc-coburg', categoryKey: 'processing', siteKey: 'coburg', locationKey: 'ontario' },
    { id: 'proc-peterborough', categoryKey: 'processing', siteKey: 'peterborough', locationKey: 'ontario' },

    // Nuclear Power Generation and Nuclear Science & Technology
    { id: 'gen-bruce', categoryKey: 'generation_science', siteKey: 'bruce', locationKey: 'ontario' },
    { id: 'gen-darlington', categoryKey: 'generation_science', siteKey: 'darlington', locationKey: 'ontario' },
    { id: 'gen-pickering', categoryKey: 'generation_science', siteKey: 'pickering', locationKey: 'ontario' },
    { id: 'gen-lepreau', categoryKey: 'generation_science', siteKey: 'point_lepreau', locationKey: 'new_brunswick' },
    { id: 'sci-chalk', categoryKey: 'generation_science', siteKey: 'chalk_river', locationKey: 'ontario' },
    { id: 'sci-triumf', categoryKey: 'generation_science', siteKey: 'triumf', locationKey: 'british_columbia' },
    { id: 'sci-usask', categoryKey: 'generation_science', siteKey: 'university_of_saskatchewan', locationKey: 'saskatchewan' },
    { id: 'sci-src', categoryKey: 'generation_science', siteKey: 'saskatchewan_research_council', locationKey: 'saskatchewan' },
    { id: 'sci-mcmaster', categoryKey: 'generation_science', siteKey: 'mcmaster_university', locationKey: 'ontario' },
    { id: 'sci-canmet', categoryKey: 'generation_science', siteKey: 'canmet_materials', locationKey: 'ontario' },
    { id: 'sci-rmc', categoryKey: 'generation_science', siteKey: 'royal_military_college', locationKey: 'ontario' },
    { id: 'sci-poly', categoryKey: 'generation_science', siteKey: 'ecole_polytechnique', locationKey: 'quebec' },

    // Waste Management & Long-term Management
    { id: 'waste-mcclean', categoryKey: 'waste', siteKey: 'mcclean_lake', locationKey: 'saskatchewan' },
    { id: 'waste-whiteshell', categoryKey: 'waste', siteKey: 'whiteshell_laboratories', locationKey: 'manitoba' },
    { id: 'waste-western', categoryKey: 'waste', siteKey: 'western_waste_management', locationKey: 'ontario' },
    { id: 'waste-porthope', categoryKey: 'waste', siteKey: 'port_hope_port_granby', locationKey: 'ontario' },
    { id: 'waste-lepreau', categoryKey: 'waste', siteKey: 'point_lepreau', locationKey: 'new_brunswick' },

    // Shutdown or Decommissioned Sites
    { id: 'shut-whiteshell', categoryKey: 'shutdown', siteKey: 'whiteshell_laboratories', locationKey: 'manitoba' },
    { id: 'shut-douglas', categoryKey: 'shutdown', siteKey: 'douglas_point', locationKey: 'ontario' },
    { id: 'shut-rolphton', categoryKey: 'shutdown', siteKey: 'rolphton_npd', locationKey: 'ontario' },
    { id: 'shut-gentilly', categoryKey: 'shutdown', siteKey: 'gentilly', locationKey: 'quebec' },

    // Inactive or Decommissioned Uranium Mines and Tailings Sites
    { id: 'inactive-radium', categoryKey: 'inactive_mines', siteKey: 'port_radium', locationKey: 'northwest_territories' },
    { id: 'inactive-rayrock', categoryKey: 'inactive_mines', siteKey: 'rayrock', locationKey: 'northwest_territories' },
    { id: 'inactive-beaverlodge', categoryKey: 'inactive_mines', siteKey: 'beaverlodge_gunnar_lorado', locationKey: 'saskatchewan' },
    { id: 'inactive-cluff', categoryKey: 'inactive_mines', siteKey: 'cluff_lake', locationKey: 'saskatchewan' },
    { id: 'inactive-elliot', categoryKey: 'inactive_mines', siteKey: 'elliot_lake_area', locationKey: 'ontario' },
    { id: 'inactive-agnew', categoryKey: 'inactive_mines', siteKey: 'agnew_lake', locationKey: 'ontario' },
    { id: 'inactive-deloro', categoryKey: 'inactive_mines', siteKey: 'deloro', locationKey: 'ontario' },
];
