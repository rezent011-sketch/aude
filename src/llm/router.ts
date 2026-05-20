// src/llm/router.ts -- LLM routing between Claude and GPT-4o with Function Calling
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import ModelPreferenceRepository from '../db/modelPreferenceRepository';
import { buildTeamMemoryContext } from '../services/teamMemoryService';
import {
  getAvailableTools,
  executeToolCall,
  toOpenAITools,
  toAnthropicTools,
} from '../services/toolDispatcher';

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
Be concise, actionable, and get straight to results. Format responses with Discord markdown.
When you have access to tools (Gmail, Calendar, Notion, GitHub, etc.), USE THEM proactively to answer questions — do NOT say "I can't access" when a relevant tool is available.
Always respond in the same language the user writes in (Japanese if they write Japanese).`;

function buildSystemPrompt(memoryContext?: string, guildId?: string): string {
  const sections = [memoryContext ?? '', buildTeamMemoryContext(guildId ?? null)].filter(Boolean);
  if (sections.length === 0) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n${sections.join('')}`;
}

// ── Function Calling with Claude ──────────────────────────────────────────────

async function callClaudeWithTools(
  messages: LLMMessage[],
  systemPrompt?: string,
  guildId?: string,
  channelId?: string
): Promise<string> {
  const client = getAnthropicClient();
  const tools = getAvailableTools();
  const anthropicTools = toAnthropicTools(tools);

  const builtSystem = buildSystemPrompt(systemPrompt, guildId);

  // ループ最大3回
  const currentMessages: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let loop = 0; loop < 3; loop++) {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: builtSystem,
      tools: anthropicTools.length > 0 ? (anthropicTools as Anthropic.Messages.Tool[]) : undefined,
      messages: currentMessages,
    });

    // ツール呼び出しがない → テキストを返す
    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text : 'No response from Claude';
    }

    // ツール呼び出しを処理
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`[Tool] Claude calling: ${block.name}`, block.input);
        const args = block.input as Record<string, unknown>;
        if (channelId) {
          args.channel_id = channelId;
        }
        const result = await executeToolCall(block.name, args);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    // アシスタントの応答とツール結果を追加して再ループ
    currentMessages.push({ role: 'assistant', content: response.content });
    currentMessages.push({ role: 'user', content: toolResults });
  }

  // 3回ループしても終わらなかった場合
  const lastMsg = currentMessages[currentMessages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant') {
    const content = lastMsg.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const textBlock = content.find((b): b is Anthropic.Messages.TextBlockParam => b.type === 'text');
      if (textBlock) return textBlock.text;
    }
  }
  return 'ツール処理中にエラーが発生しました。';
}

// ── Function Calling with GPT-4o ─────────────────────────────────────────────

async function callGPT4oWithTools(
  messages: LLMMessage[],
  systemPrompt?: string,
  guildId?: string,
  channelId?: string
): Promise<string> {
  const client = getOpenAIClient();
  const tools = getAvailableTools();
  const openaiTools = toOpenAITools(tools);

  const currentMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(systemPrompt, guildId) },
    ...messages,
  ];

  for (let loop = 0; loop < 3; loop++) {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: currentMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      tool_choice: openaiTools.length > 0 ? 'auto' : undefined,
    });

    const choice = response.choices[0];
    if (!choice) return 'No response from GPT-4o';

    const msg = choice.message;

    // ツール呼び出しがない → テキストを返す
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? 'No response from GPT-4o';
    }

    // ツール呼び出しを処理
    currentMessages.push(msg);

    for (const toolCall of msg.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
      if (channelId) {
        args.channel_id = channelId;
      }
      console.log(`[Tool] GPT-4o calling: ${toolCall.function.name}`, args);
      const result = await executeToolCall(toolCall.function.name, args);
      currentMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  return 'ツール処理中にエラーが発生しました。';
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function routeToLLM(
  prompt: string,
  preference: ModelChoice = 'auto',
  messages?: LLMMessage[],
  channelId?: string,
  memoryContext?: string,
  guildId?: string,
  enableTools = true
): Promise<string> {
  const selected = resolveModelChoice(prompt, preference, channelId);
  const messagePayload = messages ?? [{ role: 'user' as const, content: prompt }];

  console.log(`[LLM] Routing to: ${getModelLabel(selected)}`);

  try {
    if (selected === 'claude') {
      return enableTools
        ? await callClaudeWithTools(messagePayload, memoryContext, guildId, channelId)
        : await callClaudeWithTools(messagePayload, memoryContext, guildId, channelId); // tools=[] if none available
    } else {
      return enableTools
        ? await callGPT4oWithTools(messagePayload, memoryContext, guildId, channelId)
        : await callGPT4oWithTools(messagePayload, memoryContext, guildId, channelId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[LLM] ${selected} failed, falling back...`, message);

    try {
      return selected === 'claude'
        ? await callGPT4oWithTools(messagePayload, memoryContext, guildId, channelId)
        : await callClaudeWithTools(messagePayload, memoryContext, guildId, channelId);
    } catch (fallbackError) {
      const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error(`[LLM] Fallback also failed:`, fbMsg);
      throw fallbackError;
    }
  }
}
