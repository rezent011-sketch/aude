import path from 'path';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { createTempFilePath, deleteTempFile } from '../files/tempFiles';
import {
  generateExcel,
  generatePDF,
  generatePPTX,
  sendGeneratedFile,
} from '../services/fileGenerator';

interface ExcelRow {
  [key: string]: string;
}

interface SlidePayload {
  title: string;
  bullets: string[];
}

function sanitizeBaseName(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
  return normalized.slice(0, 50) || 'report';
}

function parseExcelRows(content: string): ExcelRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0]
    .split(delimiter)
    .map((header, index) => header.trim() || `column_${index + 1}`);

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((value) => value.trim());
    const row: ExcelRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function parseSlides(content: string): SlidePayload[] {
  const sections = content
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  if (sections.length === 0) {
    return [];
  }

  return sections.map((section, index) => {
    const lines = section
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const [firstLine, ...rest] = lines;
    const bullets = (rest.length > 0 ? rest : [firstLine]).map((line) =>
      line.replace(/^[-*•]\s*/, '')
    );

    return {
      title: firstLine || `Slide ${index + 1}`,
      bullets,
    };
  });
}

export const reportCommand = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('PDF / Excel / PPTX レポートを生成します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pdf')
        .setDescription('PDFレポートを生成します')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('PDFのタイトル')
            .setRequired(true)
            .setMaxLength(120)
        )
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('PDFに含める本文')
            .setRequired(true)
            .setMaxLength(4000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('excel')
        .setDescription('Excelレポートを生成します')
        .addStringOption((option) =>
          option
            .setName('sheet_name')
            .setDescription('シート名')
            .setRequired(true)
            .setMaxLength(31)
        )
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('1行目をヘッダーにしたCSVまたはTSV形式の内容')
            .setRequired(true)
            .setMaxLength(4000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pptx')
        .setDescription('PPTXレポートを生成します')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('プレゼンテーションのタイトル')
            .setRequired(true)
            .setMaxLength(120)
        )
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('空行区切りでスライドを分けた本文')
            .setRequired(true)
            .setMaxLength(4000)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let filePath: string | null = null;

    try {
      if (subcommand === 'pdf') {
        const title = interaction.options.getString('title', true);
        const content = interaction.options.getString('content', true);
        filePath = await createTempFilePath(sanitizeBaseName(title), 'pdf');

        await generatePDF(title, content, filePath);

        const embed = new EmbedBuilder()
          .setColor(0x2563eb)
          .setTitle('PDFレポートを生成しました')
          .setDescription(`タイトル: ${title}`)
          .addFields({ name: '形式', value: 'PDF', inline: true })
          .setTimestamp();

        await sendGeneratedFile(
          interaction,
          {
            filePath,
            fileName: path.basename(filePath),
          },
          embed
        );
        return;
      }

      if (subcommand === 'excel') {
        const sheetName = interaction.options.getString('sheet_name', true);
        const content = interaction.options.getString('content', true);
        const rows = parseExcelRows(content);
        filePath = await createTempFilePath(sanitizeBaseName(sheetName), 'xlsx');

        await generateExcel(rows, sheetName, filePath);

        const embed = new EmbedBuilder()
          .setColor(0x16a34a)
          .setTitle('Excelレポートを生成しました')
          .setDescription(`シート名: ${sheetName}`)
          .addFields(
            { name: '形式', value: 'Excel', inline: true },
            { name: '行数', value: String(rows.length), inline: true }
          )
          .setTimestamp();

        await sendGeneratedFile(
          interaction,
          {
            filePath,
            fileName: path.basename(filePath),
          },
          embed
        );
        return;
      }

      if (subcommand === 'pptx') {
        const title = interaction.options.getString('title', true);
        const content = interaction.options.getString('content', true);
        const slides = parseSlides(content);
        filePath = await createTempFilePath(sanitizeBaseName(title), 'pptx');

        await generatePPTX(
          slides.map((slide) => ({
            title: slide.title,
            bullets: slide.bullets,
          })),
          filePath
        );

        const embed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('PPTXレポートを生成しました')
          .setDescription(`タイトル: ${title}`)
          .addFields(
            { name: '形式', value: 'PPTX', inline: true },
            { name: 'スライド数', value: String(slides.length), inline: true }
          )
          .setTimestamp();

        await sendGeneratedFile(
          interaction,
          {
            filePath,
            fileName: path.basename(filePath),
          },
          embed
        );
        return;
      }

      throw new Error('未対応のサブコマンドです。');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'レポート生成に失敗しました。';

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle('レポート生成に失敗しました')
            .setDescription(message)
            .setTimestamp(),
        ],
      });
    } finally {
      if (filePath) {
        await deleteTempFile(filePath);
      }
    }
  },
};
