// src/llm/router.ts -- LLM routing between Claude and GPT-4o
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

type ModelChoice = 'claude' | 'gpt4o' | 'auto';

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function selectModel(task: string, preference: ModelChoice): ModelChoice {
  if (preference !== 'auto') return preference;

  // Heuristic: use Claude for creative/research, GPT-4o for code
  const codeKeywords = ['code', 'function', 'debug', 'fix', 'implement', 'typescript', 'python'];
  const hasCodeKeyword = codeKeywords.some((kw) => task.toLowerCase().includes(kw));

  return hasCodeKeyword ? 'gpt4o' : 'claude';
}

const SYSTEM_PROMPT = `You are Aude, an autonomous AI coworker that lives in Discord.
You help users with research, coding, content creation, and automation tasks.
Be concise, actionable, and get straight to results. Format responses with Discord markdown.`;

async function callClaude(prompt: string): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }
  return textBlock.text;
}

async function callGPT4o(prompt: string): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0]?.message?.content ?? 'No response from GPT-4o';
}

export async function routeToLLM(
  prompt: string,
  preference: ModelChoice = 'auto'
): Promise<string> {
  const selected = selectModel(prompt, preference);

  console.log(`[LLM] Routing to: ${selected === 'claude' ? 'Claude' : 'GPT-4o'}`);

  try {
    if (selected === 'claude') {
      return await callClaude(prompt);
    } else {
      return await callGPT4o(prompt);
    }
  } catch (error: any) {
    // Fallback: if primary fails, try the other
    console.warn(`[LLM] ${selected} failed, falling back...`, error.message);
    if (selected === 'claude') {
      return await callGPT4o(prompt);
    } else {
      return await callClaude(prompt);
    }
  }
}
