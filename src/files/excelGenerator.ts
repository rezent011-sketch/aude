import path from 'path';
import ExcelJS from 'exceljs';

export interface GenerateExcelOptions {
  title: string;
  headers: string[];
  rows: string[][];
  outputPath: string;
}

function normalizeSheetName(title: string): string {
  const sanitized = title.replace(/[:\\/?*\[\]]/g, ' ').trim();
  const fallback = sanitized || path.basename(title, path.extname(title)) || 'Sheet1';
  return fallback.slice(0, 31);
}

export async function generateExcel({
  title,
  headers,
  rows,
  outputPath,
}: GenerateExcelOptions): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(normalizeSheetName(title));

  worksheet.addRow(headers);

  for (const row of rows) {
    worksheet.addRow(row);
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' },
  };

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const fillColor = rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFDCE6F1';

    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillColor },
    };
  }

  const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 0);

  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    const headerValue = headers[columnIndex - 1] ?? '';
    const maxLength = rows.reduce((length, row) => {
      return Math.max(length, row[columnIndex - 1]?.length ?? 0);
    }, headerValue.length);

    worksheet.getColumn(columnIndex).width = maxLength + 2;
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}
