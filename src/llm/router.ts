// src/llm/router.ts -- LLM routing between Claude and GPT-4o
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import ModelPreferenceRepository from '../db/modelPreferenceRepository';

export type ModelChoice = 'claude' | 'gpt4o' | 'auto';
export type RoutedModel = Exclude<ModelChoice, 'auto'>;

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Claude連携を使うには環境変数 `ANTHROPIC_API_KEY` を設定してください。'
      );
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenAI連携を使うには環境変数 `OPENAI_API_KEY` を設定してください。'
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export function getModelLabel(model: RoutedModel): string {
  return model === 'claude' ? 'Claude' : 'GPT-4o';
}

export function resolveModelChoice(
  task: string,
  preference: ModelChoice = 'auto',
  channelId?: string
): RoutedModel {
  if (preference !== 'auto') {
    return preference;
  }

  const channelPreference = channelId
    ? ModelPreferenceRepository.getByChannelId(channelId)?.model ?? 'auto'
    : 'auto';

  if (channelPreference !== 'auto') {
    return channelPreference;
  }

  const codeKeywords = ['code', 'function', 'debug', 'fix', 'implement', 'typescript', 'python'];
  const hasCodeKeyword = codeKeywords.some((keyword) => task.toLowerCase().includes(keyword));

  return hasCodeKeyword ? 'gpt4o' : 'claude';
}

const SYSTEM_PROMPT = `You are Aude, an autonomous AI coworker that lives in Discord.
You help users with research, coding, content creation, and automation tasks.
Be concise, actionable, and get straight to results. Format responses with Discord markdown.`;

async function callClaude(messages: LLMMessage[]): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textBlock.text;
}

async function callGPT4o(messages: LLMMessage[]): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
  });

  return response.choices[0]?.message?.content ?? 'No response from GPT-4o';
}

export async function routeToLLM(
  prompt: string,
  preference: ModelChoice = 'auto',
  messages?: LLMMessage[],
  channelId?: string
): Promise<string> {
  const selected = resolveModelChoice(prompt, preference, channelId);
  const messagePayload = messages ?? [{ role: 'user', content: prompt }];

  console.log(`[LLM] Routing to: ${getModelLabel(selected)}`);

  try {
    return selected === 'claude'
      ? await callClaude(messagePayload)
      : await callGPT4o(messagePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[LLM] ${selected} failed, falling back...`, message);

    return selected === 'claude'
      ? await callGPT4o(messagePayload)
      : await callClaude(messagePayload);
  }
}
