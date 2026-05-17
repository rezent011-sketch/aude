import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getAiStatus, setChannelAiModel } from '../integrations/ai';
import {
  createCanvaDesign,
  listCanvaDesigns,
} from '../integrations/canva';
import {
  readGmailMessage,
  searchGmailMessages,
  sendGmailMessage,
} from '../integrations/gmail';
import { getErrorMessage } from '../integrations/errors';
import {
  exportFigmaNodes,
  getFigmaFile,
  listFigmaComments,
} from '../integrations/figma';
import {
  getFirefliesTranscriptSummary,
  listFirefliesTranscripts,
  searchFirefliesTranscripts,
} from '../integrations/fireflies';
import {
  createSheet,
  readSheet,
  writeSheet,
} from '../integrations/sheets';
import {
  listDriveFiles,
  searchDriveFiles,
  uploadDriveFile,
} from '../integrations/drive';
import {
  createHubSpotContact,
  getHubSpotContact,
  listHubSpotDeals,
} from '../integrations/hubspot';
import {
  getVercelDeploymentStatus,
  listVercelDeployments,
  listVercelProjects,
} from '../integrations/vercel';
import { ModelChoice, getModelLabel, resolveModelChoice } from '../llm/router';
import { splitMessage, truncate } from '../utils/discord';

const MAX_EMAIL_FIELD_LENGTH = 200;
const MAX_MESSAGE_ID_LENGTH = 200;
const MAX_QUERY_LENGTH = 500;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 4000;
const MAX_SPREADSHEET_ID_LENGTH = 200;
const MAX_RANGE_LENGTH = 200;
const MAX_TITLE_LENGTH = 200;
const MAX_FILE_NAME_LENGTH = 200;
const MAX_MIME_TYPE_LENGTH = 120;
const MAX_IDENTIFIER_LENGTH = 200;
const MAX_PHONE_LENGTH = 50;
const MAX_COMPANY_LENGTH = 200;
const MAX_FILE_KEY_LENGTH = 200;
const MAX_TRANSCRIPT_ID_LENGTH = 200;
const MAX_NODE_IDS_LENGTH = 1000;

