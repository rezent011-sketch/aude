// src/components/approval.ts -- Approval flow with ✅Approve / ❌Reject buttons
import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ButtonInteraction,
  ComponentType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  InteractionCollector,
} from 'discord.js';

export interface ApprovalOptions {
  /** Title shown in the approval embed */
  title: string;
  /** Description / details of the action to approve */
  description: string;
  /** Timeout in milliseconds (default: 30 000) */
  timeoutMs?: number;
}

export interface ApprovalResult {
  approved: boolean;
  /** The ButtonInteraction that resolved the flow, or null on timeout */
  interaction: ButtonInteraction | null;
}

/**
 * Show an approval prompt with ✅Approve / ❌Reject buttons.
 * Resolves when the user clicks a button, or after timeout.
 *
 * @param interaction - The originating slash-command interaction (must be deferred or replied).
 * @param options     - Approval display options.
 * @returns           - { approved, interaction }
 */
export async function requestApproval(
  interaction: ChatInputCommandInteraction,
  options: ApprovalOptions
): Promise<ApprovalResult> {
  const { title, description, timeoutMs = 30_000 } = options;

  // Build embed
  const embed = new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle(`⚠️ Approval Required: ${title}`)
    .setDescription(description)
    .setFooter({ text: `This request will expire in ${Math.round(timeoutMs / 1000)} seconds.` })
    .setTimestamp();

  // Build buttons
  const approveButton = new ButtonBuilder()
    .setCustomId('approval_approve')
    .setLabel('✅ Approve')
    .setStyle(ButtonStyle.Success);

  const rejectButton = new ButtonBuilder()
    .setCustomId('approval_reject')
    .setLabel('❌ Reject')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);

  // Send the approval message
  let approvalMessage: Message;
  if (interaction.replied || interaction.deferred) {
    approvalMessage = (await interaction.followUp({
      embeds: [embed],
      components: [row],
    })) as Message;
  } else {
    approvalMessage = (await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    })) as Message;
  }

  return new Promise<ApprovalResult>((resolve) => {
    const collector: InteractionCollector<ButtonInteraction> =
      approvalMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (btn) => btn.user.id === interaction.user.id,
        time: timeoutMs,
        max: 1,
      });

    collector.on('collect', async (btn: ButtonInteraction) => {
      const approved = btn.customId === 'approval_approve';

      // Acknowledge button click
      const resultEmbed = new EmbedBuilder()
        .setColor(approved ? 0x57f287 : 0xed4245)
        .setTitle(approved ? '✅ Approved' : '❌ Rejected')
        .setDescription(
          approved
            ? 'Action approved — processing your request...'
            : 'Action rejected — no changes were made.'
        )
        .setTimestamp();

      await btn.update({ embeds: [resultEmbed], components: [] });
      resolve({ approved, interaction: btn });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        // Timed out — disable buttons
        const disabledApprove = ButtonBuilder.from(approveButton).setDisabled(true);
        const disabledReject = ButtonBuilder.from(rejectButton).setDisabled(true);
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          disabledApprove,
          disabledReject
        );

        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x747f8d)
          .setTitle('⏰ Approval Timed Out')
          .setDescription('No response received within the time limit. The action was cancelled.')
          .setTimestamp();

        approvalMessage
          .edit({ embeds: [timeoutEmbed], components: [disabledRow] })
          .catch(() => {/* ignore if message was deleted */});

        resolve({ approved: false, interaction: null });
      }
    });
  });
}
