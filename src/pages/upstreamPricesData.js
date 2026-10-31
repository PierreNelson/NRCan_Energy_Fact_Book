/**
 * Hardcoded stand-in for page 129 until a price source is connected.
 * The page reads years from these rows. Replacing the rows with a pipeline
 * series extends the chart, the chart title, and the AECO list through the
 * newest year. AECO annual averages match the printed factbook. Monthly paths
 * are shaped to the printed chart, including the three annotated spikes, then
 * each AECO year (and the 2009–2016 block) is scaled to the printed average.
 */

const START_YEAR = 2008;
const END_YEAR = 2025;

const AECO_BLOCK_AVERAGE = 3.38;
const AECO_YEAR_AVERAGES = {
    2017: 2.2,
    2018: 1.53,
    2019: 1.8,
    2020: 2.24,
    2021: 3.64,
    2022: 5.43,
    2023: 2.64,
    2024: 1.39,
    2025: 1.69,
};

const monthIndex = (year, month) => (year - START_YEAR) * 12 + (month - 1);

const MONTHS = [];
for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
        MONTHS.push({ year, month, t: monthIndex(year, month) });
    }
}

const parseKeys = (pairs) => pairs.map(([stamp, value]) => {
    const [year, month] = stamp.split('-').map(Number);
    return { t: monthIndex(year, month), value };
});

const interpolate = (pairs) => {
    const points = parseKeys(pairs);
    return MONTHS.map(({ t }) => {
        if (t <= points[0].t) return points[0].value;
        if (t >= points[points.length - 1].t) return points[points.length - 1].value;
        let index = 0;
        while (points[index + 1].t < t) index += 1;
        const left = points[index];
        const right = points[index + 1];
        const mix = (t - left.t) / (right.t - left.t);
        return left.value + (right.value - left.value) * mix;
    });
};

const wiggle = (t, amount) => (
    amount * Math.sin(t * 1.7)
    + amount * 0.4 * Math.sin(t * 0.55 + 1.1)
);

const round2 = (value) => Math.round(value * 100) / 100;

const forceAverage = (values, indexes, target) => {
    const count = indexes.length;
    const mean = indexes.reduce((sum, index) => sum + values[index], 0) / count;
    const factor = target / mean;
    indexes.forEach((index) => {
        values[index] *= factor;
    });
    let roundedSum = 0;
    indexes.slice(0, -1).forEach((index) => {
        values[index] = round2(values[index]);
        roundedSum += values[index];
    });
    values[indexes[count - 1]] = round2(target * count - roundedSum);
};

const withWiggle = (pairs, amount) => interpolate(pairs).map((value, index) => value + wiggle(index, amount));

const henry = withWiggle([
    ['2008-01', 7.2],
    ['2008-06', 13.4],
    ['2008-12', 5.6],
    ['2009-04', 3.6],
    ['2009-12', 5.2],
    ['2010-06', 4.4],
    ['2011-01', 4.6],
    ['2011-08', 3.9],
    ['2012-04', 2.1],
    ['2012-12', 3.4],
    ['2013-06', 3.8],
    ['2014-02', 6.2],
    ['2014-08', 3.8],
    ['2015-03', 2.7],
    ['2016-03', 1.8],
    ['2016-12', 3.4],
    ['2017-06', 2.9],
    ['2018-01', 3.6],
    ['2018-11', 4.2],
    ['2019-06', 2.3],
    ['2020-06', 1.7],
    ['2020-12', 2.6],
    ['2021-06', 3.4],
    ['2021-10', 5.4],
    ['2022-06', 8.2],
    ['2022-09', 7.6],
    ['2023-02', 2.4],
    ['2023-11', 2.8],
    ['2024-03', 1.7],
    ['2024-12', 3.1],
    ['2025-03', 4.2],
    ['2025-08', 2.9],
    ['2025-12', 4.6],
], 0.28);

