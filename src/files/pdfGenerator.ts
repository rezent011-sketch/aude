import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export interface PdfSection {
  heading: string;
  body: string[];
}

interface GeneratePdfOptions {
  outputPath: string;
  title: string;
  subtitle?: string;
  metadata?: Array<{ label: string; value: string }>;
  sections: PdfSection[];
}

const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/Library/Fonts/Arial Unicode.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
];

function resolveFontPath(): string | null {
  for (const candidate of FONT_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function writeMetadataBlock(
  doc: PDFKit.PDFDocument,
  metadata: Array<{ label: string; value: string }>
): void {
  for (const item of metadata) {
    doc.fontSize(10).fillColor('#666666').text(item.label, { continued: true });
    doc.fontSize(10).fillColor('#111111').text(` ${item.value}`);
  }
}

export async function generatePdf({
  outputPath,
  title,
  subtitle,
  metadata = [],
  sections,
}: GeneratePdfOptions): Promise<void> {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: title,
        Author: 'Aude AI',
      },
    });
    const stream = fs.createWriteStream(outputPath);
    const fontPath = resolveFontPath();

    doc.pipe(stream);

    if (fontPath) {
      doc.font(fontPath);
    }

    doc.fontSize(20).fillColor('#111111').text(title);

    if (subtitle) {
      doc.moveDown(0.4);
      doc.fontSize(11).fillColor('#666666').text(subtitle);
    }

    if (metadata.length > 0) {
      doc.moveDown(0.8);
      writeMetadataBlock(doc, metadata);
    }

    for (const section of sections) {
      doc.moveDown(1.2);
      doc.fontSize(14).fillColor('#111111').text(section.heading);
      doc.moveDown(0.4);

      for (const block of section.body) {
        doc.fontSize(10).fillColor('#222222').text(block, {
          lineGap: 3,
        });
        doc.moveDown(0.5);
      }
    }

    doc.end();

    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.on('error', reject);
  });
}
