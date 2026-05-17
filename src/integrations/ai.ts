import ModelPreferenceRepository from '../db/modelPreferenceRepository';
import { ModelChoice, RoutedModel } from '../llm/router';

export type AiStatus = {
  channelId: string;
  configuredModel: ModelChoice;
  effectiveModel: RoutedModel;
  updatedAt: string | null;
  updatedBy: string | null;
  openaiConfigured: boolean;
  anthropicConfigured: boolean;
};

export function setChannelAiModel(
  channelId: string,
  model: ModelChoice,
  updatedByDiscordId: string,
  updatedByUsername: string
): AiStatus {
  const saved = ModelPreferenceRepository.setChannelPreference(
    channelId,
    model,
    updatedByDiscordId,
    updatedByUsername
  );

  return {
    channelId,
    configuredModel: saved.model,
    effectiveModel: saved.model === 'auto' ? 'claude' : saved.model,
    updatedAt: saved.updated_at,
    updatedBy: saved.updated_by_username,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  };
}

export function getChannelAiModel(channelId: string): ModelChoice {
  return ModelPreferenceRepository.getByChannelId(channelId)?.model ?? 'auto';
}

export function getAiStatus(channelId: string, fallbackModel: RoutedModel): AiStatus {
  const preference = ModelPreferenceRepository.getByChannelId(channelId);

  return {
    channelId,
    configuredModel: preference?.model ?? 'auto',
    effectiveModel: preference?.model === 'auto' || !preference ? fallbackModel : preference.model,
    updatedAt: preference?.updated_at ?? null,
    updatedBy: preference?.updated_by_username ?? null,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  };
}
