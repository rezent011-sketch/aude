import fs from 'fs/promises';
import path from 'path';
import { getMessagesByChannel, getUserConversationSummary } from '../db/conversationRepository';
import UserRepository from '../db/userRepository';
import SubscriptionRepository from '../db/subscriptionRepository';
import { getPlanLabelJa } from '../stripe/plans';
import { createTempFilePath, deleteTempFile } from '../files/tempFiles';
import { generatePdf } from '../files/pdfGenerator';
import { generateExcel } from '../files/excelGenerator';
import { generatePptx } from '../files/pptGenerator';

export type ExportFormat = 'pdf' | 'txt' | 'excel' | 'pptx';
export type ConversationExportFormat = Extract<ExportFormat, 'pdf' | 'txt'>;

export interface GeneratedFile {
  name: string;
  path: string;
}

export interface ExcelExportData {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface PptxExportData {
  title: string;
  slides: Array<{ heading: string; bullets: string[] }>;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ja-JP', {
    hour12: false,
  });
}

function sanitizeFileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'aude';
}

function formatConversationText(
  channelId: string,
  messages: Awaited<ReturnType<typeof getMessagesByChannel>>
): string {
  const lines = [
    'Aude AI Conversation Export',
    `Channel: ${channelId}`,
    `Generated At: ${new Date().toISOString()}`,
    '',
  ];

  for (const message of messages) {
    const speaker = message.role === 'assistant' ? 'Aude' : message.username;
    lines.push(`[${formatDateTime(message.createdAt)}] ${speaker} (${message.role})`);
    lines.push(message.content);
    lines.push('');
  }

  return lines.join('\n');
}

export async function generateConversationExport(
  channelId: string,
  format: ConversationExportFormat
): Promise<GeneratedFile | null> {
  const messages = await getMessagesByChannel(channelId);

  if (messages.length === 0) {
    return null;
  }

  const prefix = `conversation-${sanitizeFileToken(channelId)}`;
  const filePath = await createTempFilePath(prefix, format);
  const name = path.basename(filePath);

  try {
    if (format === 'txt') {
      await fs.writeFile(filePath, formatConversationText(channelId, messages), 'utf8');
      return { name, path: filePath };
    }

    await generatePdf({
      outputPath: filePath,
      title: 'Conversation Export',
      subtitle: `Channel ${channelId}`,
      metadata: [
        { label: 'Generated', value: formatDateTime(new Date().toISOString()) },
        { label: 'Messages', value: messages.length.toLocaleString('ja-JP') },
      ],
      sections: messages.map((message) => ({
        heading: `${message.role === 'assistant' ? 'Aude' : message.username} · ${formatDateTime(message.createdAt)}`,
        body: [message.content],
      })),
    });

    return { name, path: filePath };
  } catch (error) {
    await deleteTempFile(filePath);
    throw error;
  }
}

export async function generateExcelExport(data: ExcelExportData): Promise<GeneratedFile> {
  const filePath = await createTempFilePath(`conversation-${sanitizeFileToken(data.title)}`, 'xlsx');

  try {
    await generateExcel({
      ...data,
      outputPath: filePath,
    });
  } catch (error) {
    await deleteTempFile(filePath);
    throw error;
  }

  return {
    name: path.basename(filePath),
    path: filePath,
  };
}

export async function generatePptxExport(data: PptxExportData): Promise<GeneratedFile> {
  const filePath = await createTempFilePath(`conversation-${sanitizeFileToken(data.title)}`, 'pptx');

  try {
    await generatePptx({
      ...data,
      outputPath: filePath,
    });
  } catch (error) {
    await deleteTempFile(filePath);
    throw error;
  }

  return {
    name: path.basename(filePath),
    path: filePath,
  };
}

export async function generateUsageReport(
  discordId: string,
  username: string
): Promise<GeneratedFile> {
  const user = UserRepository.getOrCreateUser(discordId, username);
  const creditsSummary = UserRepository.getCreditUsageSummary(discordId);
  const recentTransactions = UserRepository.getRecentTransactions(discordId, 10);
  const conversationSummary = await getUserConversationSummary(user.id);
  const subscription = SubscriptionRepository.getByDiscordId(discordId);

  const filePath = await createTempFilePath(
    `usage-report-${sanitizeFileToken(discordId)}`,
    'pdf'
  );

  try {
    await generatePdf({
      outputPath: filePath,
      title: 'Usage Report',
      subtitle: `${username} (${discordId})`,
      metadata: [
        { label: 'Plan', value: getPlanLabelJa(subscription?.plan ?? 'free') },
        { label: 'Generated', value: formatDateTime(new Date().toISOString()) },
        { label: 'Remaining Credits', value: user.credits.toLocaleString('ja-JP') },
      ],
      sections: [
        {
          heading: 'Credit Summary',
          body: [
            `Remaining credits: ${user.credits.toLocaleString('ja-JP')}`,
            `Total credits used: ${creditsSummary.totalUsed.toLocaleString('ja-JP')}`,
            `Total credits added: ${creditsSummary.totalAdded.toLocaleString('ja-JP')}`,
            `Total credits refunded: ${creditsSummary.totalRefunded.toLocaleString('ja-JP')}`,
            `Total transactions: ${creditsSummary.transactionCount.toLocaleString('ja-JP')}`,
            `First transaction: ${formatDateTime(creditsSummary.firstTransactionAt)}`,
            `Last transaction: ${formatDateTime(creditsSummary.lastTransactionAt)}`,
          ],
        },
        {
          heading: 'Conversation Summary',
          body: [
            `Conversation channels: ${conversationSummary.channelCount.toLocaleString('ja-JP')}`,
            `Total messages: ${conversationSummary.messageCount.toLocaleString('ja-JP')}`,
            `User prompts: ${conversationSummary.promptCount.toLocaleString('ja-JP')}`,
            `Assistant responses: ${conversationSummary.responseCount.toLocaleString('ja-JP')}`,
            `First message: ${formatDateTime(conversationSummary.firstMessageAt)}`,
            `Last message: ${formatDateTime(conversationSummary.lastMessageAt)}`,
          ],
        },
        {
          heading: 'Recent Transactions',
          body:
            recentTransactions.length > 0
              ? recentTransactions.map((transaction) => {
                  return [
                    `${formatDateTime(transaction.createdAt)}`,
                    `${transaction.type.toUpperCase()} ${transaction.amount.toLocaleString('ja-JP')} credits`,
                    transaction.description ?? 'No description',
                  ].join('\n');
                })
              : ['No transactions recorded yet.'],
        },
      ],
    });
  } catch (error) {
    await deleteTempFile(filePath);
    throw error;
  }

  return {
    name: path.basename(filePath),
    path: filePath,
  };
}
