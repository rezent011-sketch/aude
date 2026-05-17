import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { createCheckoutSession } from '../stripe/stripeManager';
import { PLAN_ORDER, SubscriptionPlan, getPlanAmount, getPlanLabelJa } from '../stripe/plans';

const SUBSCRIBE_BUTTON_PREFIX = 'subscribe:';

function buildPlanButton(plan: SubscriptionPlan): ButtonBuilder {
  const amount = getPlanAmount(plan);
  const suffix = amount === 0 ? '無料' : `${amount.toLocaleString('ja-JP')}円/月`;

  return new ButtonBuilder()
    .setCustomId(`${SUBSCRIBE_BUTTON_PREFIX}${plan}`)
    .setLabel(`${getPlanLabelJa(plan)} (${suffix})`)
    .setStyle(plan === 'pro' ? ButtonStyle.Success : ButtonStyle.Primary);
}

export function getSubscribeButtonRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...PLAN_ORDER.map((plan) => buildPlanButton(plan))
    ),
  ];
}

export function getPlanFromButtonCustomId(customId: string): SubscriptionPlan | null {
  if (!customId.startsWith(SUBSCRIBE_BUTTON_PREFIX)) {
    return null;
  }

  const plan = customId.slice(SUBSCRIBE_BUTTON_PREFIX.length);
  return PLAN_ORDER.find((candidate) => candidate === plan) ?? null;
}

export async function handleSubscribeButton(interaction: ButtonInteraction): Promise<void> {
  const plan = getPlanFromButtonCustomId(interaction.customId);
  if (!plan) {
    await interaction.reply({
      content: '不正なプラン指定です。',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const result = await createCheckoutSession({
    plan,
    discordUserId: interaction.user.id,
    username: interaction.user.username,
  });

  const content = result.checkoutUrl
    ? `${result.message}\n${result.checkoutUrl}`
    : result.message;

  await interaction.editReply({
    content,
  });
}

export const subscribeCommand = {
  data: new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('購読プランを選択して決済リンクを取得します'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('プランを選択')
      .setDescription(
        [
          '利用するプランを選択してください。',
          'Starter: 980円/月',
          'Pro: 2,980円/月',
          'Team: 9,800円/月',
        ].join('\n')
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      components: getSubscribeButtonRows(),
      ephemeral: true,
    });
  },
};
