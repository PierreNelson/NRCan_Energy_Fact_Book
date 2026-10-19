/**
 * Parse CSV text into array of objects (shared by dataLoader and tests).
 */
function numericCell(val) {
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(val)) return val;
  const num = Number(val);
  return Number.isFinite(num) ? num : val;
}

export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((header, idx) => {
      const val = values[idx] || '';
      row[header] = numericCell(val);
    });
    data.push(row);
  }

  return data;
}