type Command = {
  data: {
    name: string;
    toJSON(): object;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

async function replyWithParts(
  interaction: ChatInputCommandInteraction,
  content: string
): Promise<void> {
  const parts = splitMessage(content, 1900);

  await interaction.editReply(parts[0]);

  for (let index = 1; index < parts.length; index += 1) {
    await interaction.followUp({
      content: parts[index],
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleIntegrationError(
  interaction: ChatInputCommandInteraction,
  error: unknown,
  fallback: string
): Promise<void> {
  const message = getErrorMessage(error, fallback);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(`⚠️ ${message}`);
    return;
  }

  await interaction.reply({
    content: `⚠️ ${message}`,
    flags: MessageFlags.Ephemeral,
  });
}

export const gmailCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('gmail')
    .setDescription('Gmailを検索・送信・閲覧します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Gmailを検索します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('Gmail検索クエリ。例: from:someone@example.com newer_than:7d')
            .setRequired(true)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('Gmailでメールを送信します')
        .addStringOption((option) =>
          option
            .setName('to')
            .setDescription('送信先メールアドレス')
            .setRequired(true)
            .setMaxLength(MAX_EMAIL_FIELD_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('subject')
            .setDescription('メール件名')
            .setRequired(true)
            .setMaxLength(MAX_SUBJECT_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('body')
            .setDescription('メール本文')
            .setRequired(true)
            .setMaxLength(MAX_BODY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('read')
        .setDescription('message id を指定してGmailを読みます')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('Gmail message id')
            .setRequired(true)
            .setMaxLength(MAX_MESSAGE_ID_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'search') {
        const query = interaction.options.getString('query', true).trim();
        const messages = await searchGmailMessages(query);

        if (messages.length === 0) {
          await interaction.editReply('条件に一致するGmailは見つかりませんでした。');
          return;
        }

        await replyWithParts(
          interaction,
          [
            `Gmail検索結果: ${messages.length}件`,
            ...messages.map((message, index) =>
              [
                `${index + 1}. ${truncate(message.subject, 120)}`,
                `From: ${truncate(message.from, 120)}`,
                `Date: ${message.date ?? '不明'}`,
                `Message ID: ${message.id}`,
                truncate(message.snippet, 200),
              ].join('\n')
            ),
          ].join('\n\n')
        );
        return;
      }

      if (subcommand === 'send') {
        const to = interaction.options.getString('to', true).trim();
        const subject = interaction.options.getString('subject', true).trim();
        const body = interaction.options.getString('body', true).trim();
        const sent = await sendGmailMessage(to, subject, body);

        await interaction.editReply(
          ['Gmailを送信しました。', `Message ID: ${sent.id}`, `Thread ID: ${sent.threadId}`].join('\n')
        );
        return;
      }

      const messageId = interaction.options.getString('message_id', true).trim();
      const message = await readGmailMessage(messageId);

      await replyWithParts(
        interaction,
        [
          `件名: ${message.subject}`,
          `From: ${message.from}`,
          `To: ${message.to}`,
          `Date: ${message.date ?? '不明'}`,
          `Message ID: ${message.id}`,
          '',
          truncate(message.body, 6000),
        ].join('\n')
      );
    } catch (error) {
      await handleIntegrationError(interaction, error, 'Gmail連携の処理中にエラーが発生しました。');
    }
  },
};

export const sheetsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sheets')
    .setDescription('Google Sheetsを読み書きします')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('read')
        .setDescription('Google Sheetsの範囲を読み取ります')
        .addStringOption((option) =>
          option
            .setName('spreadsheet_id')
            .setDescription('Google Sheets の spreadsheet id')
            .setRequired(true)
            .setMaxLength(MAX_SPREADSHEET_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('range')
            .setDescription('例: Sheet1!A1:C10')
            .setRequired(true)
            .setMaxLength(MAX_RANGE_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('write')
        .setDescription('Google Sheetsにデータを書き込みます')
        .addStringOption((option) =>
          option
            .setName('spreadsheet_id')
            .setDescription('Google Sheets の spreadsheet id')
            .setRequired(true)
            .setMaxLength(MAX_SPREADSHEET_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('range')
            .setDescription('例: Sheet1!A1')
            .setRequired(true)
            .setMaxLength(MAX_RANGE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('values')
            .setDescription('タブ区切りで列、改行区切りで行を指定します')
            .setRequired(true)
            .setMaxLength(MAX_BODY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Google Sheetsを新規作成します')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('スプレッドシート名')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('sheet_title')
            .setDescription('最初のシート名')
            .setRequired(false)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'read') {
        const spreadsheetId = interaction.options.getString('spreadsheet_id', true).trim();
        const range = interaction.options.getString('range', true).trim();
        const result = await readSheet(spreadsheetId, range);

        if (result.values.length === 0) {
          await interaction.editReply(`データは見つかりませんでした。\nRange: ${result.range}`);
          return;
        }

        const rows = result.values.map((row) => row.join('\t'));
        await replyWithParts(
          interaction,
          [`Range: ${result.range}`, rows.join('\n')].join('\n\n')
        );
        return;
      }

      if (subcommand === 'write') {
        const spreadsheetId = interaction.options.getString('spreadsheet_id', true).trim();
        const range = interaction.options.getString('range', true).trim();
        const values = interaction.options.getString('values', true);
        const result = await writeSheet(spreadsheetId, range, values);

        await interaction.editReply(
          [
            'Google Sheetsに書き込みました。',
            `Spreadsheet ID: ${result.spreadsheetId}`,
            `Range: ${result.range}`,
            `Rows: ${result.updatedRows}`,
            `Columns: ${result.updatedColumns}`,
            `Cells: ${result.updatedCells}`,
          ].join('\n')
        );
        return;
      }

      const title = interaction.options.getString('title', true).trim();
      const sheetTitle = interaction.options.getString('sheet_title')?.trim();
      const result = await createSheet(title, sheetTitle);

      await interaction.editReply(
        [
          'Google Sheetsを作成しました。',
          `Title: ${result.title}`,
          `Sheet: ${result.sheetTitle}`,
          `Spreadsheet ID: ${result.spreadsheetId}`,
          result.spreadsheetUrl,
        ].join('\n')
      );
    } catch (error) {
      await handleIntegrationError(
        interaction,
        error,
        'Google Sheets連携の処理中にエラーが発生しました。'
      );
    }
  },
};

export const driveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('drive')
    .setDescription('Google Driveを操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Google Driveの最近のファイルを表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('upload')
        .setDescription('テキスト内容をGoogle Driveにアップロードします')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('ファイル名')
            .setRequired(true)
            .setMaxLength(MAX_FILE_NAME_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('ファイル内容')
            .setRequired(true)
            .setMaxLength(MAX_BODY_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('mime_type')
            .setDescription('例: text/plain, application/json')
            .setRequired(false)
            .setMaxLength(MAX_MIME_TYPE_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Google Drive内のファイルを検索します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('ファイル名の部分一致検索')
            .setRequired(true)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'list') {
        const files = await listDriveFiles();

        if (files.length === 0) {
          await interaction.editReply('Google Driveに表示できるファイルはありません。');
          return;
        }

        await replyWithParts(
          interaction,
          [
            `Google Driveファイル: ${files.length}件`,
            ...files.map((file, index) =>
              [
                `${index + 1}. ${truncate(file.name, 120)}`,
                `ID: ${file.id}`,
                `Type: ${file.mimeType}`,
                `Created: ${file.createdTime ?? '不明'}`,
                file.url ?? 'URLなし',
              ].join('\n')
            ),
          ].join('\n\n')
        );
        return;
      }

      if (subcommand === 'upload') {
        const name = interaction.options.getString('name', true).trim();
        const content = interaction.options.getString('content', true);
        const mimeType = interaction.options.getString('mime_type')?.trim() || 'text/plain';
        const result = await uploadDriveFile(name, content, mimeType);

        await interaction.editReply(
          [
            'Google Driveにアップロードしました。',
            `ID: ${result.id}`,
            `Name: ${result.name}`,
            `Type: ${result.mimeType}`,
            result.url ?? 'URLなし',
          ].join('\n')
        );
        return;
      }

      const query = interaction.options.getString('query', true).trim();
      const files = await searchDriveFiles(query);

      if (files.length === 0) {
        await interaction.editReply('条件に一致するGoogle Driveファイルは見つかりませんでした。');
        return;
      }

      await replyWithParts(
        interaction,
        [
          `Google Drive検索結果: ${files.length}件`,
          ...files.map((file, index) =>
            [
              `${index + 1}. ${truncate(file.name, 120)}`,
              `ID: ${file.id}`,
              `Type: ${file.mimeType}`,
              file.url ?? 'URLなし',
            ].join('\n')
          ),
        ].join('\n\n')
      );
    } catch (error) {
      await handleIntegrationError(interaction, error, 'Google Drive連携の処理中にエラーが発生しました。');
    }
  },
};

export const hubspotCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('hubspot')
    .setDescription('HubSpotのCRM情報を操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('contact')
        .setDescription('メールアドレスでHubSpotコンタクトを検索します')
        .addStringOption((option) =>
          option
            .setName('email')
            .setDescription('検索するメールアドレス')
            .setRequired(true)
            .setMaxLength(MAX_EMAIL_FIELD_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create-contact')
        .setDescription('HubSpotコンタクトを作成します')
        .addStringOption((option) =>
          option
            .setName('email')
            .setDescription('メールアドレス')
            .setRequired(true)
            .setMaxLength(MAX_EMAIL_FIELD_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('firstname')
            .setDescription('名')
            .setRequired(false)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('lastname')
            .setDescription('姓')
            .setRequired(false)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('phone')
            .setDescription('電話番号')
            .setRequired(false)
            .setMaxLength(MAX_PHONE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('company')
            .setDescription('会社名')
            .setRequired(false)
            .setMaxLength(MAX_COMPANY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deals')
        .setDescription('HubSpot deal一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'contact') {
        const email = interaction.options.getString('email', true).trim();
        const contact = await getHubSpotContact(email);

        if (!contact) {
          await interaction.editReply('指定したメールアドレスのHubSpotコンタクトは見つかりませんでした。');
          return;
        }

        await interaction.editReply(
          [
            `ID: ${contact.id}`,
            `Email: ${contact.email || '(未設定)'}`,
            `First Name: ${contact.firstname || '(未設定)'}`,
            `Last Name: ${contact.lastname || '(未設定)'}`,
            `Phone: ${contact.phone || '(未設定)'}`,
            `Company: ${contact.company || '(未設定)'}`,
          ].join('\n')
        );
        return;
      }

      if (subcommand === 'create-contact') {
        const contact = await createHubSpotContact({
          email: interaction.options.getString('email', true),
          firstname: interaction.options.getString('firstname') ?? undefined,
          lastname: interaction.options.getString('lastname') ?? undefined,
          phone: interaction.options.getString('phone') ?? undefined,
          company: interaction.options.getString('company') ?? undefined,
        });

        await interaction.editReply(
          [
            'HubSpotコンタクトを作成しました。',
            `ID: ${contact.id}`,
            `Email: ${contact.email || '(未設定)'}`,
            `Name: ${[contact.firstname, contact.lastname].filter(Boolean).join(' ') || '(未設定)'}`,
            `Company: ${contact.company || '(未設定)'}`,
          ].join('\n')
        );
        return;
      }

      const limit = interaction.options.getInteger('limit') ?? 5;
      const deals = await listHubSpotDeals(limit);

      if (deals.length === 0) {
        await interaction.editReply('表示できるHubSpot dealはありません。');
        return;
      }

      await replyWithParts(
        interaction,
        [
          `HubSpot deals: ${deals.length}件`,
          ...deals.map((deal, index) =>
            [
              `${index + 1}. ${truncate(deal.name, 120)}`,
              `ID: ${deal.id}`,
              `Stage: ${deal.stage || '(未設定)'}`,
              `Amount: ${deal.amount || '(未設定)'}`,
              `Close Date: ${deal.closeDate || '(未設定)'}`,
            ].join('\n')
          ),
        ].join('\n\n')
      );
    } catch (error) {
      await handleIntegrationError(interaction, error, 'HubSpot連携の処理中にエラーが発生しました。');
    }
  },
};

export const vercelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('vercel')
    .setDescription('Vercelのデプロイとプロジェクトを確認します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deployments')
        .setDescription('Vercel deployment一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('project_id')
            .setDescription('対象のVercel project id')
            .setRequired(false)
            .setMaxLength(MAX_IDENTIFIER_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deploy-status')
        .setDescription('Vercel deploymentの状態を確認します')
        .addStringOption((option) =>
          option
            .setName('deployment_id')
            .setDescription('Vercel deployment id')
            .setRequired(true)
            .setMaxLength(MAX_IDENTIFIER_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('projects')
        .setDescription('Vercel project一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'deployments') {
        const projectId = interaction.options.getString('project_id')?.trim();
        const limit = interaction.options.getInteger('limit') ?? 5;
        const deployments = await listVercelDeployments(projectId, limit);

        if (deployments.length === 0) {
          await interaction.editReply('表示できるVercel deploymentはありません。');
          return;
        }

        await replyWithParts(
          interaction,
          [
            `Vercel deployments: ${deployments.length}件`,
            ...deployments.map((deployment, index) =>
              [
                `${index + 1}. ${truncate(deployment.name, 120)}`,
                `ID: ${deployment.id}`,
                `State: ${deployment.state}`,
                `Branch: ${deployment.branch || '(未設定)'}`,
                `Created: ${deployment.createdAt ?? '不明'}`,
                deployment.url ?? 'URLなし',
              ].join('\n')
            ),
          ].join('\n\n')
        );
        return;
      }

      if (subcommand === 'deploy-status') {
        const deploymentId = interaction.options.getString('deployment_id', true).trim();
        const deployment = await getVercelDeploymentStatus(deploymentId);

        await interaction.editReply(
          [
            `Name: ${deployment.name}`,
            `ID: ${deployment.id}`,
            `State: ${deployment.state}`,
            `Branch: ${deployment.branch || '(未設定)'}`,
            `Created: ${deployment.createdAt ?? '不明'}`,
            deployment.url ?? 'URLなし',
            deployment.inspectorUrl ?? 'Inspector URLなし',
          ].join('\n')
        );
        return;
      }

      const limit = interaction.options.getInteger('limit') ?? 10;
      const projects = await listVercelProjects(limit);

      if (projects.length === 0) {
        await interaction.editReply('表示できるVercel projectはありません。');
        return;
      }

      await replyWithParts(
        interaction,
        [
          `Vercel projects: ${projects.length}件`,
          ...projects.map((project, index) =>
            [
              `${index + 1}. ${truncate(project.name, 120)}`,
              `ID: ${project.id}`,
              `Framework: ${project.framework}`,
              `Updated: ${project.updatedAt ?? '不明'}`,
            ].join('\n')
          ),
        ].join('\n\n')
      );
    } catch (error) {
      await handleIntegrationError(interaction, error, 'Vercel連携の処理中にエラーが発生しました。');
    }
  },
};

export const firefliesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('fireflies')
    .setDescription('Fireflies transcripts を検索・要約します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('transcripts')
        .setDescription('最近の transcript 一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Fireflies transcript を検索します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('検索キーワード')
            .setRequired(true)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('summary')
        .setDescription('transcript id を指定して summary を表示します')
        .addStringOption((option) =>
          option
            .setName('transcript_id')
            .setDescription('Fireflies transcript id')
            .setRequired(true)
            .setMaxLength(MAX_TRANSCRIPT_ID_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'transcripts') {
        const limit = interaction.options.getInteger('limit') ?? 5;
        const transcripts = await listFirefliesTranscripts(limit);

        if (transcripts.length === 0) {
          await interaction.editReply('表示できる Fireflies transcript はありません。');
          return;
        }

        await replyWithParts(
          interaction,
          [
            `Fireflies transcripts: ${transcripts.length}件`,
            ...transcripts.map((item, index) =>
              [
                `${index + 1}. ${truncate(item.title, 120)}`,
                `ID: ${item.id}`,
                `Date: ${item.date ?? '不明'}`,
                `Organizer: ${item.organizerEmail ?? '不明'}`,
                truncate(item.shortSummary ?? item.shortOverview ?? 'summary なし', 200),
                item.transcriptUrl ?? 'URLなし',
              ].join('\n')
            ),
          ].join('\n\n')
        );
        return;
      }

      if (subcommand === 'search') {
        const query = interaction.options.getString('query', true).trim();
        const limit = interaction.options.getInteger('limit') ?? 5;
        const transcripts = await searchFirefliesTranscripts(query, limit);

        if (transcripts.length === 0) {
          await interaction.editReply('条件に一致する Fireflies transcript は見つかりませんでした。');
          return;
        }

        await replyWithParts(
          interaction,
          [
            `Fireflies search: ${transcripts.length}件`,
            ...transcripts.map((item, index) =>
              [
                `${index + 1}. ${truncate(item.title, 120)}`,
                `ID: ${item.id}`,
                `Date: ${item.date ?? '不明'}`,
                truncate(item.shortSummary ?? item.shortOverview ?? 'summary なし', 240),
                item.transcriptUrl ?? 'URLなし',
              ].join('\n')
            ),
          ].join('\n\n')
        );
        return;
      }

      const transcriptId = interaction.options.getString('transcript_id', true).trim();
      const summary = await getFirefliesTranscriptSummary(transcriptId);

      await replyWithParts(
        interaction,
        [
          `Title: ${summary.title}`,
          `ID: ${summary.id}`,
          `Date: ${summary.date ?? '不明'}`,
          `Participants: ${summary.participants.length > 0 ? summary.participants.join(', ') : 'なし'}`,
          `Duration: ${summary.durationInSeconds ?? '不明'} 秒`,
          `Summary: ${summary.shortSummary ?? 'なし'}`,
          `Overview: ${summary.shortOverview ?? 'なし'}`,
          `Action Items: ${summary.actionItems.length > 0 ? summary.actionItems.join(' / ') : 'なし'}`,
          `Keywords: ${summary.keywords.length > 0 ? summary.keywords.join(', ') : 'なし'}`,
          summary.transcriptUrl ?? 'Transcript URLなし',
        ].join('\n')
      );
    } catch (error) {
      await handleIntegrationError(
        interaction,
        error,
        'Fireflies連携の処理中にエラーが発生しました。'
      );
    }
  },
};

export const canvaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('canva')
    .setDescription('Canva design を一覧・作成します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('designs')
        .setDescription('Canva design 一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('design 名で絞り込みます')
            .setRequired(false)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Canva design を新規作成します')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('design のタイトル')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('preset')
            .setDescription('Canva preset。custom の場合は width/height を指定')
            .setRequired(true)
            .addChoices(
              { name: 'Doc', value: 'doc' },
              { name: 'Presentation', value: 'presentation' },
              { name: 'Whiteboard', value: 'whiteboard' },
              { name: 'Email', value: 'email' },
              { name: 'Custom', value: 'custom' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('width')
            .setDescription('custom 用 width')
            .setRequired(false)
            .setMinValue(40)
            .setMaxValue(8000)
        )
        .addIntegerOption((option) =>
          option
            .setName('height')
            .setDescription('custom 用 height')
            .setRequired(false)
            .setMinValue(40)
            .setMaxValue(8000)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'designs') {
        const query = interaction.options.getString('query')?.trim();
        const limit = interaction.options.getInteger('limit') ?? 10;
        const result = await listCanvaDesigns(query, limit);

        if (result.items.length === 0) {
          await interaction.editReply('表示できる Canva design はありません。');
          return;
        }

        await replyWithParts(
          interaction,
          [
            `Canva designs: ${result.items.length}件`,
            ...result.items.map((design, index) =>
              [
                `${index + 1}. ${truncate(design.title, 120)}`,
                `ID: ${design.id}`,
                `Updated: ${design.updatedAt}`,
                `Pages: ${design.pageCount ?? '不明'}`,
                design.editUrl ?? design.viewUrl ?? 'URLなし',
              ].join('\n')
            ),
            result.continuation ? `Continuation: ${result.continuation}` : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        );
        return;
      }

      const title = interaction.options.getString('title', true).trim();
      const preset = interaction.options.getString('preset', true);

      const design =
        preset === 'custom'
          ? await createCanvaDesign({
              title,
              width:
                interaction.options.getInteger('width') ??
                (() => {
                  throw new Error('custom design では `width` を指定してください。');
                })(),
              height:
                interaction.options.getInteger('height') ??
                (() => {
                  throw new Error('custom design では `height` を指定してください。');
                })(),
            })
          : await createCanvaDesign({
              title,
              preset: preset as 'doc' | 'presentation' | 'whiteboard' | 'email',
            });

      await interaction.editReply(
        [
          'Canva design を作成しました。',
          `ID: ${design.id}`,
          `Title: ${design.title}`,
          `Updated: ${design.updatedAt}`,
          design.editUrl ?? design.viewUrl ?? 'URLなし',
        ].join('\n')
      );
    } catch (error) {
      await handleIntegrationError(interaction, error, 'Canva連携の処理中にエラーが発生しました。');
    }
  },
};

export const figmaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('figma')
    .setDescription('Figma file 情報を取得します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('files')
        .setDescription('Figma file 情報を表示します')
        .addStringOption((option) =>
          option
            .setName('file_key')
            .setDescription('Figma file key')
            .setRequired(true)
            .setMaxLength(MAX_FILE_KEY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('comments')
        .setDescription('Figma comments を取得します')
        .addStringOption((option) =>
          option
            .setName('file_key')
            .setDescription('Figma file key')
            .setRequired(true)
            .setMaxLength(MAX_FILE_KEY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('export')
        .setDescription('Figma node を export します')
        .addStringOption((option) =>
          option
            .setName('file_key')
            .setDescription('Figma file key')
            .setRequired(true)
            .setMaxLength(MAX_FILE_KEY_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('node_ids')
            .setDescription('カンマ区切りの node id。一例: 1:2,3:4')
            .setRequired(true)
            .setMaxLength(MAX_NODE_IDS_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('format')
            .setDescription('export format')
            .setRequired(true)
            .addChoices(
              { name: 'PNG', value: 'png' },
              { name: 'JPG', value: 'jpg' },
              { name: 'SVG', value: 'svg' },
              { name: 'PDF', value: 'pdf' }
            )
        )
        .addNumberOption((option) =>
          option
            .setName('scale')
            .setDescription('png/jpg/svg 用 scale')
            .setRequired(false)
            .setMinValue(0.01)
            .setMaxValue(4)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'files') {
        const fileKey = interaction.options.getString('file_key', true).trim();
        const file = await getFigmaFile(fileKey);

        await interaction.editReply(
          [
            `Name: ${file.name}`,
            `Key: ${file.key}`,
            `Role: ${file.role ?? '不明'}`,
            `Last Modified: ${file.lastModified ?? '不明'}`,
            `Version: ${file.version ?? '不明'}`,
            `Pages: ${file.pageNames.length > 0 ? file.pageNames.join(', ') : 'なし'}`,
            file.thumbnailUrl ?? 'Thumbnail URLなし',
          ].join('\n')
        );
        return;
      }

      if (subcommand === 'comments') {
        const fileKey = interaction.options.getString('file_key', true).trim();
        const comments = await listFigmaComments(fileKey);

        if (comments.length === 0) {
          await interaction.editReply('表示できる Figma comment はありません。');
          return;
        }

        await replyWithParts(
          interaction,
          [
            `Figma comments: ${comments.length}件`,
            ...comments.map((comment, index) =>
              [
                `${index + 1}. ${truncate(comment.message, 180)}`,
                `ID: ${comment.id}`,
                `Author: ${comment.author ?? '不明'}`,
                `Created: ${comment.createdAt ?? '不明'}`,
                `Resolved: ${comment.resolvedAt ?? '未解決'}`,
              ].join('\n')
            ),
          ].join('\n\n')
        );
        return;
      }

      const fileKey = interaction.options.getString('file_key', true).trim();
      const format = interaction.options.getString('format', true) as 'png' | 'jpg' | 'svg' | 'pdf';
      const scale = interaction.options.getNumber('scale') ?? undefined;
      const nodeIds = interaction.options
        .getString('node_ids', true)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const result = await exportFigmaNodes(fileKey, nodeIds, format, scale);

      await replyWithParts(
        interaction,
        [
          `Figma export: ${result.images.length}件`,
          `File Key: ${result.fileKey}`,
          `Format: ${result.format}`,
          ...result.images.map((image, index) =>
            [`${index + 1}. Node: ${image.nodeId}`, image.url ?? 'URLなし'].join('\n')
          ),
        ].join('\n\n')
      );
    } catch (error) {
      await handleIntegrationError(interaction, error, 'Figma連携の処理中にエラーが発生しました。');
    }
  },
};

export const aiCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('チャンネルごとの既定 LLM を確認・切替します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('switch')
        .setDescription('このチャンネルの既定 LLM を切り替えます')
        .addStringOption((option) =>
          option
            .setName('model')
            .setDescription('使用する既定モデル')
            .setRequired(true)
            .addChoices(
              { name: 'Auto', value: 'auto' },
              { name: 'Claude', value: 'claude' },
              { name: 'GPT-4o', value: 'gpt4o' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('このチャンネルの既定 LLM 状態を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const channelId = interaction.channelId;

      if (!channelId) {
        throw new Error('チャンネル情報を取得できませんでした。');
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'switch') {
        const model = interaction.options.getString('model', true) as ModelChoice;
        const status = setChannelAiModel(channelId, model, interaction.user.id, interaction.user.username);
        const effectiveModel = resolveModelChoice('general question', status.configuredModel, channelId);

        await interaction.editReply(
          [
            '既定 LLM を更新しました。',
            `Configured: ${status.configuredModel}`,
            `Effective: ${getModelLabel(effectiveModel)}`,
            `Updated By: ${status.updatedBy ?? interaction.user.username}`,
            `OpenAI API: ${status.openaiConfigured ? '設定済み' : '未設定'}`,
            `Anthropic API: ${status.anthropicConfigured ? '設定済み' : '未設定'}`,
          ].join('\n')
        );
        return;
      }

      const status = getAiStatus(channelId, resolveModelChoice('general question', 'auto', channelId));

      await interaction.editReply(
        [
          `Configured: ${status.configuredModel}`,
          `Effective: ${getModelLabel(status.effectiveModel)}`,
          `Updated By: ${status.updatedBy ?? '未設定'}`,
          `Updated At: ${status.updatedAt ?? '未設定'}`,
          `OpenAI API: ${status.openaiConfigured ? '設定済み' : '未設定'}`,
          `Anthropic API: ${status.anthropicConfigured ? '設定済み' : '未設定'}`,
        ].join('\n')
      );
    } catch (error) {
      await handleIntegrationError(
        interaction,
        error,
        'AIモデル切替の処理中にエラーが発生しました。'
      );
    }
  },
};
