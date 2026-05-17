import { BillableModel, creditsManager } from './manager';

export const INSUFFICIENT_CREDITS_MESSAGE =
  'クレジットが不足しています。/credits で残高確認、/buy でチャージできます。';

export class InsufficientCreditsError extends Error {
  constructor() {
    super(INSUFFICIENT_CREDITS_MESSAGE);
    this.name = 'InsufficientCreditsError';
  }
}

class CreditsChecker {
  ensureSufficientCredits(discordId: string, username: string, model: BillableModel): void {
    if (!creditsManager.canAfford(discordId, username, model)) {
      throw new InsufficientCreditsError();
    }
  }
}

export const creditsChecker = new CreditsChecker();
