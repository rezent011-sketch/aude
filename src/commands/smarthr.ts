import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getDepartments, getEmployee, getEmployees } from '../integrations/smarthr';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('SmartHR認証情報が未設定です')
    .setDescription(
      '/vault set で `smarthr_access_token` と `smarthr_subdomain` を設定してください'
    )
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatFieldValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '[Unserializable value]';
  }
}

function pickValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
}

function formatRecordPreview(record: Record<string, unknown>, preferredKeys: string[]): string {
  const primaryLines = preferredKeys
    .map((key) => {
      const value = record[key];
      if (typeof value === 'undefined') {
        return null;
      }
      return `${key}: ${truncate(formatFieldValue(value), 120)}`;
    })
    .filter((line): line is string => Boolean(line));

  if (primaryLines.length > 0) {
    return primaryLines.join('\n');
  }

  const fallbackLines = Object.entries(record)
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${truncate(formatFieldValue(value), 120)}`);

  return fallbackLines.length > 0 ? fallbackLines.join('\n') : 'データなし';
}

export const smarthrCommand = {
  data: new SlashCommandBuilder()
    .setName('smarthr')
    .setDescription('SmartHRのemployeeとdepartmentを表示します')
    .addSubcommand((subcommand) =>
      subcommand.setName('employees').setDescription('employee一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('employee')
        .setDescription('employee詳細を表示します')
        .addStringOption((option) =>
          option.setName('id').setDescription('SmartHR employee ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('departments').setDescription('department一覧を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const accessToken = vaultService.getCredential(
        interaction.user.id,
        'user',
        'smarthr_access_token'
      );
      const subdomain = vaultService.getCredential(interaction.user.id, 'user', 'smarthr_subdomain');

      if (!accessToken || !subdomain) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'employees') {
        const employees = await getEmployees(accessToken, subdomain);
        const embed = new EmbedBuilder().setTitle('SmartHR Employees').setColor(0x00a3ad);

        if (employees.length === 0) {
          embed.setDescription('employeeは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              employees.slice(0, 10).map((employee, index) => {
                const id = pickValue(employee, ['id', 'employee_id']) || `employee-${index + 1}`;
                const name =
                  pickValue(employee, ['full_name', 'name', 'display_name']) || '(No name)';
                return `**${name}**\nID: ${id}\n${formatRecordPreview(employee, [
                  'email',
                  'employee_number',
                  'department_name',
                  'employment_status',
                ])}`;
              })
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'employee') {
        const id = interaction.options.getString('id', true).trim();
        const employee = await getEmployee(accessToken, subdomain, id);
        const embed = new EmbedBuilder()
          .setTitle(`SmartHR Employee: ${pickValue(employee, ['full_name', 'name', 'display_name']) || id}`)
          .setColor(0x00a3ad)
          .addFields({ name: 'ID', value: pickValue(employee, ['id', 'employee_id']) || id, inline: true })
          .setDescription(`\`\`\`json\n${truncate(JSON.stringify(employee, null, 2), 3900)}\n\`\`\``);

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const departments = await getDepartments(accessToken, subdomain);
      const embed = new EmbedBuilder().setTitle('SmartHR Departments').setColor(0x00a3ad);

      if (departments.length === 0) {
        embed.setDescription('departmentは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            departments.slice(0, 10).map((department, index) => {
              const id =
                pickValue(department, ['id', 'department_id']) || `department-${index + 1}`;
              const name = pickValue(department, ['name', 'department_name']) || '(No name)';
              return `**${name}**\nID: ${id}\n${formatRecordPreview(department, [
                'code',
                'parent_id',
                'created_at',
                'updated_at',
              ])}`;
            })
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'SmartHR連携の処理中にエラーが発生しました。');

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `⚠️ ${message}` });
        return;
      }

      await interaction.reply({
        content: `⚠️ ${message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