const dawn = withWiggle([
    ['2008-01', 7.6],
    ['2008-06', 14.6],
    ['2008-12', 6.4],
    ['2009-05', 3.8],
    ['2009-12', 5.4],
    ['2010-07', 4.6],
    ['2011-02', 4.8],
    ['2012-04', 2.4],
    ['2012-12', 3.6],
    ['2013-11', 4.2],
    ['2014-01', 8.5],
    ['2014-02', 20.4],
    ['2014-03', 11.5],
    ['2014-07', 4.2],
    ['2015-04', 2.6],
    ['2016-04', 1.7],
    ['2016-12', 3.5],
    ['2017-08', 2.8],
    ['2018-01', 4.8],
    ['2019-02', 3.1],
    ['2020-05', 1.5],
    ['2020-12', 2.5],
    ['2021-06', 3.3],
    ['2021-11', 5.2],
    ['2022-05', 7.4],
    ['2022-08', 11.2],
    ['2023-01', 3.2],
    ['2023-08', 2.4],
    ['2024-02', 2.2],
    ['2024-11', 3.0],
    ['2025-02', 4.8],
    ['2025-07', 2.8],
    ['2025-12', 5.6],
], 0.28);

const aeco = withWiggle([
    ['2008-01', 6.4],
    ['2008-06', 12.2],
    ['2008-12', 5.8],
    ['2009-06', 3.2],
    ['2010-01', 4.8],
    ['2010-08', 3.4],
    ['2011-06', 3.6],
    ['2012-05', 1.8],
    ['2012-12', 3.0],
    ['2013-06', 3.2],
    ['2014-02', 7.4],
    ['2014-09', 3.6],
    ['2015-06', 2.5],
    ['2016-05', 1.3],
    ['2016-12', 3.1],
    ['2017-04', 2.5],
    ['2017-10', 1.7],
    ['2018-02', 1.7],
    ['2018-09', 1.2],
    ['2019-02', 1.6],
    ['2019-08', 1.1],
    ['2019-12', 2.2],
    ['2020-06', 1.8],
    ['2020-11', 2.6],
    ['2021-06', 3.2],
    ['2021-11', 4.6],
    ['2022-05', 6.8],
    ['2022-10', 4.8],
    ['2023-03', 2.8],
    ['2023-09', 2.3],
    ['2024-02', 1.6],
    ['2024-08', 0.7],
    ['2024-12', 1.5],
    ['2025-03', 1.9],
    ['2025-08', 0.9],
    ['2025-12', 2.2],
], 0.18);

const aecoIndexes = (predicate) => MONTHS
    .map((row, index) => (predicate(row) ? index : -1))
    .filter((index) => index >= 0);

forceAverage(
    aeco,
    aecoIndexes((row) => row.year >= 2009 && row.year <= 2016),
    AECO_BLOCK_AVERAGE,
);
Object.entries(AECO_YEAR_AVERAGES).forEach(([year, average]) => {
    forceAverage(aeco, aecoIndexes((row) => row.year === Number(year)), average);
});

const clamp = (value) => round2(Math.max(value, 0.4));

export const UPSTREAM_PRICE_ROWS = MONTHS.map((row, index) => ({
    year: row.year,
    month: row.month,
    henry: clamp(henry[index]),
    dawn: clamp(dawn[index]),
    aeco: round2(aeco[index]),
}));

const BLOCK_START = 2009;
const BLOCK_END = 2016;

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Years shown on the page come from the monthly rows. The factbook groups
 * 2009–2016 into one average; every later year in the series gets its own row.
 * A pipeline refresh that appends a year extends the chart, title, and list.
 */
export const summarizeUpstreamPrices = (rows) => {
    const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
    const startYear = years[0];
    const endYear = years[years.length - 1];
    const valuesFor = (year) => rows.filter((row) => row.year === year).map((row) => row.aeco);
    const blockYears = years.filter((year) => year >= BLOCK_START && year <= BLOCK_END);
    const aecoAverages = [];
    if (blockYears.length) {
        const blockValues = blockYears.flatMap(valuesFor);
        aecoAverages.push({
            id: `${blockYears[0]}-${blockYears[blockYears.length - 1]}`,
            startYear: blockYears[0],
            endYear: blockYears[blockYears.length - 1],
            value: round2(mean(blockValues)),
        });
    }
    years.filter((year) => year > BLOCK_END).forEach((year) => {
        aecoAverages.push({
            id: String(year),
            startYear: year,
            endYear: year,
            value: round2(mean(valuesFor(year))),
        });
    });
    return { startYear, endYear, aecoAverages };
};
