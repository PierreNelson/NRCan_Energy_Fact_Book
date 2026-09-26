/**
 * Shared CSV / DOCX table export for Fact Book chart data tables.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';

function ensureDocxFilename(filename) {
  const name = String(filename || 'table').trim() || 'table';
  return name.toLowerCase().endsWith('.docx') ? name : `${name}.docx`;
}

function ensureCsvFilename(filename) {
  const name = String(filename || 'table').trim() || 'table';
  return name.toLowerCase().endsWith('.csv') ? name : `${name}.csv`;
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function resolveAlign(align) {
  if (align === 'center' || align === AlignmentType.CENTER) return AlignmentType.CENTER;
  if (align === 'right' || align === AlignmentType.RIGHT) return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function cellParagraph(text, { bold = false, size = 22, align = 'left' } = {}) {
  return new Paragraph({
    alignment: resolveAlign(align),
    children: [
      new TextRun({
        text: String(text ?? ''),
        bold,
        size,
      }),
    ],
  });
}

function buildHeaderRow(headers, options = {}) {
  const {
    headerShading = 'E6E6E6',
    headerBold = true,
    fontSize = 22,
    alignByColumn,
  } = options;

  return new TableRow({
    children: headers.map((header, index) => {
      let align = 'left';
      if (Array.isArray(alignByColumn) && alignByColumn[index] != null) {
        align = alignByColumn[index];
      } else if (alignByColumn === 'firstLeftRestRight' && index > 0) {
        align = 'right';
      }
      return new TableCell({
        children: [cellParagraph(header, { bold: headerBold, size: fontSize, align })],
        shading: headerShading ? { fill: headerShading } : undefined,
      });
    }),
  });
}

function buildDataRows(rows, options = {}) {
  const { fontSize = 22, alignByColumn } = options;
  return (rows || []).map(
    (row) =>
      new TableRow({
        children: row.map((value, index) => {
          let align = 'left';
          if (Array.isArray(alignByColumn) && alignByColumn[index] != null) {
            align = alignByColumn[index];
          } else if (alignByColumn === 'firstLeftRestRight' && index > 0) {
            align = 'right';
          }
          const bold = Boolean(value && typeof value === 'object' && value.bold);
          const text = value && typeof value === 'object' && 'text' in value
            ? value.text
            : value;
          return new TableCell({
            children: [cellParagraph(text, { bold, size: fontSize, align })],
          });
        }),
      }),
  );
}

function equalColumnWidths(columnCount, total = 9000) {
  if (columnCount <= 0) return [];
  const base = Math.floor(total / columnCount);
  return Array.from({ length: columnCount }, () => base);
}

/**
 * Download a simple one-header-row table as .docx
 */
export async function exportTableToDocx({
  filename,
  title,
  headers = [],
  rows = [],
  columnWidths,
  options = {},
} = {}) {
  const {
    titleAlign = 'center',
    headerShading = 'E6E6E6',
    headerBold = true,
    fontSize = 22,
    titleSize = 28,
    alignByColumn,
  } = options;

  const widths = columnWidths?.length
    ? columnWidths
    : equalColumnWidths(headers.length);

  const tableRows = [
    buildHeaderRow(headers, { headerShading, headerBold, fontSize, alignByColumn }),
    ...buildDataRows(rows, { fontSize, alignByColumn }),
  ];

  const children = [];
  if (title) {
    children.push(
      new Paragraph({
        alignment: resolveAlign(titleAlign),
        spacing: { after: 300 },
        children: [new TextRun({ text: String(title), bold: true, size: titleSize })],
      }),
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: widths,
      rows: tableRows,
    }),
  );

  const doc = new Document({
    sections: [{ children }],
  });

  await saveDocxBlob(filename, doc);
}

/**
 * Download CSV (UTF-8). Values are quoted.
 */
export function exportTableToCsv({ filename, headers = [], rows = [] } = {}) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, ensureCsvFilename(filename));
}

/**
 * Escape hatch for complex documents built by the caller.
 */
export async function saveDocxBlob(filename, doc) {
  const blob = await Packer.toBlob(doc);
  saveAs(blob, ensureDocxFilename(filename));
}

export {
  buildHeaderRow,
  buildDataRows,
  cellParagraph,
  ensureDocxFilename,
  ensureCsvFilename,
  csvEscape,
  AlignmentType,
  BorderStyle,
  Document,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
};
