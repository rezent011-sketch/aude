// src/commands/code.ts -- /code command: generate or run code
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { routeToLLM } from '../llm/router';
import { executeCode } from '../services/codeExecutor';
import { formatElapsed, splitMessage, truncate } from '../utils/discord';

const OUTPUT_FIELD_LIMIT = 1000;

function buildCodePrompt(task: string, language: string): string {
  const languageHint = language ? `Language: ${language}\n\n` : '';
  return `${languageHint}Code task: ${task}\n\nProvide working, well-commented code. Use Discord markdown code blocks. Explain key decisions briefly.`;
}

function formatOutputField(output: string): string {
  const safeOutput = truncate(output || 'No output', OUTPUT_FIELD_LIMIT);
  return `\`\`\`\n${safeOutput}\n\`\`\``;
}

async function handleCodeGenerate(interaction: ChatInputCommandInteraction): Promise<void> {
  const task = interaction.options.getString('task', true);
  const language = interaction.options.getString('language') ?? '';

  await interaction.deferReply();

  const startTime = Date.now();

  try {
    const result = await routeToLLM(buildCodePrompt(task, language), 'gpt4o');
    const elapsed = formatElapsed(startTime);
    const parts = splitMessage(result);

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('Code Ready')
      .setDescription(parts[0])
      .setFooter({ text: `Generated in ${elapsed}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    for (let i = 1; i < parts.length; i++) {
      await interaction.followUp({ content: parts[i] });
    }
  } catch (error) {
    console.error('Error in /code generate:', error);
    await interaction.editReply(
      error instanceof Error && error.message
        ? error.message
        : 'コード生成に失敗しました。設定と入力内容を確認してください。'
    );
  }
}

async function handleCodeRun(interaction: ChatInputCommandInteraction): Promise<void> {
  const languageChoice = interaction.options.getString('language', true);
  const code = interaction.options.getString('code', true);

  const languageMap: Record<string, string> = {
    python: 'python3',
    javascript: 'node',
    bash: 'bash',
  };

  const runtime = languageMap[languageChoice];

  await interaction.deferReply();

  const startedAt = Date.now();

  try {
    const result = await executeCode(runtime, code);
    const elapsedMs = Date.now() - startedAt;
    const embed = new EmbedBuilder()
      .setColor(result.stderr ? 0xed4245 : 0x57f287)
      .setTitle(`Code Execution: ${languageChoice}`)
      .addFields(
        {
          name: 'Exit Code',
          value: String(result.exitCode),
          inline: true,
        },
        {
          name: 'Execution Time',
          value: `${elapsedMs}ms`,
          inline: true,
        }
      )
      .setTimestamp();

    if (result.stdout) {
      embed.addFields({
        name: '🟢 stdout',
        value: formatOutputField(result.stdout),
        inline: false,
      });
    }

    if (result.stderr) {
      embed.addFields({
        name: '🔴 stderr',
        value: formatOutputField(result.stderr),
        inline: false,
      });
    }

    if (!result.stdout && !result.stderr) {
      embed.setDescription('No output');
    }

    if (result.timedOut) {
      embed.addFields({
        name: 'Warning',
        value: 'Execution timed out after 10000ms and the subprocess was killed.',
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in /code run:', error);
    await interaction.editReply(
      error instanceof Error && error.message
        ? error.message
        : 'コード実行に失敗しました。実行環境と入力内容を確認してください。'
    );
  }
}

export const codeCommand = {
  data: new SlashCommandBuilder()
    .setName('code')
    .setDescription('Write, review, debug, or run code')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('generate')
        .setDescription('Write, review, or debug code')
        .addStringOption((option) =>
          option
            .setName('task')
            .setDescription('What code task should Aude do?')
            .setRequired(true)
            .setMaxLength(800)
        )
        .addStringOption((option) =>
          option
            .setName('language')
            .setDescription('Programming language (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('run')
        .setDescription('Run Python, JavaScript, or bash code')
        .addStringOption((option) =>
          option
            .setName('language')
            .setDescription('Language runtime')
            .setRequired(true)
            .addChoices(
              { name: 'Python', value: 'python' },
              { name: 'JavaScript', value: 'javascript' },
              { name: 'Bash', value: 'bash' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('code')
            .setDescription('Code to execute')
            .setRequired(true)
            .setMaxLength(1500)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(false);

    if (!subcommand || subcommand === 'generate') {
      await handleCodeGenerate(interaction);
      return;
    }

    if (subcommand === 'run') {
      await handleCodeRun(interaction);
      return;
    }

    await interaction.reply({
      content: `Unknown subcommand: ${subcommand}`,
      ephemeral: true,
    });
  },
};
