/**
 * Shared helper: year rows newest → oldest for chart data tables / exports.
 */
export function sortByYearDesc(rows, yearKey = 'year') {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  return [...rows].sort((a, b) => {
    const ay = Number(Array.isArray(a) ? a[0] : a?.[yearKey]);
    const by = Number(Array.isArray(b) ? b[0] : b?.[yearKey]);
    return by - ay;
  });
}
