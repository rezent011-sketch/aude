import UserRepository, { CreditTransaction } from '../db/userRepository';

export const MODEL_CREDIT_COSTS = {
  claude: 3,
  gpt4o: 2,
} as const;

export type BillableModel = keyof typeof MODEL_CREDIT_COSTS;

class CreditsManager {
  getCost(model: BillableModel): number {
    return MODEL_CREDIT_COSTS[model];
  }

  getRemainingCredits(discordId: string, username: string): number {
    return UserRepository.getOrCreateUser(discordId, username).credits;
  }

  canAfford(discordId: string, username: string, model: BillableModel): boolean {
    return this.getRemainingCredits(discordId, username) >= this.getCost(model);
  }

  consume(discordId: string, username: string, model: BillableModel): number {
    const remainingCredits = this.getRemainingCredits(discordId, username);
    const cost = this.getCost(model);

    if (remainingCredits < cost) {
      throw new Error('Insufficient credits');
    }

    UserRepository.updateCredits(
      discordId,
      -cost,
      `${this.formatModelName(model)} 呼び出し`,
      'use'
    );

    return remainingCredits - cost;
  }

  refund(discordId: string, username: string, model: BillableModel, reason: string): number {
    this.getRemainingCredits(discordId, username);

    const amount = this.getCost(model);
    UserRepository.updateCredits(
      discordId,
      amount,
      `${this.formatModelName(model)} 返却: ${reason}`,
      'refund'
    );

    return this.getRemainingCredits(discordId, username);
  }

  getRecentUsageHistory(
    discordId: string,
    username: string,
    limit = 5
  ): CreditTransaction[] {
    this.getRemainingCredits(discordId, username);
    return UserRepository.getRecentTransactions(discordId, limit, 'use');
  }

  private formatModelName(model: BillableModel): string {
    return model === 'claude' ? 'Claude' : 'GPT-4o';
  }
}

export const creditsManager = new CreditsManager();
