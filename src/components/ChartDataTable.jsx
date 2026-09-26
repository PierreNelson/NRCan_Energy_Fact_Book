import React, { useEffect, useRef, useState } from 'react';
import { exportTableToCsv, exportTableToDocx } from '../utils/exportTableToDocx';

function syncScroll(a, b) {
  if (!a || !b) return () => {};
  let lock = false;
  const onA = () => {
    if (lock) return;
    lock = true;
    b.scrollLeft = a.scrollLeft;
    lock = false;
  };
  const onB = () => {
    if (lock) return;
    lock = true;
    a.scrollLeft = b.scrollLeft;
    lock = false;
  };
  a.addEventListener('scroll', onA);
  b.addEventListener('scroll', onB);
  return () => {
    a.removeEventListener('scroll', onA);
    b.removeEventListener('scroll', onB);
  };
}

/**
 * Shared chart data-table disclosure with CSV/DOCX downloads and dual scrollbars.
 *
 * Data mode: pass `columns` + `rows` (optional `docx` / `csvFilename`).
 * Escape hatch: pass `children` (typically a `<table>`) plus optional
 * `onDownloadCsv` / `onDownloadDocx` for page-specific exporters.
 */
export default function ChartDataTable({
  lang = 'en',
  label,
  columns = [],
  rows = [],
  docx,
  csvFilename,
  className = '',
  defaultOpen = false,
  renderCell,
  children = null,
  onDownloadCsv: onDownloadCsvProp,
  onDownloadDocx: onDownloadDocxProp,
  tableAriaLabel,
  caption,
  hideDownloads = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const topScrollRef = useRef(null);
  const tableScrollRef = useRef(null);
  const spacerRef = useRef(null);

  const summaryLabel =
    label
    || (lang === 'fr' ? 'Tableau de données du graphique' : 'Chart data table');

  const headers = columns.map((c) => (typeof c === 'string' ? c : c.header));
  const keys = columns.map((c, i) => (typeof c === 'string' ? String(i) : (c.key ?? i)));

  // Newest year first for data-mode tables (column "year" or first numeric year-like values).
  const displayRows = (() => {
    if (!rows?.length || children) return rows;
    const yearKey = keys.find((k) => String(k).toLowerCase() === 'year');
    const sample = Array.isArray(rows[0])
      ? rows[0][0]
      : (yearKey != null ? rows[0]?.[yearKey] : rows[0]?.year);
    const yearNum = Number(sample);
    if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > 2100) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const ay = Number(Array.isArray(a) ? a[0] : (yearKey != null ? a?.[yearKey] : a?.year));
      const by = Number(Array.isArray(b) ? b[0] : (yearKey != null ? b?.[yearKey] : b?.year));
      return by - ay;
    });
    return copy;
  })();

  const displayStringRows = (displayRows || []).map((row) => {
    if (Array.isArray(row)) return row.map((v) => String(v ?? ''));
    return keys.map((key) => String(row?.[key] ?? ''));
  });

  useEffect(() => {
    const top = topScrollRef.current;
    const table = tableScrollRef.current;
    const spacer = spacerRef.current;
    if (!top || !table || !spacer) return undefined;

    const syncWidth = () => {
      spacer.style.width = `${table.scrollWidth}px`;
    };
    syncWidth();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncWidth)
      : null;
    ro?.observe(table);
    const stop = syncScroll(top, table);
    return () => {
      ro?.disconnect();
      stop();
    };
  }, [open, displayRows, columns, children]);

  const onDownloadCsv = () => {
    if (typeof onDownloadCsvProp === 'function') {
      onDownloadCsvProp();
      return;
    }
    if (!headers.length) return;
    exportTableToCsv({
      filename: csvFilename || docx?.filename || 'chart-data',
      headers,
      rows: displayStringRows,
    });
  };

  const onDownloadDocx = async () => {
    if (typeof onDownloadDocxProp === 'function') {
      await onDownloadDocxProp();
      return;
    }
    if (!headers.length) return;
    await exportTableToDocx({
      filename: docx?.filename || csvFilename || 'chart-data',
      title: docx?.title || summaryLabel,
      headers,
      rows: displayStringRows,
      columnWidths: docx?.columnWidths,
      options: {
        titleAlign: docx?.titleAlign || 'left',
        fontSize: docx?.fontSize || 20,
        alignByColumn: docx?.alignByColumn || 'firstLeftRestRight',
        ...docx?.options,
      },
    });
  };

  const showDownloads = !hideDownloads && (
    typeof onDownloadCsvProp === 'function'
    || typeof onDownloadDocxProp === 'function'
    || headers.length > 0
  );

  return (
    <details
      className={`data-table-wrapper chart-data-table-root ${className}`.trim()}
      open={open || undefined}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <style>{`
        /* Self-contained: do not rely on page-local or .page-chrome-only rules */
        .chart-data-table-root.data-table-wrapper {
          padding-top: 5px;
          margin-top: 20px;
          margin-bottom: 0;
          width: 100%;
          box-sizing: border-box;
        }
        .chart-data-table-root > summary {
          cursor: pointer;
          font-family: Arial, sans-serif;
          font-size: 16px;
          font-weight: bold;
          padding: 10px 12px;
          background-color: #8C8C8C;
          border: 1px solid #404040;
          border-radius: 4px;
          list-style: none;
          list-style-type: none;
          box-sizing: border-box;
          width: 100%;
          color: #ffffff;
          display: flex;
          align-items: center;
          text-align: left;
        }
        .chart-data-table-root > summary::-webkit-details-marker,
        .chart-data-table-root > summary::marker {
          display: none;
          content: none;
        }
        .chart-data-table-root > summary:hover {
          background-color: #404040;
        }
        .chart-data-table-root > summary:focus {
          outline: 2px solid #005fcc;
          outline-offset: 2px;
        }
        .chart-data-table-root .chart-summary-chevron {
          display: inline-block;
          width: 0;
          height: 0;
          margin-right: 8px;
          vertical-align: middle;
          border-style: solid;
          border-color: transparent;
          border-width: 5px 0 5px 7px;
          border-left-color: currentColor;
          flex-shrink: 0;
        }
        .chart-data-table-root[open] > summary .chart-summary-chevron {
          border-width: 7px 5px 0 5px;
          border-color: currentColor transparent transparent transparent;
        }
        .chart-data-table-root .table-scroll-top {
          overflow-x: auto;
          overflow-y: hidden;
          height: 16px;
          margin-bottom: 4px;
        }
        .chart-data-table-root .table-scroll-top-spacer {
          height: 1px;
        }
        .chart-data-table-root .table-responsive {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .chart-data-table-root .chart-data-table {
          width: 100%;
          border-collapse: collapse;
          font-family: Arial, sans-serif;
          font-size: 14px;
        }
        .chart-data-table-root .chart-data-table th,
        .chart-data-table-root .chart-data-table td {
          border: 1px solid #ccc;
          padding: 8px 10px;
          text-align: left;
        }
        .chart-data-table-root .chart-data-table th {
          background-color: #e6e6e6;
          font-weight: bold;
        }
        .chart-data-table-root .chart-data-table td.num,
        .chart-data-table-root .chart-data-table th.num {
          text-align: right;
        }
        .chart-data-table-root .chart-data-table-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }
        .chart-data-table-root .download-table-btn {
          font-family: Arial, sans-serif;
          font-weight: bold;
          padding: 8px 16px;
          background-color: #8C8C8C;
          border: 1px solid #404040;
          border-radius: 4px;
          color: #ffffff;
          cursor: pointer;
        }
        .chart-data-table-root .download-table-btn:hover {
          background-color: #404040;
        }
      `}</style>
      <summary role="button" aria-expanded={open}>
        <span className="chart-summary-chevron" aria-hidden="true" />
        {summaryLabel}
        <span className="wb-inv">
          {lang === 'fr' ? ' Appuyez sur Entrée pour ouvrir ou fermer.' : ' Press Enter to open or close.'}
        </span>
      </summary>

      <div ref={topScrollRef} className="table-scroll-top" aria-hidden="true">
        <div ref={spacerRef} className="table-scroll-top-spacer" />
      </div>

      <div
        ref={tableScrollRef}
        className="table-responsive"
        aria-label={tableAriaLabel}
      >
        {children || (
          <table className="chart-data-table table table-striped table-hover">
            {caption ? <caption className="wb-inv">{caption}</caption> : null}
            <thead>
              <tr>
                {columns.map((col, i) => {
                  const header = typeof col === 'string' ? col : col.header;
                  const align = typeof col === 'string' ? 'left' : col.align;
                  return (
                    <th key={keys[i]} className={align === 'right' || align === 'num' ? 'num' : undefined} scope="col">
                      {header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {keys.map((key, colIndex) => {
                    const col = columns[colIndex];
                    const align = typeof col === 'string' ? (colIndex === 0 ? 'left' : 'right') : (col.align || (colIndex === 0 ? 'left' : 'right'));
                    const raw = Array.isArray(row) ? row[colIndex] : row?.[key];
                    const content = typeof renderCell === 'function'
                      ? renderCell(raw, { row, rowIndex, column: col, colIndex })
                      : String(raw ?? '');
                    const Tag = colIndex === 0 ? 'th' : 'td';
                    return (
                      <Tag
                        key={`${rowIndex}-${key}`}
                        className={align === 'right' || align === 'num' ? 'num' : undefined}
                        scope={colIndex === 0 ? 'row' : undefined}
                      >
                        {content}
                      </Tag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDownloads ? (
        <div className="chart-data-table-toolbar">
          <button type="button" className="download-table-btn" onClick={onDownloadCsv}>
            {lang === 'fr' ? 'Télécharger les données (CSV)' : 'Download data (CSV)'}
          </button>
          <button type="button" className="download-table-btn" onClick={onDownloadDocx}>
            {lang === 'fr' ? 'Télécharger le tableau (DOCX)' : 'Download table (DOCX)'}
          </button>
        </div>
      ) : null}
    </details>
  );
}
