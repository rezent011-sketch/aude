// src/handlers/interactionHandler.ts — Handle slash command interactions
import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { Collection } from 'discord.js';
import { handleSubscribeButton, getPlanFromButtonCustomId } from '../commands/subscribe';
import approvalService from '../services/approvalService';
import { replyToInteractionWithError } from '../utils/errorHandler';

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isButton()) {
    try {
      if (await approvalService.handleButtonInteraction(interaction)) {
        return;
      }

      if (getPlanFromButtonCustomId(interaction.customId)) {
        await handleSubscribeButton(interaction);
      }
    } catch (error) {
      console.error(`Error handling button ${interaction.customId}:`, error);
      await replyToInteractionWithError(interaction, error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = ((interaction.client as any).commands as Collection<string, any>).get(
    interaction.commandName
  );

  if (!command) {
    console.error(`❌ Unknown command: ${interaction.commandName}`);
    await interaction.reply({
      content: '❌ Unknown command. Please try again.',
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error) {
    console.error(`Error executing command /${interaction.commandName}:`, error);
    await replyToInteractionWithError(interaction, error);
  }
}
