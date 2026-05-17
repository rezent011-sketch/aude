import UserRepository from '../db/userRepository';

const CREDIT_COSTS = {
  task: 5,
  research: 3,
  create: 8,
  code: 5,
};

class CreditManager {
  checkAndDeduct(discordId: string, commandType: keyof typeof CREDIT_COSTS) {
    const cost = CREDIT_COSTS[commandType];
    const credits = UserRepository.getCredits(discordId);

    if (credits < cost) {
      return { success: false, remaining: credits, error: 'Insufficient credits' };
    }

    UserRepository.updateCredits(discordId, -cost, `Used for ${commandType} command`);
    const remainingCredits = credits - cost;
    return { success: true, remaining: remainingCredits };
  }

  refund(discordId: string, commandType: keyof typeof CREDIT_COSTS, reason: string) {
    const refundAmount = CREDIT_COSTS[commandType];
    UserRepository.updateCredits(discordId, refundAmount, `Refund for ${commandType} command: ${reason}`);
  }
}

export default new CreditManager();
