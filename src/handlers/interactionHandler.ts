// src/handlers/interactionHandler.ts — Handle slash command interactions
import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { Collection } from 'discord.js';

export async function handleInteraction(interaction: Interaction): Promise<void> {
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

    const errorMessage = '❌ Something went wrong while processing your request. Please try again.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
