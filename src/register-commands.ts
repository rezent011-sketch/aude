// src/register-commands.ts -- Standalone script to register slash commands
import 'dotenv/config';
import { registerCommandsToDiscord } from './handlers/commandHandler';

registerCommandsToDiscord()
  .then(() => {
    console.log('Done! Slash commands registered.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to register commands:', error);
    process.exit(1);
  });
