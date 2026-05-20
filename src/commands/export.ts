import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { getMessagesByChannel, type ExportMessageRecord } from '../db/conversationRepository';
import { deleteTempFile } from '../files/tempFiles';
import { routeToLLM } from '../llm/router';
import {
  generateConversationExport,
  generateExcelExport,
  generatePptxExport,
  type ExportFormat,
} from '../services/fileExports';

interface ExcelExportPayload {
  title: string;
  headers: string[];
  rows: string[][];
}

interface PptxExportPayload {
  title: string;
  slides: Array<{ heading: string; bullets: string[] }>;
}

function buildConversationTranscript(
  channelId: string,
  messages: ExportMessageRecord[]
): string {
  return [
    `Channel: ${channelId}`,
    ...messages.map((message) => {
      const speaker = message.role === 'assistant' ? 'Aude' : message.username;
      return `[${message.createdAt}] ${speaker} (${message.role})\n${message.content}`;
    }),
  ].join('\n\n');
}

function extractJsonBlock(raw: string): string {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fencedMatch?.[1]?.trim() ?? raw.trim();
}

function parseJson<T>(raw: string): T {
  return JSON.parse(extractJsonBlock(raw)) as T;
}

async function buildExcelPayload(
  guildId: string | null,
  channelId: string,
  messages: ExportMessageRecord[]
): Promise<ExcelExportPayload> {
  const prompt = [
    'Convert this Discord conversation into structured spreadsheet data.',
    'Return JSON only with this exact schema:',
    '{"title":"string","headers":["string"],"rows":[["string"]]}',
    'Requirements:',
    '- Use 3 to 6 short column headers.',
    '- Every row must have exactly the same number of cells as headers.',
    '- Summarize long content into compact cell values.',
    '- Do not include markdown or commentary.',
    '',
    buildConversationTranscript(channelId, messages),
  ].join('\n');

  const response = await routeToLLM(
    prompt,
    'auto',
    undefined,
    channelId,
    undefined,
    guildId ?? undefined
  );
  const parsed = parseJson<ExcelExportPayload>(response);

  if (!parsed.title || !Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) {
    throw new Error('Excel export data is incomplete.');
  }

  return {
    title: parsed.title,
    headers: parsed.headers.map((header) => String(header)),
    rows: parsed.rows.map((row) => parsed.headers.map((_, index) => String(row[index] ?? ''))),
  };
}

async function buildPptxPayload(
  guildId: string | null,
  channelId: string,
  messages: ExportMessageRecord[]
): Promise<PptxExportPayload> {
  const prompt = [
    'Convert this Discord conversation into a presentation outline.',
    'Return JSON only with this exact schema:',
    '{"title":"string","slides":[{"heading":"string","bullets":["string"]}]}',
    'Requirements:',
    '- Create 3 to 8 content slides.',
    '- Each slide needs a concise heading and 2 to 5 bullets.',
    '- Summarize the conversation into presentation-ready language.',
    '- Do not include markdown or commentary.',
    '',
    buildConversationTranscript(channelId, messages),
  ].join('\n');

  const response = await routeToLLM(
    prompt,
    'auto',
    undefined,
    channelId,
    undefined,
    guildId ?? undefined
  );
  const parsed = parseJson<PptxExportPayload>(response);

  if (!parsed.title || !Array.isArray(parsed.slides)) {
    throw new Error('PPTX export data is incomplete.');
  }

  return {
    title: parsed.title,
    slides: parsed.slides.map((slide) => ({
      heading: String(slide.heading ?? 'Untitled Slide'),
      bullets: Array.isArray(slide.bullets)
        ? slide.bullets.map((bullet) => String(bullet))
        : [],
    })),
  };
}

export const exportCommand = {
  data: new SlashCommandBuilder()
    .setName('export')
    .setDescription('現在のチャンネルの会話履歴をファイルとして出力します')
    .addStringOption((option) =>
      option
        .setName('format')
        .setDescription('出力ファイル形式')
        .setRequired(true)
        .addChoices(
          { name: 'PDF', value: 'pdf' },
          { name: 'TXT', value: 'txt' },
          { name: 'Excel', value: 'excel' },
          { name: 'PPTX', value: 'pptx' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = interaction.options.getString('format', true) as ExportFormat;
    const channelId = interaction.channelId;
    const guildId = interaction.guildId;

    await interaction.deferReply({ ephemeral: true });

    const messages = await getMessagesByChannel(channelId);

    if (messages.length === 0) {
      await interaction.editReply('このチャンネルにはエクスポートできる会話履歴がありません。');
      return;
    }

    let generatedFile;

    try {
      if (format === 'excel') {
        const payload = await buildExcelPayload(guildId, channelId, messages);
        generatedFile = await generateExcelExport(payload);
      } else if (format === 'pptx') {
        const payload = await buildPptxPayload(guildId, channelId, messages);
        generatedFile = await generatePptxExport(payload);
      } else {
        generatedFile = await generateConversationExport(channelId, format);
      }

      if (!generatedFile) {
        await interaction.editReply('このチャンネルにはエクスポートできる会話履歴がありません。');
        return;
      }

      const attachment = new AttachmentBuilder(generatedFile.path, {
        name: generatedFile.name,
      });

      await interaction.editReply({
        content: `会話履歴を ${format.toUpperCase()} で出力しました。`,
        files: [attachment],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー';
      await interaction.editReply(`⚠️ エクスポートの生成に失敗しました: ${message}`);
    } finally {
      if (generatedFile) {
        await deleteTempFile(generatedFile.path);
      }
    }
  },
};
