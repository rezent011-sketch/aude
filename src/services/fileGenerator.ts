import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import pptxgen from 'pptxgenjs';
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

export interface GeneratedDiscordFile {
  filePath: string;
  fileName: string;
}

export interface PptxSlideInput {
  title?: string;
  content?: string;
  bullets?: string[];
}

async function ensureOutputDirectory(outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
}

function splitContentLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function generatePDF(
  title: string,
  content: string,
  outputPath: string
): Promise<string> {
  await ensureOutputDirectory(outputPath);

  await new Promise<void>((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: title,
        Author: 'Aude AI',
      },
    });

    const stream = document.pipe(createWriteStream(outputPath));

    stream.on('finish', resolve);
    stream.on('error', reject);
    document.on('error', reject);

    document.fontSize(22).text(title, {
      align: 'left',
    });
    document.moveDown();

    for (const line of content.split(/\r?\n/)) {
      document.fontSize(12).text(line.length > 0 ? line : ' ', {
        lineGap: 4,
      });
    }

    document.end();
  });

  return outputPath;
}

export async function generateExcel(
  data: any[],
  sheetName: string,
  outputPath: string
): Promise<string> {
  await ensureOutputDirectory(outputPath);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(
    sheetName.trim().slice(0, 31) || 'Sheet1'
  );

  if (data.length === 0) {
    worksheet.addRow(['Content']);
  } else {
    const headerSet = new Set<string>();
    for (const item of data) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const key of Object.keys(item)) {
          headerSet.add(key);
        }
      }
    }

    const headers =
      headerSet.size > 0 ? Array.from(headerSet) : ['Value'];

    worksheet.addRow(headers);

    for (const item of data) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        worksheet.addRow(
          headers.map((header) => {
            const value = item[header];
            if (value == null) {
              return '';
            }
            return typeof value === 'string' ? value : JSON.stringify(value);
          })
        );
      } else {
        worksheet.addRow([String(item ?? '')]);
      }
    }

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
  }

  worksheet.columns.forEach((column) => {
    if (!column || typeof column.eachCell !== 'function') {
      return;
    }
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, String(cell.value ?? '').length + 2);
    });
    column.width = Math.min(maxLength, 50);
  });

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

export async function generatePPTX(
  slides: any[],
  outputPath: string
): Promise<string> {
  await ensureOutputDirectory(outputPath);

  const presentation = new pptxgen();
  presentation.layout = 'LAYOUT_WIDE';
  presentation.author = 'Aude AI';
  presentation.company = 'Aude AI';

  for (const [index, rawSlide] of slides.entries()) {
    const slideInput = rawSlide as PptxSlideInput;
    const slide = presentation.addSlide();
    const title = slideInput.title?.trim() || `Slide ${index + 1}`;
    const bullets =
      Array.isArray(slideInput.bullets) && slideInput.bullets.length > 0
        ? slideInput.bullets
        : splitContentLines(slideInput.content ?? '');

    slide.background = { color: 'F8FAFC' };
    slide.addText(title, {
      x: 0.6,
      y: 0.5,
      w: 11.4,
      h: 0.5,
      fontFace: 'Aptos',
      fontSize: 24,
      bold: true,
      color: '0F172A',
    });

    slide.addText(
      bullets.length > 0 ? bullets.map((text) => ({ text, options: { bullet: { indent: 18 } } })) : [{ text: 'No content.' }],
      {
        x: 0.8,
        y: 1.4,
        w: 11,
        h: 4.8,
        fontFace: 'Aptos',
        fontSize: 18,
        color: '1E293B',
        breakLine: false,
        margin: 0.08,
        valign: 'top',
      }
    );
  }

  if (slides.length === 0) {
    const slide = presentation.addSlide();
    slide.addText('Empty presentation', {
      x: 1,
      y: 1,
      w: 10,
      h: 1,
      fontSize: 24,
      bold: true,
    });
  }

  await presentation.writeFile({ fileName: outputPath });
  return outputPath;
}

export async function sendGeneratedFile(
  interaction: ChatInputCommandInteraction,
  file: GeneratedDiscordFile,
  embed: EmbedBuilder
): Promise<void> {
  const attachment = new AttachmentBuilder(file.filePath, {
    name: file.fileName,
  });

  await interaction.editReply({
    embeds: [embed],
    files: [attachment],
  });
}
