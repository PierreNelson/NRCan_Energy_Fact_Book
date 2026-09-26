import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('docx', async () => {
  const actual = await vi.importActual('docx');
  return {
    ...actual,
    Packer: {
      toBlob: vi.fn(async () => new Blob(['docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })),
    },
  };
});

import { saveAs } from 'file-saver';
import { Packer } from 'docx';
import {
  exportTableToCsv,
  exportTableToDocx,
  saveDocxBlob,
  ensureDocxFilename,
  ensureCsvFilename,
  Document,
  Paragraph,
  TextRun,
} from './exportTableToDocx.js';

describe('exportTableToDocx helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes filenames', () => {
    expect(ensureDocxFilename('foo')).toBe('foo.docx');
    expect(ensureDocxFilename('foo.docx')).toBe('foo.docx');
    expect(ensureCsvFilename('bar')).toBe('bar.csv');
  });

  it('exports CSV with quoting', () => {
    exportTableToCsv({
      filename: 'sample',
      headers: ['A', 'B'],
      rows: [['1', 'x,y'], ['2', 'ok']],
    });
    expect(saveAs).toHaveBeenCalledTimes(1);
    const [blob, name] = saveAs.mock.calls[0];
    expect(name).toBe('sample.csv');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('exports a simple DOCX table', async () => {
    await exportTableToDocx({
      filename: 'wages',
      title: 'Wages',
      headers: ['Indicator', 'Value'],
      rows: [['Avg', '100']],
      columnWidths: [5200, 3600],
      options: { titleAlign: 'left', fontSize: 18 },
    });
    expect(Packer.toBlob).toHaveBeenCalled();
    expect(saveAs).toHaveBeenCalled();
    expect(saveAs.mock.calls[0][1]).toBe('wages.docx');
  });

  it('saveDocxBlob writes custom documents', async () => {
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun('x')] })] }],
    });
    await saveDocxBlob('custom.docx', doc);
    expect(Packer.toBlob).toHaveBeenCalled();
    expect(saveAs.mock.calls[0][1]).toBe('custom.docx');
  });
});
